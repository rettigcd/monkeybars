import { describe, expect, it } from "vitest";
import { BlockedError, describeRetryAfter, throwIfBlocked } from "./blocked-error";

const resp = (status: number, headers: Record<string, string> = {}) => new Response(null, { status, headers });

describe("blocked-error", () => {
	it("ignores normal responses", () => {
		expect(() => throwIfBlocked(resp(200))).not.toThrow();
		expect(() => throwIfBlocked(resp(404))).not.toThrow();
	});

	it("treats 429 as a rate limit and keeps Retry-After", () => {
		try { throwIfBlocked(resp(429, { "Retry-After": "120" })); expect.unreachable(); }
		catch (err) {
			expect(err).toBeInstanceOf(BlockedError);
			expect((err as BlockedError).kind).toBe("rate-limit");
			expect((err as BlockedError).retryAfter).toBe("120");
		}
	});

	it("treats 403 and 503 as a challenge", () => {
		for (const status of [403, 503]) {
			try { throwIfBlocked(resp(status, { "cf-mitigated": "challenge" })); expect.unreachable(); }
			catch (err) {
				expect((err as BlockedError).kind).toBe("challenge");
				expect((err as BlockedError).cfMitigated).toBe("challenge");
			}
		}
	});

	it("describes Retry-After", () => {
		expect(describeRetryAfter(null)).toBe("not provided");
		expect(describeRetryAfter("30")).toBe("30 seconds");
		expect(describeRetryAfter("600")).toBe("600 seconds (~10 min)");
		// HTTP dates drop milliseconds, so allow a couple of seconds of slack
		expect(describeRetryAfter(new Date(Date.now() + 90_000).toUTCString())).toMatch(/^(88|89|90) seconds \(~(1|2) min\)$/);
	});
});
