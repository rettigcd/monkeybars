import { makeStackedBar } from "~/lib/charts";
import { con } from "~/lib/console";
import { by, byDesc, groupBy } from "~/lib/sorting";
import { calcDownloadsInLastYear, getRefreshTime, lastVisitOlderThanThresholdOrMissing } from "./services/download-stats";
import { ImageLookupByUrl } from "./services/image-lookup-by-url";
import { loadTime, storageTime } from "./services/storage-time";
import type { UserEntity, UserRepo } from "./types/repo-types";

type UserFilter = (x: UserEntity) => boolean;
type TimedUserFilter = (timeframe: number) => UserFilter;

export const filters = {
	followed: {
		stale: (timeframe: number) => (x: UserEntity) => !!x.isFollowing && lastVisitOlderThanThresholdOrMissing(x.lastVisit, timeframe),
		public: (x: UserEntity) => !!x.isFollowing && !x.isPrivate,
	},
	tracked: {
		all: (x: UserEntity) => !x.isFollowing,
		stale: (timeframe: number) => (x: UserEntity) => !x.isFollowing && !x.isPrivate && lastVisitOlderThanThresholdOrMissing(x.lastVisit, timeframe),
		private: (x: UserEntity) => !x.isFollowing && !!x.isPrivate,
	},
	downloaded: {
		all: (x: UserEntity) => 0 < calcDownloadsInLastYear(x),
		stale: (x: UserEntity) => 0 < calcDownloadsInLastYear(x) && getRefreshTime(x) < loadTime,
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


type UserReportsConstructorArgs = {
	userRepo: UserRepo
	iiLookup: ImageLookupByUrl,
}

export class UserReports {

	followed: any;
	tracked: any;
	downloaded: any;

	private iiLookup;

	constructor({
		userRepo,
		iiLookup,
	}:UserReportsConstructorArgs) {
		this.iiLookup = iiLookup;

		function showUsers(filter: UserFilter) { return userRepo.values().filter(filter); }

		const { DAYS } = storageTime;

		this.followed = {
			stale: (notVisitedDays = 60) => showUsers(filters.followed.stale(notVisitedDays * DAYS)).sort(by((x) => x.lastVisit || 0)),
			public: () => showUsers(filters.followed.public),
		};

		this.tracked = {
			stale: (notVisitedDays = 60) => showUsers(filters.tracked.stale(notVisitedDays * DAYS)).sort(by((x) => x.lastVisit || 0)),
			all: () => showUsers(filters.tracked.all).sort(by((x) => x.username)),
			private: () =>showUsers(filters.tracked.private).sort(by((x) => x.username)),
		};

		this.downloaded = {
			all: () => showUsers(filters.downloaded.all).sort(byDesc(calcDownloadsInLastYear).thenBy(getRefreshTime)),
			stale: () => showUsers(filters.downloaded.stale).sort(byDesc(calcDownloadsInLastYear).thenBy(getRefreshTime)),
		};

	}

	dayOfWeek () {
		const counts = [0, 0, 0, 0, 0, 0, 0];
		const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

		const imageDays = this.iiLookup.allImages()
			.filter((x) => x.date != null)
			.map((x) => x.date.getDay());

		for (const day of imageDays)
			counts[day]++;

		return counts.map((count, idx) => [dayNames[idx], count]);
	};

}


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

export function showStats(userRepo: UserRepo): void {
	const grouped = groupBy(userRepo.values(), classifyUserStats);

	con.print( statParts.map(({ label }) => [label, grouped[label]?.length ?? 0]) );

	const bar = makeStackedBar(
		statParts.map(({ label, color }) => ({ label, color, count: grouped[label]?.length ?? 0, }))
	);

	document.body.appendChild(bar);
}

function classifyUserStats(user: UserEntity): UserStatsCategory {
	const mdl = user.dl == null;
	const mlv = user.lastVisit == null;
	if (mdl && mlv) return "missing_both";
	if (mdl) return "missing_dl";
	if (mlv) return "missing_lastVisit";
	return lastVisitOlderThanThresholdOrMissing(user.lastVisit, 60 * DAYS)
		? "complete:stale"
		: "complete:fresh";
}