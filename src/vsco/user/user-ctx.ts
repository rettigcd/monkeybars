import { assertNotNull } from "~/laundry/location";
import { openInTab } from "~/lib/gm";
import { EventHostBase } from "~/lib/observable";
import { CachedPersistentArray } from "~/lib/storage";
import { throwNever } from "~/lib/throw";
import { DAYS, SECONDS, toMs, YEARS } from "~/lib/time";
import { Fetcher } from "../fetcher";
import { formatDate } from "../format-date";
import { commonRepo, newImageRepo, userRepo, type LocalStorageUserEntity, type StarType } from "../local-storage";
import { ImageModel } from "../models/image-model";
import { NewImageStore } from "../new-image-store";
import type { ILinkedUser, UserStatusType } from "../types/types";
import { pageOwnerName } from "../vscoDom";
import { UserLinks } from "./user-links";

type UserCtxEvents = {
	imageDownloaded: [];
};

const now = new Date();

// Storing times in userRepo as Seconds-since-epoch / Unix time.
const pageLoadSecondsSinceEpoch = Math.floor(now.valueOf() / SECONDS +0.5);

// -----------------------
// calcDownloadsInLastYear
// -----------------------
const thisYear = now.getFullYear();
const fractionOfPreviousYearToInclude = (new Date(thisYear + 1, 0, 1).valueOf() - now.valueOf()) / YEARS;
function calcDownloadsInLastYear(byYear:Record<string,number> ={}): number {
	return (byYear[thisYear] || 0) + Math.round((byYear[thisYear - 1] || 0) * fractionOfPreviousYearToInclude);
}

// toPrune helpers...
const yearsWithoutDownload = 4;
export const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;

// -----------------
// ---- UserCtx ----
// -----------------
export class UserCtx extends EventHostBase<UserCtxEvents> implements ILinkedUser {

	// Static
	public static readonly commonRepo: CachedPersistentArray = commonRepo; // init from local-storage.ts
	public static nowMs: number; // for detecting what Users are stale

	// private
	private _track: (x:ImageModel)=>void;
	private  _username: string;

	constructor(username: string, track: (x:ImageModel)=>void){
		super();
		this._username = username;
		this._track = track;
	}

	public get isPageOwner(): boolean{ return this.username === pageOwnerName; }

	// LocalStorageUserEntity stuff
	// ------------------------------
	// ---- username / persisted ----
	// ------------------------------
	public get username(){ return this._username; }
	public set username(newName:string){ userRepo.rename(this._username,newName); this._username=newName; }
	get isPersisted(){ return userRepo.containsKey(this.username); }

	// ------------------
	// ---- viewDate ----
	// ------------------
	public get viewDateMs(): number | undefined { 
		// don't assume .viewData is in seconds because we might have legacy values.
		// if all values are converted to seconds, we could replace this with:
		// return (this._info.viewDate||0) * SECONDS;
		return this._info.viewDate ? toMs(this._info.viewDate) : undefined;
	}
	public setViewDateToNow() { 
		this._update( info => {
			// Save the old View Date in case we got logged out and are only scanning 8 images
			const oldViewDates = JSON.parse(sessionStorage["oldViewDates"]||"{}");
			oldViewDates[this.username] = info.viewDate;
			sessionStorage["oldViewDates"] = JSON.stringify(oldViewDates,null,'\t');
			// set it
			info.viewDate = pageLoadSecondsSinceEpoch;
			// cleanup 
			delete info.failure;
		} );
	} // also clears failures

	public get isDueToScanNewImages(){
		const {status,viewDateMs} = this;
		if( status !== "following" || viewDateMs === undefined ) return false;
		const effectiveDownloadsInLastYear = this.downloadsInLastYear || 1;
		const daysBetweenScans = Math.max( 5, 365/effectiveDownloadsInLastYear*0.6); // 60% of wait duration
		const nextScanTime = Math.floor( daysBetweenScans * DAYS ) + viewDateMs;
		return nextScanTime < UserCtx.nowMs;
	}

	// -------------------
	// ---- downloads ----
	// -------------------
	public get downloadsInLastYear(){ return calcDownloadsInLastYear(this._info.dl); }

	// The last year of the most recent downloaded image
	public get lastDownloadYear(): number { 
		const defaultLastYear = 1980;
		return (this._info.dl === undefined) ? defaultLastYear 
			: Math.max(...Object.keys(this._info.dl).map(x=>Number(x))) || defaultLastYear;
	}

	// # of images downloaded in last year we had a downloads
	public get lastCount(){ 
		return this._info.dl?.[this.lastDownloadYear] || 0;
	}

