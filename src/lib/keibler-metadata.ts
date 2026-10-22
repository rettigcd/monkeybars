// Writes Keibler metadata into image files. Format: docs/MetadataFormatSpec.md. JPEG only so far.

export type KeiblerTagValue = string | { v: string; rect: string };

export interface KeiblerMetadata {
	up: number;
	tags?: Record<string, KeiblerTagValue[]>;
	imageSize?: { w: number; h: number };
	photoDate?: string;
}

const PAD_BLOCK = 512;
const MAX_APP0_PAYLOAD = 0xFFFF - 2;
const ID = new TextEncoder().encode("Keibler\0");

// "rect" is "X,Y,Width,Height"
export const rectString = (x: number, y: number, w: number, h: number): string => `${x},${y},${w},${h}`;

// yyyy-MM-ddTHH:mm:ss, local time, no offset
export function formatPhotoDate(d: Date): string {
	const p = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function isJpeg(bytes: Uint8Array): boolean {
	return bytes.length > 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
}

interface JpegMarker { start: number; end: number; code: number } // [start,end) includes the 0xFF code bytes and length

// Markers between SOI and SOS (start of scan); entropy-coded data follows SOS.
function* headerMarkers(bytes: Uint8Array): Generator<JpegMarker> {
	let pos = 2;
	while (pos + 4 <= bytes.length && bytes[pos] === 0xFF) {
		const code = bytes[pos + 1];
		if (code === 0xDA) return;
		const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
		const end = pos + 2 + length;
		if (length < 2 || end > bytes.length) return;
		yield { start: pos, end, code };
		pos = end;
	}
}

function isKeiblerApp0(bytes: Uint8Array, { start, end, code }: JpegMarker): boolean {
	return code === 0xE0 && end - start >= 4 + ID.length && ID.every((b, i) => bytes[start + 4 + i] === b);
}

// Pixel size from the SOF marker (SOF0..SOF15 except DHT/JPG/DAC)
export function jpegSize(bytes: Uint8Array): { w: number; h: number } | undefined {
	for (const m of headerMarkers(bytes)) {
		if (m.code >= 0xC0 && m.code <= 0xCF && m.code !== 0xC4 && m.code !== 0xC8 && m.code !== 0xCC)
			return { h: (bytes[m.start + 5] << 8) | bytes[m.start + 6], w: (bytes[m.start + 7] << 8) | bytes[m.start + 8] };
	}
	return undefined;
}

function buildApp0(meta: KeiblerMetadata): Uint8Array {
	const json = new TextEncoder().encode(JSON.stringify(meta));
	const paddedJson = Math.ceil(json.length / PAD_BLOCK) * PAD_BLOCK;
	const payloadLength = ID.length + paddedJson;
	if (payloadLength > MAX_APP0_PAYLOAD)
		throw new Error(`Keibler metadata too large for one APP0 segment: ${payloadLength} bytes`);

	const out = new Uint8Array(4 + payloadLength).fill(0x20);
	out[0] = 0xFF;
	out[1] = 0xE0;
	out[2] = (payloadLength + 2) >> 8;
	out[3] = (payloadLength + 2) & 0xFF;
	out.set(ID, 4);
	out.set(json, 4 + ID.length);
	return out;
}

// Returns a copy of the JPEG with the Keibler block replacing the existing one,
// or inserted right after the file's first marker.
export function writeJpegMetadata(jpeg: Uint8Array, meta: KeiblerMetadata): Uint8Array {
	if (!isJpeg(jpeg))
		throw new Error("not a JPEG");
	const block = buildApp0(meta);

	let cutStart: number | undefined;
	let cutEnd: number | undefined;
	let firstEnd: number | undefined;
	for (const m of headerMarkers(jpeg)) {
		firstEnd ??= m.end;
		if (isKeiblerApp0(jpeg, m)) { cutStart = m.start; cutEnd = m.end; break; }
	}
	if (cutStart === undefined) {
		cutStart = cutEnd = firstEnd ?? 2;
	}

	const out = new Uint8Array(jpeg.length - (cutEnd! - cutStart) + block.length);
	out.set(jpeg.subarray(0, cutStart), 0);
	out.set(block, cutStart);
	out.set(jpeg.subarray(cutEnd!), cutStart + block.length);
	return out;
}
