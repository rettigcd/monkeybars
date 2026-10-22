import { describe, expect, it } from "vitest";
import { SingleImage } from "../models/single-image";
import { parseDashDuration } from "./dash-manifest";
import { codeFromPath, videoLookup } from "./video-lookup";

const image = (n: number) => new SingleImage([], [], [{ url: `https://x/img${n}.jpg`, width: 1, height: 2 }], "owner", new Date(0));
const video = (n: number, seconds: number) => new SingleImage([], [], [{ url: `https://x/cover${n}.jpg`, width: 1, height: 2 }], "owner", new Date(0), [],
	{ versions: [{ url: `https://x/v${n}.mp4`, width: 720, height: 1280 }], dashManifest: `<MPD mediaPresentationDuration="PT${seconds}S"></MPD>` });

describe("parseDashDuration", () => {
	it("parses hours, minutes and seconds", () => {
		expect(parseDashDuration(`<MPD mediaPresentationDuration="PT12.862404S">`)).toBeCloseTo(12.862404);
		expect(parseDashDuration(`<MPD mediaPresentationDuration="PT1M2.5S">`)).toBe(62.5);
		expect(parseDashDuration(`<MPD mediaPresentationDuration="PT1H">`)).toBe(3600);
		expect(parseDashDuration(`<MPD>`)).toBeUndefined();
	});
});

describe("codeFromPath", () => {
	it("finds post codes in post, reel and img_index urls", () => {
		expect(codeFromPath("/p/DWrIiUxlRjE/")).toBe("DWrIiUxlRjE");
		expect(codeFromPath("/someone/reel/DbjiLMLutXS/")).toBe("DbjiLMLutXS");
		expect(codeFromPath("/reels/DefWG9hRaSp/")).toBe("DefWG9hRaSp");
		expect(codeFromPath("/someone/")).toBeUndefined();
	});
});

describe("videoLookup", () => {
	it("returns a single (non-carousel) video with or without playing info", () => {
		const v = video(1, 10);
		videoLookup.register("single", [v], false);
		expect(videoLookup.get("single")).toBe(v);
		expect(videoLookup.get("single", { duration: 99 })).toBe(v);
	});

	it("does not treat posts without video as videos, but getSlide finds them", () => {
		const photo = image(1);
		videoLookup.register("photo", [photo], false);
		expect(videoLookup.has("photo")).toBe(false);
		expect(videoLookup.get("photo")).toBeUndefined();
		expect(videoLookup.getSlide("photo")).toBe(photo);
		expect(videoLookup.getSlide("photo", 1)).toBeUndefined();
		expect(videoLookup.getSlide("unknown")).toBeUndefined();
	});

	describe("carousel", () => {
		const slides = [image(1), video(2, 12.86), image(3), video(4, 2.93)];
		videoLookup.register("carousel", slides, true);

		it("needs to know what is playing (grid thumbs keep their cover image)", () => {
			expect(videoLookup.get("carousel")).toBeUndefined();
		});

		it("picks the slide whose duration matches the playing video", () => {
			expect(videoLookup.get("carousel", { duration: 12.9 })).toBe(slides[1]);
			expect(videoLookup.get("carousel", { duration: 2.9 })).toBe(slides[3]);
		});

		it("falls back to the url slide index when the duration doesn't decide", () => {
			expect(videoLookup.get("carousel", { duration: 40, slideIndex: 3 })).toBe(slides[3]);
			expect(videoLookup.get("carousel", { duration: NaN, slideIndex: 1 })).toBe(slides[1]);
			expect(videoLookup.get("carousel", { duration: 40, slideIndex: 0 })).toBeUndefined(); // an image slide
			expect(videoLookup.get("carousel", { duration: 40 })).toBeUndefined();
		});

		it("uses the only video slide when there is just one", () => {
			const mixed = [image(5), video(6, 14)];
			videoLookup.register("one-video", mixed, true);
			expect(videoLookup.get("one-video", { duration: 99 })).toBe(mixed[1]);
		});
	});
});
