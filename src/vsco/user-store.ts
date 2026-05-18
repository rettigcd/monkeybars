import { by, byDesc } from "~/lib/sorting";
import { linkRepo, newImageRepo, userRepo } from "./local-storage";
import { ImageModel } from "./models/image-model";
import type { UserStatusType } from "./types/types";
import { UserCtx } from "./user-ctx";
import { NextLink } from "./views/next-link";
import { pageOwnerName } from "./vscoDom";

export class UserStore {

	public static pageOwnerName: string|undefined = pageOwnerName; // init from vscoDom.ts

	private readonly _cache: Record<string, UserCtx> = {};

	constructor(
		private readonly track: (imgModel:ImageModel) => void
	) {}

	get(username: string): UserCtx {
		return this._cache[username]
			??= new UserCtx(username, this.track);
	}

	getMany(usernames: string[]): UserCtx[] {
		return usernames.map(username => this.get(username));
	}

	get allUsers(): UserCtx[] {
		return userRepo.keys()
			.map(username => this.get(username));
	}

	// Users with FOUND new Images
	get newImageUsers(): UserCtx[] {
		return newImageRepo.keys()
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
		return linkRepo.entries()
			.filter(([_,links])=>links.indexOf(needle)!=-1)
			.map(([username,])=>username);
	}

	// scans saved users for next person missing viewDate 
	missingViewDateUsers(sortLongestOutageFirst=false): NextLink{
		const pageOwner = UserStore.pageOwnerName;

		const yearSorter = sortLongestOutageFirst
			? by<UserCtx,number>(x=>x.data.lastYear)
			: byDesc<UserCtx,number>(x=>x.data.lastYear);

		const users = this.allUsers
			.filter(ctx => ctx.data.status === "following"
					&& ctx.data.viewDateMs === undefined
					&& ctx.data.username !== pageOwner
				)
			.sort(yearSorter.thenBy(x=>x.data.lastCount).thenBy(x=>x.username));
		return new NextLink({ label: 'missing view-date', tooltip: 'No view-date recorded.', users });
	}

	// Scans users for next person to prune 
	toPrune(): NextLink{
		const toPrune = this.toPruneUsers();
		return new NextLink({
			label:'to prune',
			tooltip:"No downloads in last few years.",
			users:toPrune,
		});
	}

	// Helper - exposes users for pruning so we can do them in batch
	toPruneUsers(): UserCtx[]{
		const yearsWithoutDownload = 4;
		const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;

		return this.allUsers
			.filter((ctx) => ctx.data.status=="following"
				&& ctx.data.viewDateMs !== undefined // was viewed
				&& ctx.data.lastYear<earliestEmptyYear
			)
			.sort(by<UserCtx,number>(x=>x.data.lastYear).thenBy(x=>x.data.lastCount).thenBy(x=>x.username))
			.map(ly => this.get(ly.username));
	}

}
