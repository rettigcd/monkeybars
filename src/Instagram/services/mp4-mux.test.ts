import { describe, expect, it } from "vitest";
import { childBoxes, findBox, muxAudioIntoVideo, readBoxes } from "./mp4-mux";

// ---- tiny fragmented-MP4 builder (only the fields the muxer reads) ----

const u32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); return b; };
const u64 = (n: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, BigInt(n)); return b; };
const zeros = (n: number) => new Uint8Array(n);
const concat = (parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
	let pos = 0;
	for (const p of parts) { out.set(p, pos); pos += p.length; }
	return out;
};
const box = (type: string, ...parts: Uint8Array[]) =>
	concat([u32(8 + parts.reduce((s, p) => s + p.length, 0)), Uint8Array.from(type, c => c.charCodeAt(0)), ...parts]);
const fullBox = (type: string, version: number, flags: number, ...parts: Uint8Array[]) =>
	box(type, Uint8Array.of(version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255), ...parts);

const NON_SYNC = 0x10000;
type SampleSpec = { payload: number[]; duration: number; flags?: number };
type FileSpec = {
	movieTimescale: number;
	mediaTimescale: number;
	edit?: { segmentDuration: number; mediaTime: number }; // segmentDuration in movie timescale
	frags: { time: number; samples: SampleSpec[] }[]; // time in media timescale
	absoluteBaseOffsets?: boolean;
};

function makeFile({ movieTimescale, mediaTimescale, edit, frags, absoluteBaseOffsets }: FileSpec): Uint8Array {
	const mvhd = fullBox("mvhd", 0, 0, zeros(8), u32(movieTimescale), u32(0), zeros(76), u32(2));
	const tkhd = fullBox("tkhd", 0, 3, zeros(8), u32(1), u32(0), u32(0), zeros(60));
	const edts = edit ? [box("edts", fullBox("elst", 0, 0, u32(1), u32(edit.segmentDuration), u32(edit.mediaTime), u32(0x10000)))] : [];
	const mdhd = fullBox("mdhd", 0, 0, zeros(8), u32(mediaTimescale), u32(0), zeros(4));
	const stbl = box("stbl", fullBox("stsd", 0, 0, u32(0)), fullBox("stts", 0, 0, u32(0)));
	const trak = box("trak", tkhd, ...edts, box("mdia", mdhd, box("minf", stbl)));
	const mvex = box("mvex", fullBox("trex", 0, 0, u32(1), u32(1), zeros(12)));

	const parts = [box("ftyp", Uint8Array.from("dash", c => c.charCodeAt(0)), u32(0)), box("moov", mvhd, trak, mvex), box("sidx", zeros(24))];
	let pos = parts.reduce((s, p) => s + p.length, 0);

	frags.forEach(({ time, samples }, i) => {
		const moofFor = (dataOffset: number) => box("moof",
			fullBox("mfhd", 0, 0, u32(i + 1)),
			box("traf",
				absoluteBaseOffsets
					? fullBox("tfhd", 0, 0x1, u32(1), u64(pos))
					: fullBox("tfhd", 0, 0x020000, u32(1)),
				fullBox("tfdt", 1, 0, u64(time)),
				fullBox("trun", 0, 0x1 | 0x100 | 0x200 | 0x400, u32(samples.length), u32(dataOffset),
					...samples.flatMap(s => [u32(s.duration), u32(s.payload.length), u32(s.flags ?? 0)]))));
		const moofSize = moofFor(0).length;
		const fragment = concat([moofFor(moofSize + 8), box("mdat", Uint8Array.from(samples.flatMap(s => s.payload)))]);
		parts.push(fragment);
		pos += fragment.length;
	});
	return concat(parts);
}

// ---- output inspection (regular MP4) ----

const getU32 = (b: Uint8Array, at: number) => new DataView(b.buffer, b.byteOffset).getUint32(at);
const getU64 = (b: Uint8Array, at: number) => Number(new DataView(b.buffer, b.byteOffset).getBigUint64(at));
const table = (out: Uint8Array, at: number, count: number, width: number) =>
	Array.from({ length: count }, (_, i) => Array.from({ length: width }, (_, j) => getU32(out, at + (i * width + j) * 4)));

function readTracks(out: Uint8Array) {
	const moov = readBoxes(out).find(b => b.type === "moov")!;
	return childBoxes(out, moov).filter(b => b.type === "trak").map(trak => {
		const stbl = findBox(out, trak, "mdia", "minf", "stbl")!;
		const at = (type: string) => findBox(out, stbl, type)!.start + 12; // after header + version/flags
		const sizes = table(out, at("stsz") + 8, getU32(out, at("stsz") + 4), 1).map(([s]) => s);
		const offsets = table(out, at("stco") + 4, getU32(out, at("stco")), 1).map(([o]) => o);
		const stsc = table(out, at("stsc") + 4, getU32(out, at("stsc")), 3);
		const stts = table(out, at("stts") + 4, getU32(out, at("stts")), 2);
		const stssBox = findBox(out, stbl, "stss");
		const sync = stssBox ? table(out, at("stss") + 4, getU32(out, at("stss")), 1).map(([n]) => n) : undefined;

		const payloads: number[][] = [];
		offsets.forEach((offset, chunk) => {
			const perChunk = stsc.filter(([first]) => first <= chunk + 1).pop()![1];
			for (let k = 0; k < perChunk; ++k) {
				const size = sizes[payloads.length];
				payloads.push([...out.subarray(offset, offset + size)]);
				offset += size;
			}
		});

		const tkhd = findBox(out, trak, "tkhd")!, mdhd = findBox(out, trak, "mdia", "mdhd")!;
		const elst = findBox(out, trak, "edts", "elst");
		return {
			id: getU32(out, tkhd.start + 20),
			tkhdDuration: getU32(out, tkhd.start + 28),
			mdhdDuration: getU32(out, mdhd.start + 24),
			durations: stts.flatMap(([count, d]) => Array(count).fill(d)),
			edit: elst && { segmentDuration: getU64(out, elst.start + 16), mediaTime: getU64(out, elst.start + 24) },
			offsets,
			payloads,
			sync,
		};
	});
}

