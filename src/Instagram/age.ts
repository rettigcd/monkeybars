import { con } from "~/lib/console";
import { DAYS, WEEKS, YEARS } from "~/lib/time";

export const loadTimeMs = Date.now();

export function getAgeColor(ageType:AgeType): string {
	return {
		"days" : "red",
		"weeks" : "green",
		"months" : "blue",
		"years" : "black"
	}[ageType];
}

export type AgeType = "days" | "weeks" | "months" | "years";

// Buckets a signed age (in ms, +/- from whatever reference point the caller chose) into a scale.
export function getAgeTypeFromMs(ageMs: number): AgeType {
	const absMs = Math.abs(ageMs);
	return (absMs < 3 * DAYS)  ? "days"	// 0..3 days => days
		: (absMs < 2 * WEEKS)  ? "weeks"// 3 days .. 2 weeks => weeks
		: (absMs < 1 * YEARS) ? "months"// 2 weeks .. 12 months => months
		: "years";
}

export function getAgeType(timestamp:number): AgeType {
	return getAgeTypeFromMs(loadTimeMs - timestamp);
}

// Formats a signed age (in ms) at the given scale, e.g. "3.2 months". Pass
// showSign to prefix "+"/"-" (useful when the age can be negative, e.g. an
// offset from some reference point other than "now").
export function formatAgeMs(ageMs: number, ageType: AgeType, showSign = false): string {
	const { divider, label } = {
		"days"   : { divider:   1*DAYS, label: "day" },
		"weeks"  : { divider:   1*DAYS, label: "day" },	// even though asking for weeks, display days instead
		"months" : { divider:  30*DAYS, label: "month" },
		"years"  : { divider: 365*DAYS, label: "year" }
	}[ageType];
	const num = Math.floor(Math.abs(ageMs) * 10 / divider) / 10;
	const s = (num != 1) ? "s" : "";
	const sign = showSign ? (ageMs < 0 ? "-" : "+") : "";
	return `${sign}${num} ${label}${s}`;
}

export function getAgeText(timestamp:number, ageType:AgeType) {
	return formatAgeMs(loadTimeMs - timestamp, ageType);
}

export type GetAgeTextFn = typeof getAgeText;

export type AgeInfo = { ageType: AgeType; text: string };
export type GetAgeInfoFn = (dateMs: number) => AgeInfo;

// Buckets and formats a timestamp's age relative to "now". Gallery uses this
// by default; pages that want ages relative to something else (e.g. lastVisit)
// can supply their own GetAgeInfoFn so the bucket and the number stay in sync.
export function getAgeInfo(timestamp: number): AgeInfo {
	const ageMs = loadTimeMs - timestamp;
	const ageType = getAgeTypeFromMs(ageMs);
	return { ageType, text: formatAgeMs(ageMs, ageType) };
}


// Logs the last visit time with a formatted age string and color coding.
// Used for debugging or displaying recency information in logs.
export function reportLast(lastVisitMs:number|undefined, label:string) {
	if (lastVisitMs !== undefined && 0 < lastVisitMs) {
		const lvd = new Date(lastVisitMs).toDateString();

		const ageType = getAgeType(lastVisitMs);
		const ageText = getAgeText(lastVisitMs,ageType);
		const ageStyle = `color:white;background-color:${getAgeColor(ageType)};`; // !!! move to CSS
		con.print(`Last ${label}: %c${ageText}%c ago on %c${lvd}`, ageStyle, "color:black;background-color:white;", ageStyle);
	}
}