	public get byYear(): Record<string,number> { 
		return this._info.dl||{};
	}

	public get shouldPrune(){ 
		return this.status=="following"
			&& this.viewDateMs !== undefined // was viewed
			&& this.lastDownloadYear<earliestEmptyYear
	}

	// ----------------
	// ---- Status ----
	// ----------------
	public get status(): UserStatusType { 
		if( !(this._info.failure==null) ) return "failed";
		const stars: StarType = this._info.stars;
		switch(stars){
			case 'scan': return "queued";
			case 1: return "notFollowing";
			case 2: case 3: case 4: case 5: return "following";
			case null: case undefined: return "new";
			default: throwNever(stars);
		}
	}
	public set status(status: UserStatusType){ 
		// when we follow someone, assume everything has been viewed.
		if(status=='following')
			this.setViewDateToNow();
		function toStars(status:UserStatusType){
			switch(status){
				case "queued": return 'scan';
				case "notFollowing": return 1;
				case "following": return 3;
				case "new": return null;
				case "failed": return null;
				default: throwNever( status );
			}
		}
		this._update( info => info.stars = toStars(status));
	}
	markAsQueued(){ if(this.status != "following") this.status = "queued";}

	// ------------------
	// ---- Failures ----
	// ------------------
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


	public get group():string {
		const {dl,viewDate} = this._info;
		
		const vdStr = viewDate!==undefined ? "vd" : "  ";
		const dlStr = dl!==undefined && Object.keys(dl).length > 0 ? "dl" : "  ";
		const status = this.status.padEnd(12,' ');
		const staleStr = this.isDueToScanNewImages ? "stale" : "fresh";
		const pruneStr = this.shouldPrune ? "prune" : "keep";
		return `:${vdStr}:${dlStr}:${status}:${staleStr}:${pruneStr}`;
	}

	public cloneLocalStorageEntity(){  return structuredClone(this._info); }

	get links(){ 
		return new UserLinks(
			this.username,
			this.fetch,
			(u:string)=>new UserCtx(u, this._track),
			this._track
		);
	}

	get newImages(){ // uses responsiveUrl as key to prevent duplicates, only need values
		return Object.values( newImageRepo.get(this.username) )
			.map(i=>{ 
				const model = new ImageModel(i);
				this._track(model);
				return model;
			});
	} 
	clearNewImages(){ newImageRepo.remove(this.username); }

	openInNewTab(){ 
		this.markAsQueued();
		userRepo.sync(); // flush 'save' before we open the next page.
		openInTab(this.fetch.galleryUrl); // window.open(this.fetch.galleryUrl, '_blank');
	}
	maskAsCommon(){ UserCtx.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

	// Counts
	logDownloadImage(imgModel:ImageModel){
		const imageYear = imgModel.imgDate.getFullYear();
		this._update( info=>{ 
			info.dl ??= {};
			info.dl[imageYear] = (info.dl[imageYear]||0) + 1;
			delete info.failure; // if we download an image, clear the failure
		} );
		this.trigger('imageDownloaded');
	}

	// Increments # of downloaded images for given year
	trackImageDownloaded( imageYear: string|number ){
		// !!! BUG - until this.byYear is written back to storage,
		// this can be called multiple times and will keep using
		// 0 instead of the incrementing value.
		this.byYear[imageYear] = (this.byYear[imageYear]||0) + 1;

		delete this._info.failure; // if we download an image, clear the failure
	}




	public prune(){ userRepo.remove(this.username);}

	get fetch(){ return new Fetcher(this.username, this.isPageOwner, this._track ); }


	// user MUST have .viewDate for this work.
	public async scanForNewImagesAsync(){
		try{
			const lastViewDateMs = this.viewDateMs;
			assertNotNull( lastViewDateMs, ".viewDate");

			const newImages:ImageModel[] = [];
			for await(let img of this.fetch.fetchGalleryImagesAsync()){
				if(img.uploadDateMs<lastViewDateMs) break;
				this._track(img);
				newImages.push(img);
			}

			this.setViewDateToNow();

			new NewImageStore().addNewImagesToUser(this.username,newImages);
		} catch( error ){
			console.log('Failed to load new images for '+this.username);
			console.error(error);
			this._update( info => {
				const failure = info.failure;
				if(failure !== undefined)
					failure.count++;
				else 
					info.failure = {count:1,first:pageLoadSecondsSinceEpoch};
			} );
		}
	}

	public clearFailure() {
		this._update( info => delete info.failure );
	}

	private get _info(){ return userRepo.get(this.username);}

	private _update(action:(d:LocalStorageUserEntity)=>void){
		return userRepo.update( this.username, action);
	}

}
