import { groupBy } from "~/lib/sorting";
import { UserCtx, type DownloadState, type NotVisited, type UserState, type Visited, type Visited_SansDownloads, type Visited_WithDownloads, type VisitState } from "./user-ctx";

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
		recent: UserCtx[];
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
	followeeCount: number;
	queuedCount: number;
};


export function makeStatusGroupTree(): StatusGroupTree {
	const pairs: Array<[UserCtx,UserState]> = UserCtx.allUsers()
		.map(ctx=>([ctx,ctx.state]));
	const byVisit = groupBy<[UserCtx,UserState],VisitState>(pairs,([,s])=>s.visit);
	// Not Visited
	const notVisited: Array<[UserCtx,NotVisited]> = (byVisit.none || []) as Array<[UserCtx,NotVisited]>;
	const notVisitedHas = groupBy<[UserCtx,NotVisited],"downloads" | "followee" | "nothing">(notVisited,([,status])=>status.has);
	// Visited
	const visited: Array<[UserCtx,Visited]> = [...(byVisit.recent||[]),...(byVisit.stale||[])] as Array<[UserCtx,Visited]>;
	const byDownloads = groupBy<[UserCtx,Visited],DownloadState>(visited,([,status])=>status.downloads);
	// Visited - has downloads
	const hasDownloads = [...(byDownloads.producing||[]), ...(byDownloads.idle||[])] as Array<[UserCtx,Visited_WithDownloads]>;
	const notDownloads = (byDownloads.none || []) as Array<[UserCtx,Visited_SansDownloads]>;
	const notDownloadedHas = groupBy<[UserCtx,Visited_SansDownloads],"followee" | "nothing">(notDownloads,([,status])=>status.has);
	// !!! TODO: add simple Following / Not Following counts
	// !!! TODO: add queued/saved-for-later counts

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
			recent: (byVisit.recent || []).map(x=>x[0]),
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
		},
		followeeCount: pairs.filter(x=>x[0].isFollowing).length,
		queuedCount: (localStorage.getItem("newOwners")||"").split("\r\n").length
	};
}
