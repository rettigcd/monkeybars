import { throwNever } from "./throw";

const mS = 1; // Native to Javascript. Ticks are ms.
const SECONDS = 1000 * mS;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAYS = 24 * HOURS;
const [WEEKS, MONTHS, YEARS] = [7 * DAYS, 30 * DAYS, 365 * DAYS] as const;

export { DAYS, HOURS, MINUTES, MONTHS, mS, SECONDS, WEEKS, YEARS };

export function assertMs(ms:number,label:string):number{
	const type = getTimeNumType(ms);
	if(type !== "milliseconds" ) throw new Error(`${label} is in ${type}`);
	return ms;
}

export function toMs(num: number): number {
	const t = getTimeNumType(num);
	switch(t){
		case "milliseconds": return num * mS;
		case "seconds": return num * SECONDS;
		case "minutes": return num * MINUTES;
		default: throwNever(t);
	}
}

type TimeNumType = "milliseconds" | "minutes" | "seconds";

// Minutes takes      8 bytes to store
// Seconds takes  9..10 bytes to store
// mS      takes 12..13 bytes to store
export function getTimeNumType(ts: number): TimeNumType {
	// Jan 1, 1990 in minutes                5_259_180
	// Jan 1, 2150 in minutes               94_671_660
	// 1e8   ----------------              100_000_000
	// Jan 1, 1980 in seconds              315_550_800
	// Jan 1, 2100 in seconds            4_102_444_800
	// Jan 1, 2200 in seconds            7_258_136_400
	// 1e11  ----------------          100_000_000_000
	// Jan 1, 1980 in milli-seconds    315_550_800_000
	// Jan 1, 2100 in milli-seconds  4_102_444_800_000
	// Jan 1, 2200 in milli-seconds  7_258_136_400_000
	return (ts < 1e8) ? "minutes"
		:  (ts < 1e11) ? "seconds"
		:  "milliseconds";
}
