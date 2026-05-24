import { throwNever } from "~/lib/throw";
import { DAYS, SECONDS, toMs, YEARS } from "~/lib/time";
import { formatDate } from "../format-date";
import type { LocalStorageUserEntity, StarType } from "../local-storage";
import type { UserStatusType } from "../types/types";
import { UserCtx } from "./user-ctx";

// Storing times in userRepo as Seconds-since-epoch / Unix time.
const pageLoadSecondsSinceEpoch = Math.floor(Date.now() / SECONDS +0.5);

const convert = {
	toStars : function(status : UserStatusType): StarType {
		switch(status){
			case "queued": return 'scan';
			case "notFollowing": return 1;
			case "following": return 3;
			case "new": return null;
			case "failed": return null;
			default: throwNever( status );
		}

	},
	toStatus : function(stars:StarType): UserStatusType {
		switch(stars){
			case 'scan': return "queued";
			case 1: return "notFollowing";
			case 2: case 3: case 4: case 5: return "following";
			case null: case undefined: return "new";
			default: throwNever(stars);
		}
	},

}

// calc some parameters we need to calculate downloads.
const now = new Date();
const thisYear = now.getFullYear();
const fractionOfPreviousYearToInclude = (new Date(thisYear + 1, 0, 1).valueOf() - now.valueOf()) / YEARS;
function calcDownloadsInLastYear(byYear:Record<string,number> ={}): number {
	return (byYear[thisYear] || 0) + Math.round((byYear[thisYear - 1] || 0) * fractionOfPreviousYearToInclude);
}

// toPrune helpers...
const yearsWithoutDownload = 4;
const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;

// ::UserData - fascade around user info
// enforce internal data consistency
export class UserData {

	public readonly username: string;

	private _info: LocalStorageUserEntity;

	constructor(username:string,info:LocalStorageUserEntity){
		if(info.dl==null) info.dl={};
		this.username = username;
		this._info = info;
	}

	// -- status --
	get status(): UserStatusType {
		if( !(this._info.failure==null) ) return "failed";
		return convert.toStatus(this._info.stars);
	}
	set status(value: UserStatusType){ this._info.stars = convert.toStars(value); }

	// -- Downloads --
	get downloadsInLastYear(): number { return calcDownloadsInLastYear(this._info.dl); }
	get byYear(): Record<string,number> { return this._info.dl||{}; }
	// Increments # of downloaded images for given year
	trackImageDownloaded( imageYear: string|number ){
		// !!! BUG - until this.byYear is written back to storage,
		// this can be called multiple times and will keep using
		// 0 instead of the incrementing value.
		this.byYear[imageYear] = (this.byYear[imageYear]||0) + 1;

		delete this._info.failure; // if we download an image, clear the failure
	}

	// -- view Date --
	public get viewDateMs(): number | undefined { 
		// don't assume .viewData is in seconds because we might have legacy values.
		// if all values are converted to seconds, we could replace this with:
		// return (this._info.viewDate||0) * SECONDS;
		return this._info.viewDate ? toMs(this._info.viewDate) : undefined;
	} 

	// also clears failures
	public setViewDateToNow(): void {
		// Save the old View Date in case we got logged out and are only scanning 8 images
		const oldViewDates = JSON.parse(sessionStorage["oldViewDates"]||"{}");
		oldViewDates[this.username] = this._info.viewDate;
		sessionStorage["oldViewDates"] = JSON.stringify(oldViewDates,null,'\t');
		// set it
		this._info.viewDate = pageLoadSecondsSinceEpoch;
		// cleanup 
		this.clearFailure();
	}


	// -- Failures -- (cleared by downloading an image or setViewDateToNow)
	public get firstFailure(): number | undefined { return this._info.failure?.first; }
	public toFailureString(): string {
		const failure = this._info.failure;
		if(failure === undefined) return `\t\t${this.username}\t${this.status}`
		return [ 
			formatDate.YMD( new Date(toMs(failure.first))), 
			failure.count, 
			this.username, 
			this.status
		].join('\t');
	}
	public loadFailed(){ // logs failure to load user page
		const failure = this._info.failure;
		if(failure !== undefined)
			failure.count++;
		else 
			this._info.failure = {count:1,first:pageLoadSecondsSinceEpoch};
	}

	// for displaying at startup
	public cloneLocalStorageEntity(): LocalStorageUserEntity{
		return structuredClone(this._info);
	}

	public clearFailure(): void {
		delete this._info.failure;
	}

	get isDueToScanNewImages(){
		const {status,viewDateMs} = this;
		if( status !== "following" || viewDateMs === undefined ) return false;
		const effectiveDownloadsInLastYear = this.downloadsInLastYear || 1;
		const daysBetweenScans = Math.max( 5, 365/effectiveDownloadsInLastYear*0.6); // 60% of wait duration
		const nextScanTime = Math.floor( daysBetweenScans * DAYS ) + viewDateMs;
		return nextScanTime < UserCtx.nowMs;
	}

	// The last year of the most recent downloaded image
	public get lastDownloadYear(): number {
		const defaultLastYear = 1980;
		return (this._info.dl === undefined) ? defaultLastYear 
			: Math.max(...Object.keys(this._info.dl).map(x=>Number(x))) || defaultLastYear;
	};

	public get lastCount(): number {
		return this._info.dl?.[this.lastDownloadYear] || 0;
	}

	public get shouldPrune(): boolean {
		return this.status=="following"
			&& this.viewDateMs !== undefined // was viewed
			&& this.lastDownloadYear<earliestEmptyYear
	}

	public get group():string {
		const {dl,viewDate} = this._info;
		
		const vdStr = viewDate!==undefined ? "vd" : "  ";
		const dlStr = dl!==undefined && Object.keys(dl).length > 0 ? "dl" : "  ";
		const status = this.status.padEnd(12,' ');
		const staleStr = this.isDueToScanNewImages ? "stale" : "fresh";
		const pruneStr = this.shouldPrune ? "prune" : "keep";
		return `:${vdStr}:${dlStr}:${status}:${staleStr}:${pruneStr}`;
	}

}
