import type { ValueUpdater } from "~/lib/storage";
import { DAYS, MONTHS } from "~/lib/time";
import { userRepo, type LocalStorageUserEntity } from "./local-storage";
import { calcDownloadsInLastYear, getTotalDownloads } from "./services/download-stats";
import { pageOwnerName } from "./services/instaDom";
import { loadTimeMs } from "./services/storage-time";

export type LastVisitStatus 
	= "visited-stale" 
	| "visited-fresh"
	| "no-visit downloads" // has download 
	| "no-visit followee" // is following
	| "no-visit nothing"; // no reason to keep

export type DownloadStatus
	= "no-visit" // visit page before trying to getting a DL status
	| "dl producing"		// dl more recent than 4 years
	| "dl not-producing" 	// dl over 4 years old - prune
	| "no-dl followee"		// no-dl but following
	| "no-dl nothing"; 		// no-dl but visited and never downloaded and not following


// All of the types required to build MyStatus
export type VisitState = "none" | "fresh" | "stale";
export type DownloadState = "none" | "producing" | "idle";
export type NotVisited = { // not visited
	visit: "none";
	has: "downloads" | "followee" | "nothing";
};
export type SansDownloads = { // no downloads
	visit: "fresh" | "stale";
	downloads: "none";
	has: "followee" | "nothing";
};
export type WithDownloads = { // all good!
	visit: "fresh" | "stale";
	downloads: "producing" | "idle";
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

	// checks if lastVisit is recent enough
	public get isStale(): boolean {
		return this.refreshTime < loadTimeMs;
	}

	// have any downloads in the last 4 years
	public get isProducing(): boolean {
		return true; // !!! add 4-year check
	}

	// lastVisit: "fresh" | "stale" | undefined
	// downloads: "producing" | "notproducing" | undefined
	// 


	public get myStatus(): UserStatus {
		const { dl, lastVisit, isFollowing } = this._info;

		const visit: VisitState = lastVisit === undefined ? "none" : this.isStale ? "stale" : "fresh";

		if (visit === "none")
			// needs visited
			return {
				visit,
				has: dl !== undefined ? "downloads" : isFollowing ? "followee" : "nothing",
			};

		const downloads: DownloadState = dl === undefined ? "none" : this.isProducing ? "producing" : "idle";
		if (downloads === "none")
			// visited but no downloads, has===followee => ok, has===nothing => why are we tracking?
			return {
				visit,		// visited, fresh or stale
				downloads,  // no downloads
				has: isFollowing ? "followee" : "nothing",
			};

		// has visited and DL
		return {
			visit,		// visited: stale or fresh
			downloads,	// downloaded: producing or idle
		};
	}

	public get groupDescriptor():string {
		return `${this.lastVisitStatus} : ${this.downloadStatus}`;
	}

	public get lastVisitStatus(): LastVisitStatus {
		const {dl,lastVisit, isFollowing} = this._info;
		return lastVisit !== undefined ? ( this.isStale 
				? "visited-stale" 
				: "visited-fresh")
			: dl !== undefined ? "no-visit downloads"	// keep because we downloaded something - get lastVisit date
			: isFollowing ? "no-visit followee" // keep because is followee - may or may not want lastVisit date
			: "no-visit nothing"; // no reason to keep
	}

	public get downloadStatus(): DownloadStatus {
		const {dl,lastVisit, isFollowing} = this._info;
		if( lastVisit === undefined ) return "no-visit";
		if (dl!==undefined )
			return this.isProducing
				? "dl producing"		// keep on keeping on.
				: "dl not-producing"; 	// over 4 years old - prune
		if( isFollowing )
			return "no-dl followee"; // followed but never download
		return "no-dl nothing"; // visited by never downloaded and not following
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