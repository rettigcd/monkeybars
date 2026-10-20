import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { bestDashVideo } from "./best-video-download";
import { parseDashManifest, pickBestRepresentations } from "./dash-manifest";

function firstManifest(sampleFile: string): string {
	const json = JSON.parse(readFileSync(resolve("src/Instagram/sample-data", sampleFile), "utf8"));
	let found: string | undefined;
	(function walk(o: any) {
		if (found || o == null || typeof o !== "object") return;
		if (typeof o.video_dash_manifest === "string") { found = o.video_dash_manifest; return; }
		Object.values(o).forEach(walk);
	})(json);
	return found ?? "";
}

describe("parseDashManifest (sample location-scroll.json)", () => {
	const reps = parseDashManifest(firstManifest("location-scroll.json"));

	it("finds the video and audio representations", () => {
		expect(reps.filter(r => r.kind === "video").map(r => r.height)).toEqual([640, 960, 1280]);
		expect(reps.filter(r => r.kind === "audio")).toHaveLength(1);
	});

	it("decodes BaseURL entities", () => {
		for (const { url } of reps) {
			expect(url).toMatch(/^https:\/\/.*fbcdn\.net\//);
			expect(url).not.toContain("&amp;");
		}
	});

	it("picks the tallest video and the audio", () => {
		const { video, audio } = pickBestRepresentations(reps);
		expect([video?.width, video?.height, video?.label]).toEqual([720, 1280, "720p"]);
		expect(video?.contentLength).toBe(3521537);
		expect(audio?.codecs).toBe("mp4a.40.5");
	});

	it("skips DASH when it is no better than the progressive MP4", () => {
		const manifest = firstManifest("location-scroll.json");
		expect(bestDashVideo(manifest, 1280)).toBeUndefined();
		expect(bestDashVideo(manifest, 1024)?.video.height).toBe(1280);
	});
});
