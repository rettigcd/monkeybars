import type { ValueUpdater } from "~/lib/storage";
import { DAYS, MONTHS } from "~/lib/time";
import { userRepo, type LocalStorageUserEntity } from "./local-storage";
import { calcDownloadsInLastYear, getTotalDownloads } from "./services/download-stats";
import { pageOwnerName } from "./services/instaDom";
import { loadTimeMs } from "./services/storage-time";

export type LastVisitStatus 
	= "stale" 
	| "recent"
	| "none downloads" // has download 
	| "none followee" // is following
	| "none nothing"; // no reason to keep

export type DownloadStatus
	= "no-visit" // visit page before trying to getting a DL status
	| "producing"	// dl more recent than 4 years
	| "idle" 		// dl over 4 years old - prune
	| "none followee"		// no-dl but following
	| "none nothing"; 		// no-dl but visited and never downloaded and not following


// All of the types required to build MyStatus
export type HasVisitState = "recent" | "stale";
export type VisitState = HasVisitState | "none";
export type HasDownloadState = "producing" | "idle";
export type DownloadState = HasDownloadState | "none";
export type NotVisited = { // not visited
	visit: "none";
	has: "downloads" | "followee" | "nothing";
};
export type SansDownloads = { // no downloads
	visit: HasVisitState;
	downloads: "none";
	has: "followee" | "nothing";
};
export type WithDownloads = { // all good!
	visit: HasVisitState;
	downloads: HasDownloadState;
};
export type Visited = SansDownloads | WithDownloads;
export type UserStatus = NotVisited | Visited;


export class UserCtx {

	public static allUsers(): UserCtx[] { return userRepo.keys().map(username=>new UserCtx(username)); }

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

	// -------------------
	// Is: private / following 
	// -------------------
	public set isFollowing(newValue:boolean){
		this._update( x => x.isFollowing = newValue);
	}
	public set isPrivate(newValue:boolean){
		this._update( x => x.isPrivate = newValue );
	}

	// ======== MISC ==========

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

	public get myStatus(): UserStatus {
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

	public get groupDescriptor():string {
		return `${this.lastVisitStatus} : ${this.downloadStatus}`;
	}

	public get lastVisitStatus(): LastVisitStatus {
		const {dl, isFollowing} = this._info;
		const {visitState: visitStatus} = this;
		return visitStatus !== "none" ? visitStatus
			: dl !== undefined ? "none downloads"	// keep because we downloaded something - get lastVisit date
			: isFollowing ? "none followee" // keep because is followee - may or may not want lastVisit date
			: "none nothing"; // no reason to keep
	}

	public get downloadStatus(): DownloadStatus {
		if( this.visitState === "none" ) return "no-visit";
		const {dlState} = this;
		if (dlState !== "none" ) return dlState;
		const {isFollowing} = this._info;
		return isFollowing
			? "none followee" // followed but never download
			: "none nothing"; // visited by never downloaded and not following
	}

	public prune(): LocalStorageUserEntity {
		const old = userRepo.get(this.username);
		userRepo.remove(this.username);
		console.log("Stopped tracking:", old);
		return old;
	}

	public cloneLocalStorage(): LocalStorageUserEntity{
		return structuredClone(userRepo.get(this.username));
	}

	private get _info() : LocalStorageUserEntity{ 
		this._cachedInfo ??= userRepo.get(this.username);
		return this._cachedInfo;
	}
	private _cachedInfo?: LocalStorageUserEntity;

	private _update(updateMethod:ValueUpdater<LocalStorageUserEntity> ){
		userRepo.update(this.username,updateMethod);
		this._cachedInfo = undefined;
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