const video = (extra: Partial<FileSpec> = {}) => makeFile({
	movieTimescale: 1000, mediaTimescale: 100,
	frags: [
		{ time: 0, samples: [{ payload: [1, 1], duration: 100 }, { payload: [1, 2], duration: 100, flags: NON_SYNC }] },
		{ time: 200, samples: [{ payload: [1, 3], duration: 100 }, { payload: [1, 4], duration: 100, flags: NON_SYNC }] },
	],
	...extra,
});
const audio = (extra: Partial<FileSpec> = {}) => makeFile({
	movieTimescale: 44100, mediaTimescale: 1000,
	edit: { segmentDuration: 0, mediaTime: 100 }, // "until the end", skipping 0.1s of priming
	frags: [
		{ time: 0, samples: [{ payload: [2, 1, 9], duration: 500 }, { payload: [2, 2, 9], duration: 500 }] },
		{ time: 1000, samples: [{ payload: [2, 3, 9], duration: 1000 }] },
		{ time: 2000, samples: [{ payload: [2, 4, 9], duration: 1000 }, { payload: [2, 5, 9], duration: 1000 }] },
	],
	...extra,
});

describe("muxAudioIntoVideo", () => {
	it("produces a regular MP4: ftyp, moov, mdat - no fragments, sidx or mvex", () => {
		const out = muxAudioIntoVideo(video(), audio());
		expect(readBoxes(out).map(b => b.type)).toEqual(["ftyp", "moov", "mdat"]);
		const moov = readBoxes(out)[1];
		expect(childBoxes(out, moov).map(b => b.type)).toEqual(["mvhd", "trak", "trak"]);
	});

	it("numbers tracks 1 and 2 and copies every sample payload intact, in order", () => {
		const [v, a] = readTracks(muxAudioIntoVideo(video(), audio()));
		expect([v.id, a.id]).toEqual([1, 2]);
		expect(v.payloads).toEqual([[1, 1], [1, 2], [1, 3], [1, 4]]);
		expect(a.payloads).toEqual([[2, 1, 9], [2, 2, 9], [2, 3, 9], [2, 4, 9], [2, 5, 9]]);
		expect(v.durations).toEqual([100, 100, 100, 100]);
		expect(a.durations).toEqual([500, 500, 1000, 1000, 1000]);
	});

	it("interleaves chunks by time (video first on ties)", () => {
		const [v, a] = readTracks(muxAudioIntoVideo(video(), audio()));
		const order = [...v.offsets.map(o => ["v", o] as const), ...a.offsets.map(o => ["a", o] as const)]
			.sort((x, y) => x[1] - y[1]).map(([t]) => t).join("");
		expect(order).toBe("vaava"); // v@0 a@0 a@1 v@2 a@2
	});

	it("marks sync samples", () => {
		const [v, a] = readTracks(muxAudioIntoVideo(video(), audio()));
		expect(v.sync).toEqual([1, 3]);
		expect(a.sync).toBeUndefined(); // all samples are sync
	});

	it("fills in durations and makes 'until the end' edit lists explicit", () => {
		const out = muxAudioIntoVideo(video(), audio());
		const [v, a] = readTracks(out);
		expect(v.mdhdDuration).toBe(400);  // media timescale 100 -> 4s
		expect(v.tkhdDuration).toBe(4000); // movie timescale 1000
		expect(a.mdhdDuration).toBe(4000); // media timescale 1000 -> 4s
		expect(a.edit).toEqual({ segmentDuration: 3900, mediaTime: 100 }); // 4s - 0.1s priming, in movie timescale
		expect(a.tkhdDuration).toBe(3900);
		const mvhd = findBox(out, readBoxes(out)[1], "mvhd")!;
		expect(getU32(out, mvhd.start + 20)).toBe(1000); // video's movie timescale
		expect(getU32(out, mvhd.start + 24)).toBe(4000); // longest track
		expect(getU32(out, mvhd.end - 4)).toBe(3);       // next_track_ID
	});

	it("rescales explicit edit durations to the output movie timescale", () => {
		const [, a] = readTracks(muxAudioIntoVideo(video(), audio({ edit: { segmentDuration: 44100 * 2, mediaTime: 0 } })));
		expect(a.edit).toEqual({ segmentDuration: 2000, mediaTime: 0 });
	});

	it("reads samples via absolute tfhd base_data_offsets", () => {
		const [v, a] = readTracks(muxAudioIntoVideo(video({ absoluteBaseOffsets: true }), audio({ absoluteBaseOffsets: true })));
		expect(v.payloads).toEqual([[1, 1], [1, 2], [1, 3], [1, 4]]);
		expect(a.payloads).toEqual([[2, 1, 9], [2, 2, 9], [2, 3, 9], [2, 4, 9], [2, 5, 9]]);
	});

	it("rejects non-fragmented input", () => {
		const plain = box("moov", fullBox("mvhd", 0, 0, zeros(8), u32(1000), u32(0), zeros(76), u32(2)),
			box("trak", fullBox("tkhd", 0, 3, zeros(8), u32(1), u32(0), u32(0), zeros(60)), box("mdia", fullBox("mdhd", 0, 0, zeros(8), u32(1000), u32(0), zeros(4)))));
		expect(() => muxAudioIntoVideo(plain, audio())).toThrow(/mvex/);
	});
});
