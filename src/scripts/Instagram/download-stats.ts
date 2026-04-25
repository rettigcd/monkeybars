import { type UserEntity } from "./repo-types";
import { loadTime, storageTime } from "./storage-time";

const now = new Date();
const thisYear = now.getFullYear();
const fractionOfPreviousYearToInclude = (storageTime.toNum(new Date(thisYear + 1, 0, 1)) - storageTime.toNum(now))
	/ (365 * storageTime.DAYS);

// Gets a rolling average of downloads in the last year, 
// giving partial credit to downloads in the previous year based on % of last year that was within last 365 days
export function calcDownloadsInLastYear(user: UserEntity) : number {
	const byYear = user.dl || {};
	return (byYear[thisYear] || 0)
		+ Math.round((byYear[thisYear - 1] || 0) * fractionOfPreviousYearToInclude);
};

// Sums up all downloads in the users history, regardless of when they were
export function getTotalDownloads(byYear:Record<string, number> = {}): number {
	return Object.values(byYear).reduce((sum, count) => sum + count, 0);
}

function strToFloat(str:string): number {
	function cc(a:string, i = 0) { return a.charCodeAt(i); }
	const v = [0, 1, 2].map((i) => {
		const k = str[i] || "0";
		const [b, o] =
			("0" <= k && k < "9") ? ["0", 1]
			: ("a" <= k && k < "z") ? ["a", 11]
			: [k, 0];
		return cc(str, i) - cc(b) + o;
	});
	return (v[0] * 37 * 37 + v[1] * 37 + v[2]) / (37 * 37 * 37);
}

// Returns a timestamp WHEN a user should be scanned.
export function getRefreshTime(x:UserEntity) : number {
	const downloads = calcDownloadsInLastYear(x);

	const { MONTHS, DAYS } = storageTime;
	const waitTime =
		  downloads >= 20 ? 1 * MONTHS
		: downloads >= 10 ? 2 * MONTHS
		: downloads >= 5 ? 3 * MONTHS
		: 6 * MONTHS;

	return (x.lastVisit || 0)
		+ waitTime
		+ Math.floor((strToFloat(x.username||"") - 0.5) * 14 * DAYS); // spread out over 2 weeks.
}

export function lastVisitOlderThanThresholdOrMissing(lastVisit: number | undefined, threshold: number): boolean {
	return !lastVisitWithinThreshold(lastVisit, threshold);
}

function lastVisitWithinThreshold(lastVisit: number | undefined, threshold: number): boolean {
	return loadTime <= (lastVisit || 0) + threshold;
}
