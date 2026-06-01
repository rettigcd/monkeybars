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

export function getAgeType(timestamp:number): AgeType {
	const ageMs = loadTimeMs - timestamp;
	return (ageMs < 3 * DAYS)  ? "days"	// 0..3 days => days
		: (ageMs < 2 * WEEKS)  ? "weeks"// 3 days .. 2 weeks => weeks
		: (ageMs < 1 * YEARS) ? "months"// 2 weeks .. 12 months => months
		: "years";
}

export function getAgeText(timestamp:number, ageType:AgeType) {
	const ageMs = loadTimeMs - timestamp;
	const { divider, label } = {
		"days"   : { divider:   1*DAYS, label: "day" },
		"weeks"  : { divider:   1*DAYS, label: "day" },	// even though asking for weeks, display days instead
		"months" : { divider:  30*DAYS, label: "month" },
		"years"  : { divider: 365*DAYS, label: "year" }
	}[ageType];
	const num = Math.floor(ageMs * 10 / divider) / 10;
	const s = (num != 1) ? "s" : "";
	return `${num} ${label}${s}`;
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
