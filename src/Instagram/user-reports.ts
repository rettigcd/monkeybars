import { makeStackedBar } from "~/lib/charts";
import { con } from "~/lib/console";
import { groupBy } from "~/lib/sorting";
import { DAYS } from "~/lib/time";
import { lastVisitOlderThanThresholdOrMissing } from "./services/download-stats";
import { UserCtx } from "./user-ctx";

type UserFilter = (x: UserCtx) => boolean;
type TimedUserFilter = (timeframe: number) => UserFilter;

export const filters = {
	followed: {
		stale: (timeframe: number) => (x: UserCtx) => !!x.isFollowing && lastVisitOlderThanThresholdOrMissing(x.lastVisit, timeframe),
		public: (x: UserCtx) => !!x.isFollowing && !x.isPrivate,
	},
	tracked: {
		all: (x: UserCtx) => !x.isFollowing,
		stale: (timeframe: number) => (x: UserCtx) => !x.isFollowing && !x.isPrivate && lastVisitOlderThanThresholdOrMissing(x.lastVisit, timeframe),
		private: (x: UserCtx) => !x.isFollowing && !!x.isPrivate,
	},
	downloaded: {
		all: (x: UserCtx) => 0 < x.downloadsInLastYear,
		stale: (x: UserCtx) => 0 < x.downloadsInLastYear && x.isStale,
	},
} satisfies {
	followed: {
		stale: TimedUserFilter;
		public: UserFilter;
	};
	tracked: {
		all: UserFilter;
		stale: TimedUserFilter;
		private: UserFilter;
	};
	downloaded: {
		all: UserFilter;
		stale: UserFilter;
	};
};


// Generates a bar chart showing how big each group of users is.
type UserStatsCategory =
	| "missing_both"
	| "missing_dl"
	| "missing_lastVisit"
	| "complete:stale"
	| "complete:fresh";

const statParts: Array<{ label: UserStatsCategory; color: string }> = [
	{ label: "missing_both", color: "red" },
	{ label: "missing_lastVisit", color: "orange" },
	{ label: "missing_dl", color: "yellow" },
	{ label: "complete:stale", color: "blue" },
	{ label: "complete:fresh", color: "green" },
];

export function showStats(): void {
	const grouped = groupBy(UserCtx.allUsers(), classifyUserStats);

	con.print( statParts.map(({ label }) => [label, grouped[label]?.length ?? 0]) );

	const bar = makeStackedBar(
		statParts.map(({ label, color }) => ({ label, color, count: grouped[label]?.length ?? 0, }))
	);

	document.body.appendChild(bar);
}

function classifyUserStats(user: UserCtx): UserStatsCategory {
	const mdl = user.cloneLocalStorage().dl == null; // !!!
	const mlv = user.lastVisit === undefined;
	if (mdl && mlv) return "missing_both";
	if (mdl) return "missing_dl";
	if (mlv) return "missing_lastVisit";
	return lastVisitOlderThanThresholdOrMissing(user.lastVisit, 60 * DAYS)
		? "complete:stale"
		: "complete:fresh";
}