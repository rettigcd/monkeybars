import type { SingleImage } from "../models/single-image";

// Pulls the post shortcode out of /p/CODE/, /reel/CODE/, /user/reel/CODE/ etc.
export function codeFromPath(path: string | null | undefined): string | undefined {
	return path?.match(/\/(?:p|reels?)\/([A-Za-z0-9_-]+)/)?.[1];
}

// Maps post shortcodes to their (single, non-carousel) video, so a video playing
// on screen - whose <video> src is an undownloadable blob: url - can be traced back
// to the progressive MP4 url from the API response.
class VideoLookup {
	private readonly byCode = new Map<string, SingleImage>();

	register(code: string | undefined, video: SingleImage): void {
		if (code && video.isVideo)
			this.byCode.set(code, video);
	}

	has(code: string | undefined): boolean {
		return code !== undefined && this.byCode.has(code);
	}

	get(code: string | undefined): SingleImage | undefined {
		return code ? this.byCode.get(code) : undefined;
	}
}

export const videoLookup = new VideoLookup();
