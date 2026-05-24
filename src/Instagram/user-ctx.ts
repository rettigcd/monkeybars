import type { ValueUpdater } from "~/lib/storage";
import { DAYS, MONTHS } from "~/lib/time";
import { userRepo, type LocalStorageUserEntity } from "./local-storage";
import { calcDownloadsInLastYear, getTotalDownloads } from "./services/download-stats";
import { pageOwnerName } from "./services/instaDom";
import { loadTimeMs } from "./services/storage-time";

// All of the types required to build UserStatus
export type HasVisitState = "recent" | "stale";
export type VisitState = HasVisitState | "none";
export type HasDownloadState = "producing" | "idle";
export type DownloadState = HasDownloadState | "none";
export type NotVisited = { // not visited
	visit: "none";
	has: "downloads" | "followee" | "nothing";
};
export type Visited_SansDownloads = { // no downloads
	visit: HasVisitState;
	downloads: "none";
	has: "followee" | "nothing";
};
export type Visited_WithDownloads = { // all good!
	visit: HasVisitState;
	downloads: HasDownloadState;
};
export type Visited = Visited_SansDownloads | Visited_WithDownloads;
export type UserState = NotVisited | Visited;


export class UserCtx {

	public static allUsers(): UserCtx[] { return userRepo.keys().map(username=>new UserCtx(username)); }

	private _cachedInfo?: LocalStorageUserEntity;

	constructor(
		public readonly username:string
	){}

	get isTracking(){ return userRepo.containsKey(this.username); }

	// ----------
	// Downloads
	// ----------
	public recordDownload(date:Date){
		const year = date.getFullYear();
		this._update( u => {
			u.dl ??= {};
			u.dl[year] = (u.dl[year] || 0) + 1;

			// if we weren't tracking them before, we wouldn't have set lastVisit
			// but since we downloaded, set it now 
			if (this.username === pageOwnerName && (u.lastVisit || 0) < loadTimeMs)
				u.lastVisit = loadTimeMs;
		});
	}

	public get downloadsInLastYear(){
		return calcDownloadsInLastYear(this._info);
	}

	public get totalDownloads(){
		return getTotalDownloads(this._info.dl);
	}

	// ----------
	// lastVisit
	// ----------
	public get lastVisit(): number | undefined { return this._info.lastVisit; }
	public recordVisit(){
		this._update( u => u.lastVisit = loadTimeMs );
	}
	public setLastVisit(date:Date){
		this._update( u => u.lastVisit = date.valueOf() );
	}

	// -------------------
	// Is: private / following 
	// -------------------
	public set isFollowing(newValue:boolean){
		this._update( x => x.isFollowing = newValue);
	}
	public set isPrivate(newValue:boolean){
		this._update( x => x.isPrivate = newValue );
	}

	// ======== MISC - state ==========

	public get refreshTime():number {
		const downloads: number = this.downloadsInLastYear;
		const waitTime: number =
			  20 <= downloads ? 1 * MONTHS
			: 10 <= downloads ? 2 * MONTHS
			:  5 <= downloads ? 3 * MONTHS
							  : 6 * MONTHS;
		return (this.lastVisit || 0)
			+ waitTime
			+ Math.floor((strToFloat(this.username) - 0.5) * 14 * DAYS); // spread out over 2 weeks.
	}

	public get visitState(): VisitState {
		return this._info.lastVisit === undefined ? "none" 
			: this.refreshTime < loadTimeMs ? "stale"  // last visit was too long ago
			: "recent"; // last visit was recent
	}

	public get dlState(): DownloadState {
		const {dl} = this._info;
		const isProducing = true; // have any downloads in the last 4 years - !!! implemented
		return dl === undefined ? "none" : isProducing ? "producing" : "idle";
	}

	public get state(): UserState {
		const { isFollowing } = this._info;
		const {visitState,dlState} = this;
		
		if (visitState === "none")
			// needs visited
			return {
				visit: visitState,
				has: dlState !== "none" ? "downloads" : isFollowing ? "followee" : "nothing",
			};

		if (dlState === "none")
			// visited but no downloads, has===followee => ok, has===nothing => why are we tracking?
			return {
				visit: visitState,		// visited, recent or stale
				downloads: dlState,  // no downloads
				has: isFollowing ? "followee" : "nothing",
			};

		// has visited and DL
		return {
			visit: visitState,		// visited: stale or recent
			downloads: dlState,	// downloaded: producing or idle
		};
	}


	public prune(): LocalStorageUserEntity {
		const old = userRepo.get(this.username);
		userRepo.remove(this.username);
		return old;
	}

	public cloneLocalStorage(): LocalStorageUserEntity{
		return structuredClone(userRepo.get(this.username));
	}

	// Data cleanup methods

	// for people missing viewDate, create a viewDate at beginning of 1st DL year
	public applyDlYear(){
		const {visitState,dlState} = this;
		if( visitState === "none" && dlState !== "none" ){
			const year:string = Object.keys(this._info.dl!).sort().shift()!;
			const date = new Date(Number(year),0,1);
			console.log("Setting viewDate to ", year, date.toDateString());
			this.setLastVisit(date);
		}
	}

	// for people missing viewDate, use lastUpload where available
	public applyLastUpload(){
		const {visitState} = this;
		if( visitState !== "none" ) return;
		const {lastUpload} = this._info as any;
		if( lastUpload === undefined ) return;
		const date = new Date(lastUpload);
		console.log("Setting viewDate to ", date.toDateString());
		this.setLastVisit(date);
	}

	// private

	private get _info() : LocalStorageUserEntity{ 
		this._cachedInfo ??= userRepo.get(this.username);
		return this._cachedInfo;
	}

	private _update(updateMethod:ValueUpdater<LocalStorageUserEntity> ){
		userRepo.update(this.username,updateMethod);
		delete this._cachedInfo;
	}
}


export function charTo64(c: string): number { // returns 0..64
	return ('0' <= c && c <= '9') ? (c.charCodeAt(0) - 48)
		 : ('A' <= c && c <= 'Z') ? (c.charCodeAt(0) - 55)
		 : ('a' <= c && c <= 'z') ? (c.charCodeAt(0) - 61)
		 : c === '_' ? 62
		 : c === '-' ? 63
		 : c === '.' ? 64
		 : 0;
}

function strToFloat(str:string): number { // returns 0..1
	const num = 
		  charTo64(str[0]) * 64 * 64 
		+ charTo64(str[1]) * 64 
		+ charTo64(str[3]);
	return num / (64 * 64 * 64);
}