import { describe, expect, it } from "vitest";
import { formatPhotoDate, jpegSize, type KeiblerMetadata, writeJpegMetadata } from "./keibler-metadata";

// SOI, JFIF APP0, SOF0 (h=20,w=30), SOS, data, EOI
const jfif = [0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0];
const sof = [0xFF, 0xC0, 0x00, 0x0B, 8, 0x00, 20, 0x00, 30, 1, 0x11, 0x00];
const sos = [0xFF, 0xDA, 0x00, 0x04, 0x01, 0x00, 0x12, 0x34, 0xFF, 0xD9];
const jpeg = new Uint8Array([0xFF, 0xD8, ...jfif, ...sof, ...sos]);

const meta: KeiblerMetadata = { up: 0, tags: { instagram: ["bob", { v: "al", rect: "1,2,10,10" }] }, photoDate: "2025-12-10T14:32:00" };

function keiblerJson(bytes: Uint8Array): string {
	const id = [...new TextEncoder().encode("Keibler\0")];
	const idAt = bytes.findIndex((_, i) => id.every((b, j) => bytes[i + j] === b));
	const segEnd = idAt - 2 + ((bytes[idAt - 2] << 8) | bytes[idAt - 1]);
	return new TextDecoder().decode(bytes.subarray(idAt + id.length, segEnd)).trim();
}

describe("keibler-metadata", () => {
	it("reads jpeg size from SOF", () => {
		expect(jpegSize(jpeg)).toEqual({ w: 30, h: 20 });
	});

	it("inserts APP0 right after the first marker, padded to 512", () => {
		const out = writeJpegMetadata(jpeg, meta);
		const at = 2 + jfif.length;
		expect([...out.subarray(at, at + 2)]).toEqual([0xFF, 0xE0]);
		const length = (out[at + 2] << 8) | out[at + 3];
		expect(length - 2).toBe(8 + 512);
		expect(JSON.parse(keiblerJson(out))).toEqual(meta);
		expect(out.length).toBe(jpeg.length + 4 + 8 + 512);
		expect([...out.subarray(at + 2 + length)]).toEqual([...sof, ...sos]);
	});

	it("replaces an existing block instead of adding a second", () => {
		const once = writeJpegMetadata(jpeg, meta);
		const twice = writeJpegMetadata(once, { up: 0, photoDate: "2020-01-01T00:00:00" });
		expect(twice.length).toBe(once.length);
		expect(JSON.parse(keiblerJson(twice))).toEqual({ up: 0, photoDate: "2020-01-01T00:00:00" });
	});

	it("formats photoDate", () => {
		expect(formatPhotoDate(new Date(2025, 11, 10, 4, 5, 6))).toBe("2025-12-10T04:05:06");
	});
});
