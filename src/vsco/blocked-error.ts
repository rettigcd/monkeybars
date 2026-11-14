// Cloudflare blocks: 429 = rate limit, 403/503 = challenge (Cloudflare sets cf-mitigated: challenge).

export type BlockKind = "rate-limit" | "challenge";

export class BlockedError extends Error {
	constructor(
		public readonly kind: BlockKind,
		public readonly status: number,
		public readonly retryAfter: string | null, // raw Retry-After header
		public readonly url: string,
		public readonly cfMitigated: string | null,
	) {
		super(`${kind === "rate-limit" ? "Rate limit" : "Challenge"} (HTTP ${status}) on ${url}`);
		this.name = "BlockedError";
	}
}

export function throwIfBlocked(resp: Response): void {
	const { status } = resp;
	if (status !== 429 && status !== 403 && status !== 503)
		return;
	throw new BlockedError(
		status === 429 ? "rate-limit" : "challenge",
		status,
		resp.headers.get("Retry-After"),
		resp.url,
		resp.headers.get("cf-mitigated"),
	);
}

// Retry-After is either seconds or an HTTP date.
export function describeRetryAfter(value: string | null): string {
	if (value === null || value.trim() === "")
		return "not provided";
	const trimmed = value.trim();
	const seconds = /^\d+$/.test(trimmed)
		? Number(trimmed)
		: Math.round((Date.parse(trimmed) - Date.now()) / 1000);
	if (Number.isNaN(seconds))
		return `"${trimmed}"`;
	const minutes = seconds >= 60 ? ` (~${Math.round(seconds / 60)} min)` : "";
	return `${seconds} seconds${minutes}`;
}

export function reportBlocked(err: BlockedError): void {
	const what = err.kind === "rate-limit"
		? "Cloudflare rate limit triggered"
		: "Cloudflare challenge triggered";
	const lines = [
		`${what} - scan stopped.`,
		`HTTP ${err.status}${err.cfMitigated ? `, cf-mitigated: ${err.cfMitigated}` : ""}`,
		`Retry-After: ${describeRetryAfter(err.retryAfter)}`,
		`URL: ${err.url}`,
	];
	console.error(lines.join("\n"));
	alert(lines.join("\n"));
}
