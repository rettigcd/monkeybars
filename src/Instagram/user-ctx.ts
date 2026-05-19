import { userRepo, type LocalStorageUserEntity } from "./local-storage";
import { calcDownloadsInLastYear, getTotalDownloads } from "./services/download-stats";
import { pageOwnerName } from "./services/instaDom";
import { loadTimeMs } from "./services/storage-time";
import type { InstagramUser } from "./trackers/visiting-user-tracker";

export class UserCtx {

	constructor(
		public readonly username:string
	){}

	get isTracking(){ return userRepo.containsKey(this.username); }

	get downloadsInLastYear(){
		const info = userRepo.get(this.username);
		return calcDownloadsInLastYear(info);
	}

	get totalDownloads(){
		const info = userRepo.get(this.username);
		return getTotalDownloads(info.dl);
	}

	set isFollowing(newValue:boolean){
		userRepo.update(this.username, (x) => x.isFollowing = newValue);
	}

	public recordDownload(date:Date){
		const year = date.getFullYear();
		userRepo.update(this.username, (u) => {
			u.username ??= this.username;
			u.dl ??= {};
			u.dl[year] = (u.dl[year] || 0) + 1;

			// if we weren't tracking them before, we wouldn't have set lastVisit
			// but since we downloaded, set it now 
			if (this.username === pageOwnerName && (u.lastVisit || 0) < loadTimeMs)
				u.lastVisit = loadTimeMs;
		});
	}

	public setOwnerAndFollowing(following:boolean|undefined){
		// !!! it looks like we can do away with saving the username
		// and simply call userCtx.isFollowing = newValue
		userRepo.update(this.username, (x) => {
			x.username = this.username;
			if (following)
				x.isFollowing = following;
		});
	}

	public recordVisit(){
		userRepo.update(this.username, u => (u.lastVisit = loadTimeMs));
	}

	recordVisit2(user:InstagramUser,following:boolean){
		userRepo.update(user.username, (u) => {
			// standard
			u.lastVisit = loadTimeMs;
			// valuable
			u.isPrivate = user.is_private; // valuable
			u.isFollowing = following;
			// why?
			u.id = user.id;
			u.username = user.username;
			u.fullName = user.full_name;
		});
	}

	public save(user:InstagramUser){
		userRepo.update(user.username, (u) => {
			u.username = user.username;
			u.fullName = user.full_name;
			u.isPrivate = user.is_private;
			u.id = user.id;
			u.isFollowing = true;
		});
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
}