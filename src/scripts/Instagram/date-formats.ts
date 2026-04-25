import { throwExp } from "~/utils/throw";

function pad(x: number): string {
	return x < 10 ? `0${x}` : String(x);
}

// Return YYYYMMDDHHMMSS
export function formatDateForFilename(d: Date = throwExp("date")): string {
	const parts = [
		d.getFullYear(),
		d.getMonth() + 1,
		d.getDate(),
		d.getHours(),
		d.getMinutes(),
		d.getSeconds(),
	];

	return [
		String(parts[0]),
		...parts.slice(1).map(pad),
	].join("");
}