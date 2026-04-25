import { by, byDesc } from "~/utils/sorting";
import { calcDownloadsInLastYear, getRefreshTime, lastVisitOlderThanThresholdOrMissing } from "./download-stats";
import { ImageLookupByUrl } from "./models";
import type { UserEntity, UserRepo } from "./repo-types";
import { loadTime, storageTime } from "./storage-time";

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
