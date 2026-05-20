import type { ValueUpdater } from "~/lib/storage";
import { DAYS, MONTHS } from "~/lib/time";
import { userRepo, type LocalStorageUserEntity } from "./local-storage";
import { calcDownloadsInLastYear, getTotalDownloads } from "./services/download-stats";
import { pageOwnerName } from "./services/instaDom";
import { loadTimeMs } from "./services/storage-time";

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

	public get isStale(): boolean {
		return this.refreshTime < loadTimeMs;
	}

	public get groupDescriptor():string {
		const {dl,lastVisit} = this._info;
		// LastVisit
		const lvStr = lastVisit !== undefined ? "LV" : "  ";
		// DL
		const dlStr = dl === undefined ? "   " 
			: Object.keys(dl).length == 0 ? "EMP"
			: "D_L";
		// stale / fresh
		const staleStr = this.isStale ? "stale" : "fresh";
		// following // private
		const followStr = this.isFollowing ? "following " : this.isFollowing===false ? "not-follow" : "          "
		const privateStr = this.isPrivate ? "private" : this.isPrivate ===false ? "public" : "      ";
		return `${lvStr}:${dlStr}:${staleStr}:${followStr}:${privateStr}`;
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