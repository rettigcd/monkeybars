import type { SingleImage } from "../models/single-image";

// Pulls the post shortcode out of /p/CODE/, /reel/CODE/, /user/reel/CODE/ etc.
export function codeFromPath(path: string | null | undefined): string | undefined {
	return path?.match(/\/(?:p|reels?)\/([A-Za-z0-9_-]+)/)?.[1];
}

// The story item's media pk from /stories/<user>/<pk>/ (highlights urls carry the highlight's id instead).
export function storyItemIdFromPath(path: string): string | undefined {
	return path.match(/^\/stories\/(?!highlights\/)[^/]+\/(\d+)/)?.[1];
}

// What we know about the <video> playing on screen, to pick the right carousel slide.
export type PlayingVideo = {
	duration?: number; // seconds, from the <video> element
	slideIndex?: number; // 0-based, from the page url's ?img_index= (when present)
};

type Entry = {
	slides: SingleImage[]; // every slide (images too), so slideIndex lines up
	isCarousel: boolean;
};

const DURATION_TOLERANCE_S = 0.5;

// Maps post shortcodes to their videos, so a video playing on screen - whose <video> src
// is an undownloadable blob: url - can be traced back to the MP4 urls from the API response.
class VideoLookup {
	private readonly byCode = new Map<string, Entry>();
	private readonly byId = new Map<string, SingleImage>(); // story items (photos and videos) by media pk

	registerById(id: string, media: SingleImage): void {
		this.byId.set(id, media);
	}

	hasId(id: string | undefined): boolean {
		return id !== undefined && this.byId.has(id);
	}

	getById(id: string | undefined): SingleImage | undefined {
		return id ? this.byId.get(id) : undefined;
	}

	// Story item posted at this exact time (seconds) - the story viewer's <time datetime=...> label.
	getByTakenAt(seconds: number): SingleImage | undefined {
		const matches = [...this.byId.values()].filter(m => Math.abs(m.date.getTime() / 1000 - seconds) < 1);
		return matches.length === 1 ? matches[0] : undefined;
	}

	register(code: string | undefined, slides: SingleImage[], isCarousel: boolean): void {
		if (code && slides.some(s => s.isVideo))
			this.byCode.set(code, { slides, isCarousel });
	}

	has(code: string | undefined): boolean {
		return code !== undefined && this.byCode.has(code);
	}

	// For a carousel, only answers when told about the playing video (so a grid thumb,
	// which shows the cover, isn't silently swapped for one of the carousel's videos).
	get(code: string | undefined, playing?: PlayingVideo): SingleImage | undefined {
		const entry = code ? this.byCode.get(code) : undefined;
		if (entry == null) return undefined;
		if (!entry.isCarousel) return entry.slides[0];
		return playing ? pickSlide(entry.slides, playing) : undefined;
	}
}

function pickSlide(slides: SingleImage[], { duration, slideIndex }: PlayingVideo): SingleImage | undefined {
	const videos = slides.filter(s => s.isVideo);
	if (videos.length === 1)
		return videos[0];

	if (duration !== undefined && Number.isFinite(duration)) {
		const matches = videos.filter(v => v.videoDuration !== undefined && Math.abs(v.videoDuration - duration) <= DURATION_TOLERANCE_S);
		if (matches.length === 1)
			return matches[0];
	}

	const byIndex = slideIndex !== undefined ? slides[slideIndex] : undefined;
	return byIndex?.isVideo ? byIndex : undefined;
}

export const videoLookup = new VideoLookup();
