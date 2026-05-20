// src/lib/char-to-number.test.ts
import { describe, expect, it } from "vitest";
import { charTo64 } from "./user-ctx";

describe("charToNumber", () => {
	it("maps expected characters", () => {
		expect(charTo64("0")).toBe(0);
		expect(charTo64("9")).toBe(9);
		expect(charTo64("A")).toBe(10);
		expect(charTo64("Z")).toBe(35);
		expect(charTo64("a")).toBe(36);
		expect(charTo64("z")).toBe(61);
		expect(charTo64("_")).toBe(62);
		expect(charTo64("-")).toBe(63);
		expect(charTo64(".")).toBe(64);
	});

	it("returns 0 for unsupported characters", () => {
		expect(charTo64("@")).toBe(0);
	});
});