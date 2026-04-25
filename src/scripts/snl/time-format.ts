// Shared time constants (kept local to this module)
export const SECONDS = 1000;
export const MINUTES = 60 * SECONDS;
export const HOURS = 60 * MINUTES;
export const DAYS = 24 * HOURS;

/**
 * Formats a Date into a compact timestamp string: YYYYMMDD_HHMMSS
 */
export function dateTimeStr(d: Date = new Date()): string {
	function pad(x: number): string {
		return `${x < 10 ? "0" : ""}${x}`;
	}

	return d.getFullYear()
		+ pad(d.getMonth() + 1)
		+ pad(d.getDate())
		+ "_"
		+ pad(d.getHours())
		+ pad(d.getMinutes())
		+ pad(d.getSeconds());
}

/**
 * Formats a millisecond offset into a human-readable string like:
 * +1:23:45.6 or -12.3
 */
export function formatSeconds(mS: number | undefined): string {
	if (mS === undefined)
		return "";

	const prefix = mS < 0 ? "-" : "+";
	if (mS < 0)
		mS = -mS;

	let x = Math.floor((mS * 10) / SECONDS);

	function rem(d: number, pad = true): string | number {
		const r = x % d;
		x = (x - r) / d;
		return r < 10 && pad ? `0${r}` : r;
	}

	const t = rem(10, false);
	const s = rem(60);
	const m = rem(60);
	const h = rem(24);

	return x !== 0   ? `${prefix}${x} ${h}:${m}:${s}.${t}`
		: h !== "00" ? `${prefix}${h}:${m}:${s}.${t}`
		: m !== "00" ? `${prefix}${m}:${s}.${t}`
		: `${prefix}${s}.${t}`;
}

export function getNextThursday10Am(msDelayRaw: string | number | undefined): Date {
	const msDelay = Number(msDelayRaw ?? 0) || 0;
	const date = new Date();
	const daysFromNow = ((7 + 4) - date.getDay()) % 7;
	const targetDate = new Date(date.valueOf() + daysFromNow * DAYS);
	const yyyy = targetDate.getFullYear();
	const mm = targetDate.getMonth();
	const dd = targetDate.getDate();
	const ms = msDelay % 1000;
	const s = (msDelay - ms) / 1000;
	return new Date(yyyy, mm, dd, 10, 0, s, ms);
}
