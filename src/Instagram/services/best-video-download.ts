import type { LTProgressHandler } from "~/lib/progress-types";
import { type DashRepresentation, parseDashManifest, pickBestRepresentations } from "./dash-manifest";
import { remuxToMp4 } from "./mp4-mux";

const FETCH_TIMEOUT_MS = 5 * 60_000;

// Picks the best DASH video track from the manifest, or undefined if it isn't
// taller than `minHeight` (in which case the progressive MP4 is just as good).
export function bestDashVideo(manifest: string, minHeight: number): { video: DashRepresentation; audio?: DashRepresentation } | undefined {
	const { video, audio } = pickBestRepresentations(parseDashManifest(manifest));
	return video && minHeight < Math.max(video.width, video.height) ? { video, audio } : undefined;
}

// Downloads the DASH video + audio tracks, muxes them into one MP4 and saves it.
// Throws on any failure so the caller can fall back to the progressive MP4.
export async function downloadDashVideo(
	{ video, audio }: { video: DashRepresentation; audio?: DashRepresentation },
	name: string,
	onprogress?: LTProgressHandler,
): Promise<void> {
	const loaded = { video: 0, audio: 0 };
	const total = { video: video.contentLength ?? 0, audio: audio?.contentLength ?? 0 };
	const report = () => onprogress?.({
		loaded: loaded.video + loaded.audio,
		total: Math.max(total.video + total.audio, loaded.video + loaded.audio, 1),
	});

	const [videoBytes, audioBytes] = await Promise.all([
		fetchBytes(video.url, (n, t) => { loaded.video = n; total.video = t || total.video; report(); }),
		audio ? fetchBytes(audio.url, (n, t) => { loaded.audio = n; total.audio = t || total.audio; report(); }) : undefined,
	]);

	saveBytes(remuxToMp4(audioBytes ? [videoBytes, audioBytes] : [videoBytes]), name);
}

async function fetchBytes(url: string, onprogress: (loaded: number, total: number) => void): Promise<Uint8Array> {
	const abort = new AbortController();
	const timer = setTimeout(() => abort.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: abort.signal });
		if (!response.ok || response.body == null)
			throw new Error(`fetch ${response.status} ${response.statusText}`);

		const total = Number(response.headers.get("content-length")) || 0;
		const reader = response.body.getReader();
		const chunks: Uint8Array[] = [];
		let loaded = 0;
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(value);
			loaded += value.length;
			onprogress(loaded, total);
		}

		const bytes = new Uint8Array(loaded);
		let pos = 0;
		for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
		return bytes;
	}
	finally {
		clearTimeout(timer);
	}
}

// Same blob/anchor technique as saveUsersToFile.
function saveBytes(bytes: Uint8Array, name: string): void {
	const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "video/mp4" }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
