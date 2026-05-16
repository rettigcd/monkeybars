import { by, byDesc } from "~/lib/sorting";
import { SyncedPersistentDict } from "~/lib/storage";
import { LastYear } from "./last-year";
import { ImageModel } from "./models/image-model";
import type { LocalStorageUserEntity } from "./types/local-storage";
import type { UserStatusType } from "./types/types";
import { UserAccess } from "./user-access";
import { UserCtx } from "./user-ctx";
import { NextLink } from "./views/next-link";

export class UserStore {

	public static pageOwnerName?: string; // set later IF we are on a pageOwner page

	private readonly _cache: Record<string, UserCtx> = {};
	private readonly _userRepo: SyncedPersistentDict<LocalStorageUserEntity>; // only used by UserStore and UserCtx, limit access to other classes

	constructor(
		private readonly access: UserAccess,
		private readonly track: (imgModel:ImageModel) => void
	) {
		this._userRepo = new SyncedPersistentDict<LocalStorageUserEntity>('users');
	}

	get(username: string): UserCtx {
		return this._cache[username]
			??= new UserCtx(username, this._userRepo, this.access, this.track);
	}

	getMany(usernames: string[]): UserCtx[] {
		return usernames.map(username => this.get(username));
	}

	get allUsers(): UserCtx[] {
		return this._userRepo.keys()
			.map(username => this.get(username));
	}

	// Users with FOUND new Images
	get newImageUsers(): UserCtx[] {
		return this.access.newImageRepo.keys()
			.map(username => this.get(username));
	}

	clear(username: string): void {
		delete this._cache[username];
	}

	clearAll(): void {
		for (const key of Object.keys(this._cache))
			delete this._cache[key];
	}

	get nextLinks(): NextLink[] {
		return [ 
			this.newUsers(), 
			this.queuedUsers(), 
			this.failedUsers(),
			this.missingViewDateUsers(), 
			this.toPrune(), 
		];
	} 

	// Scans for anyone marked as "queued" or "should-review"
	newUsers(): NextLink{ return this._getLinkForUserStatus("new users","new"); }

	// Scans for anyone marked as "queued" or "should-review"
	queuedUsers(): NextLink{ return this._getLinkForUserStatus("for review","queued"); }

	// Scans for anyone marked as "queued" or "should-review"
	failedUsers(): NextLink{ return this._getLinkForUserStatus("failed users","failed"); }

	private _getLinkForUserStatus( label:string, status:UserStatusType ): NextLink {
		const users = this.allUsers
			.filter(user => user.data.status == status);
		return new NextLink({
			label,
			tooltip: '',
			users
		})
	}

	// Friend links
	findFriendLinksTo(needle:string): string[]{ 
		return this.access.linkRepo.entries()
			.filter(([_,links])=>links.indexOf(needle)!=-1)
			.map(([username,])=>username);
	}

	// scans saved users for next person missing viewDate 
	missingViewDateUsers(sortLongestOutageFirst=false): NextLink{
		const pageOwner = UserStore.pageOwnerName;

		const yearSorter = sortLongestOutageFirst
			? by<LastYear,number>(x=>x.lastYear)
			: byDesc<LastYear,number>(x=>x.lastYear);

		const users = this._userRepo.entries()
			.filter(([u,v]) => typeof v.stars === "number" && 2<=v.stars && v.stars<=5 // 1 is 'ignored'
					&& v.viewDate==undefined
					&& u != pageOwner // this may be called before current .viewDate is set.
				)
			.map(x=>new LastYear(x))
			.sort(yearSorter.thenBy(x=>x.lastCount).thenBy(x=>x.username))
			.map(ly=>this.get(ly.username));
		return new NextLink({ label: 'missing view-date', tooltip: 'No view-date recorded.', users });
	}

	// Scans users for next person to prune 
	toPrune(yearsWithoutDownload=4): NextLink{
		const toPrune = this.toPruneUsers(yearsWithoutDownload);
		return new NextLink({
			label:'to prune',
			tooltip:`No downloads in last ${yearsWithoutDownload} years.`,
			users:toPrune,
		});
	}

	// Helper - exposes users for pruning so we can do them in batch
	toPruneUsers(yearsWithoutDownload=4): UserCtx[]{
		const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;

		return this._userRepo.entries()
			.filter(([,v]) => typeof v.stars === "number" && 2<=v.stars&&v.stars<=5 // 1 is 'ignored'
				&& v.viewDate !== undefined // was viewed
			)
			.map(x=>new LastYear(x))
			.filter( ({lastYear}) => lastYear<earliestEmptyYear )
			.sort(by<LastYear,number>(x=>x.lastYear).thenBy(x=>x.lastCount).thenBy(x=>x.username))
			.map(ly => this.get(ly.username));
	}

}
