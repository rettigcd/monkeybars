// Combines fragmented MP4s (as served by Instagram's DASH "on-demand" profile:
// ftyp, moov, sidx, then moof+mdat pairs - one file for video, one for audio)
// into a single regular (non-fragmented) MP4: ftyp, moov with full sample tables, one mdat.
// No re-encoding - sample data is copied as-is, interleaved one fragment-run per chunk.
// A regular MP4 (rather than fragmented) is what desktop players handle reliably,
// including audio/video sync and seeking.

type Box = { type: string; start: number; end: number; headerSize: number };

type Sample = { size: number; duration: number; flags: number; cto: number; offset: number };

type Run = { time: number; samples: Sample[] }; // time in seconds, for interleaving

type SourceTrack = {
	file: Uint8Array;
	trak: Box;
	movieTimescale: number;
	mediaTimescale: number;
	runs: Run[];
};

type TrexDefaults = { duration: number; size: number; flags: number };

const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const fourCC = (bytes: Uint8Array, at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
const contentStart = (box: Box) => box.start + box.headerSize;
const version = (bytes: Uint8Array, box: Box) => bytes[contentStart(box)];
const u32 = (bytes: Uint8Array, at: number) => view(bytes).getUint32(at);
const u64 = (bytes: Uint8Array, at: number) => Number(view(bytes).getBigUint64(at));

function fail(message: string): never {
	throw new Error(`mp4: ${message}`);
}

export function readBoxes(bytes: Uint8Array, start = 0, end = bytes.length): Box[] {
	const boxes: Box[] = [];
	let pos = start;
	while (pos + 8 <= end) {
		let size = u32(bytes, pos);
		const type = fourCC(bytes, pos + 4);
		let headerSize = 8;
		if (size === 1) { size = u64(bytes, pos + 8); headerSize = 16; }
		else if (size === 0) size = end - pos;
		if (size < headerSize || pos + size > end)
			fail(`bad '${type}' box at ${pos} (size ${size})`);
		boxes.push({ type, start: pos, end: pos + size, headerSize });
		pos += size;
	}
	return boxes;
}

export const childBoxes = (bytes: Uint8Array, box: Box) => readBoxes(bytes, contentStart(box), box.end);

// Finds a descendant box by path, e.g. findBox(file, moov, "trak", "mdia", "mdhd").
export function findBox(bytes: Uint8Array, box: Box, ...path: string[]): Box | undefined {
	let current: Box | undefined = box;
	for (const type of path) {
		current = childBoxes(bytes, current).find(b => b.type === type);
		if (current == null) return undefined;
	}
	return current;
}

function requireBox(bytes: Uint8Array, box: Box, ...path: string[]): Box {
	return findBox(bytes, box, ...path) ?? fail(`missing ${path.join("/")}`);
}

// ---- writing ----

class Writer {
	private readonly parts: Uint8Array[] = [];
	private length = 0;
	bytes(b: Uint8Array): this { this.parts.push(b); this.length += b.length; return this; }
	u8(...values: number[]): this { return this.bytes(Uint8Array.from(values)); }
	u32(value: number): this {
		if (!(0 <= value && value <= 0xFFFFFFFF)) fail(`u32 out of range: ${value}`);
		const b = new Uint8Array(4); view(b).setUint32(0, value); return this.bytes(b);
	}
	i32(value: number): this { const b = new Uint8Array(4); view(b).setInt32(0, value); return this.bytes(b); }
	u64(value: number): this { const b = new Uint8Array(8); view(b).setBigUint64(0, BigInt(value)); return this.bytes(b); }
	i64(value: number): this { const b = new Uint8Array(8); view(b).setBigInt64(0, BigInt(value)); return this.bytes(b); }
	ascii(s: string): this { return this.bytes(Uint8Array.from(s, c => c.charCodeAt(0))); }
	toBytes(): Uint8Array {
		const out = new Uint8Array(this.length);
		let pos = 0;
		for (const p of this.parts) { out.set(p, pos); pos += p.length; }
		return out;
	}
}

function makeBox(type: string, ...parts: Uint8Array[]): Uint8Array {
	const w = new Writer();
	w.u32(8 + parts.reduce((sum, p) => sum + p.length, 0)).ascii(type);
	parts.forEach(p => w.bytes(p));
	return w.toBytes();
}

const makeFullBox = (type: string, ver: number, flags: number, body: Writer) =>
	makeBox(type, new Writer().u8(ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255).toBytes(), body.toBytes());

const copyOf = (bytes: Uint8Array, box: Box) => bytes.slice(box.start, box.end);

// mvhd / tkhd / mdhd all start: version+flags, creation, modification (4 or 8 bytes each)
const afterTimes = (bytes: Uint8Array, box: Box) => contentStart(box) + 4 + (version(bytes, box) ? 16 : 8);

function writeUint(bytes: Uint8Array, at: number, size: 4 | 8, value: number): void {
	value = Math.max(0, Math.round(value));
	if (size === 8) view(bytes).setBigUint64(at, BigInt(value));
	else view(bytes).setUint32(at, Math.min(value, 0xFFFFFFFF));
}

// ---- input parsing ----

function parseSource(file: Uint8Array, label: string): SourceTrack[] {
	const top = readBoxes(file);
	const moov = top.find(b => b.type === "moov") ?? fail(`${label}: no moov`);
	const movieTimescale = u32(file, afterTimes(file, requireBox(file, moov, "mvhd")));

	const trexById = new Map<number, TrexDefaults>();
	for (const trex of childBoxes(file, requireBox(file, moov, "mvex")).filter(b => b.type === "trex")) {
		const c = contentStart(trex);
		trexById.set(u32(file, c + 4), { duration: u32(file, c + 12), size: u32(file, c + 16), flags: u32(file, c + 20) });
	}

	const tracks = new Map<number, SourceTrack & { nextTime: number; trex: TrexDefaults }>();
	for (const trak of childBoxes(file, moov).filter(b => b.type === "trak")) {
		const tkhd = requireBox(file, trak, "tkhd");
		const id = u32(file, afterTimes(file, tkhd));
		const mediaTimescale = u32(file, afterTimes(file, requireBox(file, trak, "mdia", "mdhd")));
		const trex = trexById.get(id) ?? fail(`${label}: no trex for track ${id}`);
		tracks.set(id, { file, trak, movieTimescale, mediaTimescale, runs: [], nextTime: 0, trex });
	}
	if (tracks.size === 0) fail(`${label}: no tracks`);

	for (const moof of top.filter(b => b.type === "moof")) {
		let previousDataEnd: number | undefined;
		for (const traf of childBoxes(file, moof).filter(b => b.type === "traf")) {
			const tfhd = requireBox(file, traf, "tfhd");
			let p = contentStart(tfhd);
			const flags = u32(file, p) & 0xFFFFFF;
			const track = tracks.get(u32(file, p + 4)) ?? fail(`${label}: traf for unknown track`);
			p += 8;
			let base = (flags & 0x20000) ? moof.start : (previousDataEnd ?? moof.start);
			if (flags & 0x1) { base = u64(file, p); p += 8; }
			if (flags & 0x2) p += 4; // sample_description_index
			const defDuration = (flags & 0x8) ? u32(file, (p += 4) - 4) : track.trex.duration;
			const defSize = (flags & 0x10) ? u32(file, (p += 4) - 4) : track.trex.size;
			const defFlags = (flags & 0x20) ? u32(file, (p += 4) - 4) : track.trex.flags;

			const tfdt = findBox(file, traf, "tfdt");
			let time = tfdt ? (version(file, tfdt) ? u64(file, contentStart(tfdt) + 4) : u32(file, contentStart(tfdt) + 4)) : track.nextTime;
			let pos = base;

			for (const trun of childBoxes(file, traf).filter(b => b.type === "trun")) {
				let q = contentStart(trun);
				const runVersion = file[q];
				const runFlags = u32(file, q) & 0xFFFFFF;
				const count = u32(file, q + 4);
				q += 8;
				if (runFlags & 0x1) { pos = base + view(file).getInt32(q); q += 4; }
				const firstFlags = (runFlags & 0x4) ? u32(file, (q += 4) - 4) : undefined;

				const run: Run = { time: time / track.mediaTimescale, samples: [] };
				for (let i = 0; i < count; ++i) {
					const duration = (runFlags & 0x100) ? u32(file, (q += 4) - 4) : defDuration;
					const size = (runFlags & 0x200) ? u32(file, (q += 4) - 4) : defSize;
					const sampleFlags = (runFlags & 0x400) ? u32(file, (q += 4) - 4)
						: (i === 0 && firstFlags !== undefined) ? firstFlags : defFlags;
					const cto = (runFlags & 0x800)
						? (runVersion ? view(file).getInt32((q += 4) - 4) : u32(file, (q += 4) - 4))
						: 0;
					if (pos + size > file.length) fail(`${label}: sample data past end of file`);
					run.samples.push({ size, duration, flags: sampleFlags, cto, offset: pos });
					pos += size;
					time += duration;
				}
				if (run.samples.length) track.runs.push(run);
			}
			previousDataEnd = pos;
			track.nextTime = time;
		}
	}

	return [...tracks.values()].filter(t => t.runs.length > 0);
}

// ---- output ----

type Chunk = { track: number; run: Run };

function runLength<T>(values: T[], same: (a: T, b: T) => boolean = (a, b) => a === b): { value: T; count: number }[] {
	const out: { value: T; count: number }[] = [];
	for (const value of values) {
		const last = out[out.length - 1];
		if (last && same(last.value, value)) last.count++;
		else out.push({ value, count: 1 });
	}
	return out;
}

function buildStbl(track: SourceTrack, chunks: Run[], chunkOffsets: number[]): Uint8Array {
	const { file, trak } = track;
	const samples = chunks.flatMap(run => run.samples);
	const stsd = copyOf(file, requireBox(file, trak, "mdia", "minf", "stbl", "stsd"));

	const stts = runLength(samples.map(s => s.duration));
	const sttsBox = makeFullBox("stts", 0, 0, stts.reduce((w, { value, count }) => w.u32(count).u32(value), new Writer().u32(stts.length)));

	const boxes = [stsd, sttsBox];

	if (samples.some(s => s.cto !== 0)) {
		const ctts = runLength(samples.map(s => s.cto));
		const negative = samples.some(s => s.cto < 0);
		boxes.push(makeFullBox("ctts", negative ? 1 : 0, 0,
			ctts.reduce((w, { value, count }) => w.u32(count).i32(value), new Writer().u32(ctts.length))));
	}

	const isSync = (s: Sample) => ((s.flags >> 16) & 1) === 0; // sample_is_non_sync_sample bit
	if (!samples.every(isSync)) {
		const syncNumbers = samples.flatMap((s, i) => isSync(s) ? [i + 1] : []);
		boxes.push(makeFullBox("stss", 0, 0, syncNumbers.reduce((w, n) => w.u32(n), new Writer().u32(syncNumbers.length))));
	}

	boxes.push(makeFullBox("stsz", 0, 0, samples.reduce((w, s) => w.u32(s.size), new Writer().u32(0).u32(samples.length))));

	const stsc = runLength(chunks.map((run, i) => ({ first: i + 1, perChunk: run.samples.length })), (a, b) => a.perChunk === b.perChunk);
	boxes.push(makeFullBox("stsc", 0, 0,
		stsc.reduce((w, { value }) => w.u32(value.first).u32(value.perChunk).u32(1), new Writer().u32(stsc.length))));

	boxes.push(makeFullBox("stco", 0, 0, chunkOffsets.reduce((w, o) => w.u32(o), new Writer().u32(chunkOffsets.length))));

	return makeBox("stbl", ...boxes);
}

type TrackTiming = { mediaDuration: number; movieDuration: number; edits?: Uint8Array };

// Edit lists in fragmented files often use segment_duration 0 ("until the end"),
// which in a regular MP4 would mean an empty edit - so make it explicit.
function buildTiming(track: SourceTrack, mediaDuration: number, movieTimescale: number): TrackTiming {
	const { file, trak, mediaTimescale } = track;
	const toMovie = (mediaUnits: number) => Math.round(mediaUnits * movieTimescale / mediaTimescale);
	const elst = findBox(file, trak, "edts", "elst");
	if (elst == null)
		return { mediaDuration, movieDuration: toMovie(mediaDuration) };

	const v1 = version(file, elst) === 1;
	const count = u32(file, contentStart(elst) + 4);
	const w = new Writer().u32(count);
	let movieDuration = 0;
	for (let i = 0, at = contentStart(elst) + 8; i < count; ++i, at += v1 ? 20 : 12) {
		const segmentDuration = v1 ? u64(file, at) : u32(file, at);
		const mediaTime = v1 ? Number(view(file).getBigInt64(at + 8)) : view(file).getInt32(at + 4);
		const rate = file.subarray(at + (v1 ? 16 : 8), at + (v1 ? 20 : 12));
		const duration = segmentDuration === 0
			? toMovie(mediaDuration - Math.max(mediaTime, 0))
			: Math.round(segmentDuration * movieTimescale / track.movieTimescale);
		w.u64(duration).i64(mediaTime).bytes(rate);
		movieDuration += duration;
	}
	return { mediaDuration, movieDuration, edits: makeBox("edts", makeFullBox("elst", 1, 0, w)) };
}

function buildTrak(track: SourceTrack, trackId: number, timing: TrackTiming, stbl: Uint8Array): Uint8Array {
	const { file, trak } = track;
	const rebuild = (box: Box, replace: (child: Box) => Uint8Array | null | undefined): Uint8Array =>
		makeBox(box.type, ...childBoxes(file, box).flatMap(child => {
			const out = replace(child);
			return out === null ? [] : [out ?? copyOf(file, child)];
		}));

	return rebuild(trak, child => {
		switch (child.type) {
			case "tkhd": {
				const out = copyOf(file, child), box = readBoxes(out)[0], at = afterTimes(out, box);
				writeUint(out, at, 4, trackId);
				writeUint(out, at + 8, version(out, box) ? 8 : 4, timing.movieDuration);
				return out;
			}
			case "edts": return timing.edits ?? null;
			case "mdia": return rebuild(child, mdiaChild => {
				if (mdiaChild.type === "mdhd") {
					const out = copyOf(file, mdiaChild), box = readBoxes(out)[0];
					writeUint(out, afterTimes(out, box) + 4, version(out, box) ? 8 : 4, timing.mediaDuration);
					return out;
				}
				if (mdiaChild.type === "minf")
					return rebuild(mdiaChild, minfChild => minfChild.type === "stbl" ? stbl : undefined);
				return undefined;
			});
			default: return undefined;
		}
	});
}

function buildMoov(tracks: SourceTrack[], chunks: Chunk[], dataStart: number): Uint8Array {
	const movieTimescale = tracks[0].movieTimescale;
	const traks: Uint8Array[] = [];
	let longest = 0;

	tracks.forEach((track, i) => {
		const myChunks: Run[] = [];
		const offsets: number[] = [];
		let pos = dataStart;
		for (const { track: t, run } of chunks) {
			if (t === i) { myChunks.push(run); offsets.push(pos); }
			pos += run.samples.reduce((sum, s) => sum + s.size, 0);
		}
		const mediaDuration = myChunks.reduce((sum, run) => sum + run.samples.reduce((d, s) => d + s.duration, 0), 0);
		const timing = buildTiming(track, mediaDuration, movieTimescale);
		longest = Math.max(longest, timing.movieDuration);
		traks.push(buildTrak(track, i + 1, timing, buildStbl(track, myChunks, offsets)));
	});

	const mvhd = new Writer().u32(0).u32(0).u32(movieTimescale).u32(longest)
		.u32(0x00010000).u8(1, 0).bytes(new Uint8Array(10)) // rate 1.0, volume 1.0, reserved
		.u32(0x00010000).u32(0).u32(0).u32(0).u32(0x00010000).u32(0).u32(0).u32(0).u32(0x40000000) // identity matrix
		.bytes(new Uint8Array(24)) // pre_defined
		.u32(tracks.length + 1); // next_track_ID
	return makeBox("moov", makeFullBox("mvhd", 0, 0, mvhd), ...traks);
}

// Merges any number of fragmented MP4 inputs (each may hold one or more tracks) into one regular MP4.
export function remuxToMp4(inputs: Uint8Array[]): Uint8Array {
	const tracks = inputs.flatMap((file, i) => parseSource(file, `input ${i + 1}`));
	if (tracks.length === 0) fail("no tracks with samples");

	// one chunk per fragment run, interleaved by start time (stable: earlier inputs first on ties)
	const chunks: Chunk[] = tracks
		.flatMap((track, i) => track.runs.map(run => ({ track: i, run })))
		.sort((a, b) => a.run.time - b.run.time);

	const ftyp = makeBox("ftyp", new Writer().ascii("isom").u32(0x200).ascii("isomiso2mp41").toBytes());
	const dataSize = chunks.reduce((sum, { run }) => sum + run.samples.reduce((s, x) => s + x.size, 0), 0);
	if (dataSize + 8 > 0xFFFFFFFF) fail("output too large");

	// moov's size doesn't depend on the chunk offset values, so measure it first
	const moovSize = buildMoov(tracks, chunks, 0).length;
	const dataStart = ftyp.length + moovSize + 8;
	const moov = buildMoov(tracks, chunks, dataStart);

	const out = new Uint8Array(dataStart + dataSize);
	out.set(ftyp, 0);
	out.set(moov, ftyp.length);
	view(out).setUint32(dataStart - 8, dataSize + 8);
	out.set([..."mdat"].map(c => c.charCodeAt(0)), dataStart - 4);
	let pos = dataStart;
	for (const { track, run } of chunks) {
		const { file } = tracks[track];
		for (const s of run.samples) { out.set(file.subarray(s.offset, s.offset + s.size), pos); pos += s.size; }
	}
	return out;
}

export const muxAudioIntoVideo = (video: Uint8Array, audio: Uint8Array) => remuxToMp4([video, audio]);
