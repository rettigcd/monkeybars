import { EpochTime } from "~/utils/epoch_time";

export const storageTime : EpochTime = EpochTime.JavascriptTime;

export const loadTimeMs = storageTime.now();


// Converts an age in milliseconds to a human-readable string and color.
// Used for displaying recency information in UI or logs.
export function timestampToAgeString(timestamp:number) : { ageText:string, ageColor:string } {
	const ageMs = loadTimeMs - timestamp;
	const daysOld = ageMs / storageTime.DAYS;

	const { divider, label, color: ageColor } =
		(daysOld < 3) ? { divider: 1, label: "day", color: "red" }
		: (daysOld < 14) ? { divider: 1, label: "day", color: "green" }
		: (daysOld < 365) ? { divider: 30, label: "month", color: "blue" }
		: { divider: 365, label: "year", color: "black" };

	const num = Math.floor(daysOld * 10 / divider) / 10;
	const s = (num != 1) ? "s" : "";
	const ageText = `${num} ${label}${s}`;
	return { ageText, ageColor };
}

// Logs the last visit time with a formatted age string and color coding.
// Used for debugging or displaying recency information in logs.
export function reportLast(lastVisit:number|undefined, label:string) {
	if (lastVisit !== undefined && 0 < lastVisit) {
		const lvd = storageTime.toDate(lastVisit).toDateString();
		const { ageText, ageColor } = timestampToAgeString(lastVisit);
		const ageStyle = `color:white;background-color:${ageColor};`;
		console.print(`Last ${label}: %c${ageText}%c ago on %c${lvd}`, ageStyle, "color:black;background-color:white;", ageStyle);
	}
}
