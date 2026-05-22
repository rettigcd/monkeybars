import { groupBy } from "~/lib/sorting";
import { UserCtx, type NotVisited, type SansDownloads, type UserStatus, type Visited, type WithDownloads } from "./user-ctx";

export type StatusGroupTree = {
	total: number;
	notVisited: {
		total: number;
		has: {
			downloads: UserCtx[];
			followee: UserCtx[];
			nothing: UserCtx[];
		},
	},
	visited: {
		total: number;
		fresh: UserCtx[];
		stale: UserCtx[];
		hasDownloads : {
			total: number;
			producing: UserCtx[];
			idle: UserCtx[];
		},
		noDownloads : {
			total: number;
			has: {
				followee: UserCtx[];
				nothing: UserCtx[];
			},
		}
	}
};


export function makeStatusGroupTree(): StatusGroupTree {
	const pairs: Array<[UserCtx,UserStatus]> = UserCtx.allUsers()
		.map(ctx=>([ctx,ctx.myStatus]));
	const byVisit = groupBy<[UserCtx,UserStatus],string>(pairs,([,s])=>s.visit);
	// Not Visited
	const notVisited: Array<[UserCtx,NotVisited]> = (byVisit.none || []) as Array<[UserCtx,NotVisited]>;
	const notVisitedHas = groupBy<[UserCtx,NotVisited],string>(notVisited,([,status])=>status.has);
	// Visited
	const visited: Array<[UserCtx,Visited]> = [...(byVisit.fresh||[]),...(byVisit.stale||[])] as Array<[UserCtx,Visited]>;
	const byDownloads = groupBy<[UserCtx,Visited],string>(visited,([,status])=>status.downloads);
	// Visited - has downloads
	const hasDownloads = [...(byDownloads.producing||[]), ...(byDownloads.idle||[])] as Array<[UserCtx,WithDownloads]>;
	const notDownloads = (byDownloads.none || []) as Array<[UserCtx,SansDownloads]>;
	const notDownloadedHas = groupBy<[UserCtx,SansDownloads],string>(notDownloads,([,status])=>status.has);
	// const downloads = get from byDownloads...
	return {
		total: pairs.length,
		notVisited: {
			total: notVisited.length,
			has: {
				downloads:(notVisitedHas.downloads||[]).map(x=>x[0]),
				followee:(notVisitedHas.followee||[]).map(x=>x[0]),
				nothing:(notVisitedHas.nothing||[]).map(x=>x[0]),
			},
		},
		visited: {
			total: visited.length,
			fresh: (byVisit.fresh || []).map(x=>x[0]),
			stale: (byVisit.stale || []).map(x=>x[0]),
			hasDownloads : {
				total: hasDownloads.length,
				producing: (byDownloads.producing||[]).map(x=>x[0]),
				idle: (byDownloads.idle||[]).map(x=>x[0]),
			},
			noDownloads : {
				total: notDownloads.length,
				has: {
					followee:(notDownloadedHas.followee||[]).map(x=>x[0]),
					nothing:(notDownloadedHas.nothing||[]).map(x=>x[0]),
				},
			}
		}
	};
}
