import { DAYS } from "~/lib/time";
import { type LocalStorageUserEntity } from "../local-storage";
import { loadTimeMs } from "./storage-time";

const now = new Date();
const thisYear = now.getFullYear();
const fractionOfPreviousYearToInclude = (new Date(thisYear + 1, 0, 1).valueOf() - now.valueOf())
	/ (365 * DAYS);

// Gets a rolling average of downloads in the last year, 
// giving partial credit to downloads in the previous year based on % of last year that was within last 365 days
export function calcDownloadsInLastYear(user: LocalStorageUserEntity) : number {
	const byYear = user.dl || {};
	return (byYear[thisYear] || 0)
		+ Math.round((byYear[thisYear - 1] || 0) * fractionOfPreviousYearToInclude);
};

// Sums up all downloads in the users history, regardless of when they were
export function getTotalDownloads(byYear:Record<string, number> = {}): number {
	return Object.values(byYear).reduce((sum, count) => sum + count, 0);
}

export function lastVisitOlderThanThresholdOrMissing(lastVisit: number | undefined, threshold: number): boolean {
	return !lastVisitWithinThreshold(lastVisit, threshold);
}

function lastVisitWithinThreshold(lastVisit: number | undefined, threshold: number): boolean {
	return loadTimeMs <= (lastVisit || 0) + threshold;
}
