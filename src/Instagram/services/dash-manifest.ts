// Parses Instagram's video_dash_manifest (MPEG-DASH, "isoff-on-demand" profile).
// In that profile each Representation is one complete fragmented MP4 at its BaseURL,
// so the best quality is just: download the best video file + the audio file, then mux.

export type DashRepresentation = {
	url: string;
	kind: "video" | "audio";
	width: number;
	height: number;
	bandwidth: number;
	codecs: string;
	label: string; // e.g. "1080p", or the FBEncodingTag
	contentLength?: number; // FBContentLength - lets us show progress before the response headers arrive
};

export function parseDashManifest(xml: string): DashRepresentation[] {
	const doc = new DOMParser().parseFromString(xml, "application/xml");
	return [...doc.getElementsByTagName("Representation")].flatMap(rep => {
		const set = rep.parentElement;
		const attr = (name: string) => rep.getAttribute(name) ?? set?.getAttribute(name) ?? "";
		const kindText = attr("mimeType") || attr("contentType");
		const kind = kindText.startsWith("video") ? "video" : kindText.startsWith("audio") ? "audio" : undefined;
		const url = rep.getElementsByTagName("BaseURL")[0]?.textContent?.trim();
		if (!kind || !url) return [];
		const num = (name: string) => Number(rep.getAttribute(name) ?? 0) || 0;
		return [{
			url,
			kind,
			width: num("width"),
			height: num("height"),
			bandwidth: num("bandwidth"),
			codecs: attr("codecs"),
			label: rep.getAttribute("FBQualityLabel") ?? rep.getAttribute("FBEncodingTag") ?? "",
			contentLength: num("FBContentLength") || undefined,
		}];
	});
}

// Tallest video (then highest bitrate) and highest-bitrate audio.
export function pickBestRepresentations(reps: DashRepresentation[]): { video?: DashRepresentation; audio?: DashRepresentation } {
	const best = (kind: DashRepresentation["kind"], score: (r: DashRepresentation) => number[]) =>
		reps.filter(r => r.kind === kind)
			.sort((a, b) => {
				const [sa, sb] = [score(a), score(b)];
				const i = sa.findIndex((x, n) => x !== sb[n]);
				return i < 0 ? 0 : sb[i] - sa[i];
			})[0];
	return {
		video: best("video", r => [Math.max(r.width, r.height), r.bandwidth]),
		audio: best("audio", r => [r.bandwidth]),
	};
}
