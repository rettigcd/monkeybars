import { by, byDesc } from "~/lib/sorting";
import { SyncedPersistentDict } from "~/lib/storage";
import { LastYear } from "./last-year";
import { ImageModel } from "./models/image-model";
import { NextLink } from "./next-link";
import { LocalStorageUserEntity } from "./types";
import { UserAccess } from "./user-access";
import { UserCtx } from "./user-ctx";

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

	// Scans for anyone marked as "queued" or "should-review"
	needsReview(): NextLink{
		const pageOwner = UserStore.pageOwnerName;
		const users = this.allUsers
			.filter(user => user.username!=pageOwner && user.data.status=="queued");
		function rnd(i:number): number{ return Math.floor(Math.random() * i); }
		return new NextLink({
			label:'for review',
			count: users.length,
			nextUrl: users.length ? users[rnd(users.length)]!.fetch.galleryUrl : undefined,
			tooltip: ''
		})
	}

	// Scans for anyone marked as "queued" or "should-review"
	failedUsers(): NextLink{
		const pageOwner = UserStore.pageOwnerName;
		const users = this.allUsers
			.filter(user => user.data.status == "failed" && user.data.username !== pageOwner);
		function rnd(i:number): number{ return Math.floor(Math.random() * i); }
		return new NextLink({
			label:'failed',
			count: users.length,
			nextUrl: users.length ? users[rnd(users.length)]!.fetch.galleryUrl : undefined,
			tooltip: ''
		})
	}


	findLinksTo(needle:string): string[]{ 
		return this.access.linkRepo.entries()
			.filter(([_,links])=>links.indexOf(needle)!=-1)
			.map(([username,])=>username);
	}

	// scans saved users for next person missing viewDate 
	missingViewDate(sortLongestOutageFirst=false): NextLink{
		const pageOwner = UserStore.pageOwnerName;

		const users = this._userRepo.entries()
			.filter(([u,v]) => typeof v.stars === "number" && 2<=v.stars && v.stars<=5 // 1 is 'ignored'
					&& v.viewDate==undefined
					&& u != pageOwner // this may be called before current .viewDate is set.
				)
			.map(x=>new LastYear(x))
			.sort(sortLongestOutageFirst
				? by<LastYear,number>(x=>x.lastYear).thenBy(x=>x.lastCount)
				: byDesc<LastYear,number>(x=>x.lastYear).thenByDesc(x=>x.lastCount)
			);
		const firstUser = users[0];
		return new NextLink({
			label: 'missing view-date',
			count: users.length,
			tooltip: 'No view-date recorded.',
			nextUrl: firstUser && `/${firstUser.username}/gallery` || undefined,
		});
	}

	// Scans users for next person to prune 
	toPrune(yearsWithoutDownload=4): NextLink{
		const pageOwner = UserStore.pageOwnerName;
		const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;
		const toPrune = this._userRepo.entries()
			.filter(([u,v]) => typeof v.stars === "number" && 2<=v.stars&&v.stars<=5 // 1 is 'ignored'
				&& v.viewDate !== undefined // was viewed
				&& u != pageOwner // this may be called before current .viewDate is set.
			)
			.map(x=>new LastYear(x))
			.filter( ({lastYear}) => lastYear<earliestEmptyYear )
			.sort(by<LastYear,number>(x=>x.lastYear).thenBy(x=>x.lastCount).thenBy(x=>x.username));
		const first = toPrune[0];
		return new NextLink({
			label:'to prune',
			count:toPrune.length,
			tooltip:`No downloads in last ${yearsWithoutDownload} years.`,
			nextUrl:first && `/${first.username}/gallery` || undefined
		});
	}

}
