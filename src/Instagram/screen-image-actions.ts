import { con } from "~/lib/console";
import { $ } from "~/lib/dom3";
import { download, downloadAsync } from "~/lib/gm";
import { formatDateForFilename } from "./date-formats";
import { SingleImage } from "./models/single-image";
import { instaDom, pageOwnerName } from "./services/instaDom";
import { codeFromPath, type PlayingVideo, storyItemIdFromPath, videoLookup } from "./services/video-lookup";
import { showToast } from "./ui/toast";

export type MousePoint = { clientX: number; clientY: number };
type SourceUnderPoint = { el: HTMLElement; src: string };

export type MouseMoveSource = {
	addEventListener(
		type: "mousemove",
		listener: (e: MouseEvent) => void
	): void;
};

class PointerTracker {
	private mousePos: MousePoint = { clientX: 0, clientY: 0 };

	constructor(win: MouseMoveSource){
		win.addEventListener("mousemove", this.onMouseMove);
	}

	private readonly onMouseMove = ({ clientX, clientY }: MouseEvent): void => {
		this.mousePos = { clientX, clientY };
	};

	public getCurrentPosition(): MousePoint {
		return this.mousePos;
	}
}

// Stories & highlights (photo or video): /stories/<user>/<pk>/ names the item. Otherwise (highlights,
// or a story's first item before the url updates) the card's "posted ... ago" <time datetime=...>
// label identifies it by its exact posting time. The viewer also shows neighboring cards with
// their own labels, so use the nearest ancestor of the media that holds exactly one label.
function findStoryItem(mediaEl: Element): SingleImage | undefined {
	const byUrl = videoLookup.getById(storyItemIdFromPath(location.pathname));
	if (byUrl)
		return byUrl;

	for (let ancestor = mediaEl.parentElement; ancestor; ancestor = ancestor.parentElement) {
		const times = ancestor.querySelectorAll("time[datetime]");
		if (times.length > 1)
			return undefined; // reached the neighboring cards without finding our own label
		if (times.length === 1)
			return videoLookup.getByTakenAt(Date.parse(times[0].getAttribute("datetime")!) / 1000);
	}
	return undefined;
}

export class ScreenImageActions {
	private missingStandIn = "";
	private readonly pointerTracker: PointerTracker;

	public constructor(win: MouseMoveSource) {
		this.pointerTracker = new PointerTracker(win);
	}

	// Used by key press tracker (' ' and 'd')
	// Targets the popup's center when one is open, otherwise the mouse.
	public async downloadImageInCenter(): Promise<void> {
		const point = this.getCenterOfPresentation() ?? this.pointerTracker.getCurrentPosition();
		await this.downloadImageUnderPoint(point);
	}

	// Used by key press tracker
	public showTaggedUsersUnderMouse(): void {
		const point = this.getCenterOfPresentation() ?? this.pointerTracker.getCurrentPosition();
		const found = this.getImageUnderPoint(point);

		if (found == null)
			return;

		const { singleImage: { owner, taggedUsers } } = found;

		console.log(owner, taggedUsers);
	}

	public getImageUnderMouse(): { singleImage: SingleImage; imgUrl: string } | null {
		return this.getImageUnderPoint(this.pointerTracker.getCurrentPosition());
	}

	public getImageInCenter(): { singleImage: SingleImage; imgUrl: string } | null {
		const point = this.getCenterOfPresentation() ?? this.pointerTracker.getCurrentPosition();
		return this.getImageUnderPoint(point);
	}

	public getImageUnderPoint(point: MousePoint): { singleImage: SingleImage; imgUrl: string } | null {
		const sources = this.getSourcesUnder(point);

		if (sources.length === 0) {
			console.log("no img");
			return null;
		}

		const source = sources[0];
		const imgUrl = source.src;

		const newMissingStandIn = prompt("Please enter username", this.missingStandIn);
		if (newMissingStandIn === null) return null;

		this.missingStandIn = newMissingStandIn;

		const { width, height } = source.el instanceof HTMLImageElement
			? { width: source.el.naturalWidth, height: source.el.naturalHeight }
			: source.el.getBoundingClientRect();

		return {
			singleImage: SingleImage.fromUrlAndOwner(imgUrl, width, height, this.missingStandIn),
			imgUrl,
		};
	}

	public getCenterOfPresentation(): MousePoint | undefined {
		const el = instaDom.presentationCenter;
		if (el == null) return undefined;

		el.style.border = "thick solid red";
		const rect = el.getBoundingClientRect();

		return {
			clientX: (rect.left + rect.right) / 2,
			clientY: (rect.top + rect.bottom) / 2,
		};
	}

	private getSourcesUnder({ clientX, clientY }: MousePoint): SourceUnderPoint[] {
		const getBackgroundImage = (el: Element): string | null => {
			const backgroundImage = getComputedStyle(el).backgroundImage;
			if (!backgroundImage || backgroundImage === "none") {
				return null;
			}

			const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/);
			return match?.[2] ?? null;
		};

		return document
			.elementsFromPoint(clientX, clientY)
			.map((el) => {
				const src = (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) ? el.src : getBackgroundImage(el);
				return { el: el as HTMLElement, src };
			})
			.filter((item): item is SourceUnderPoint => item.src != null);
	}

	private async downloadImageUnderPoint(point: MousePoint): Promise<void> {
		const sources = this.getSourcesUnder(point);
		if (sources.length === 0) {
			console.log("no img");
			return;
		}

		if (await this.tryDownloadVideo(sources))
			return;

		if (await this.tryDownloadKnownImage(sources))
			return;

		// A paused video shows a static overlay image (e.g. play button) stacked
		// on top of the blob video source. Prefer the video in that case.
		const index = this.isStaticOverlayOnBlobVideo(sources) ? 1 : 0;
		await this.downloadSource(sources[index]);
	}

	private isStaticOverlayOnBlobVideo(sources: SourceUnderPoint[]): boolean {
		return sources.length > 1
			&& sources[0].src.includes("static.cdninstagram.com")
			&& sources[1].src.startsWith("blob:");
	}

	// A playing <video> has an undownloadable blob: src, and a grid thumb only shows the cover image.
	// Identify the post by its code (from the page url for a popup, or the thumb's link)
	// and download its MP4 instead. Returns false when no known video is under the point.
	private async tryDownloadVideo(sources: SourceUnderPoint[]): Promise<boolean> {
		if (location.pathname.startsWith("/stories/")) {
			const storyItem = findStoryItem(sources[0].el);
			if (storyItem)
				return this.downloadKnownMedia(storyItem);
			con.print("story: could not identify the item on screen - falling back to the image/frame");
		}

		const linkCode = codeFromPath(sources[0].el.closest("a[href]")?.getAttribute("href"));
		const videoEl = sources.map(({ el }) => el).find((el): el is HTMLVideoElement => el instanceof HTMLVideoElement);

		// For carousels: which slide is playing (matched by duration, else the url's 1-based ?img_index=)
		const imgIndex = Number(new URLSearchParams(location.search).get("img_index"));
		const playing: PlayingVideo | undefined = videoEl && {
			duration: videoEl.duration,
			slideIndex: imgIndex > 0 ? imgIndex - 1 : undefined,
		};

		const pageCode = codeFromPath(location.pathname);
		const video = (videoEl ? videoLookup.get(pageCode, playing) : undefined)
			?? videoLookup.get(linkCode, playing);
		if (video == null) {
			if (videoEl && videoLookup.has(pageCode))
				con.print(`video: could not tell which carousel slide is playing (duration ${videoEl.duration?.toFixed(2)}s, img_index ${imgIndex || "none"})`);
			return false;
		}
		return this.downloadKnownMedia(video);
	}

	// Image posts we have API data for: the popup's url names the post (and ?img_index= the slide),
	// otherwise the link around a grid thumb does (its cover is the first slide).
	// Returns false when the post (or the slide) isn't known.
	private async tryDownloadKnownImage(sources: SourceUnderPoint[]): Promise<boolean> {
		if (sources[0].src.startsWith("blob:"))
			return false;

		const pageCode = codeFromPath(location.pathname);
		const code = pageCode ?? codeFromPath(sources[0].el.closest("a[href]")?.getAttribute("href"));
		const imgIndex = pageCode ? Number(new URLSearchParams(location.search).get("img_index")) : 0;
		const image = videoLookup.getSlide(code, imgIndex > 0 ? imgIndex - 1 : 0);
		if (image == null || image.isVideo)
			return false;
		return this.downloadKnownMedia(image);
	}

	// Downloads media we have API data for (correct owner, date and best quality). Always returns true.
	private async downloadKnownMedia(media: SingleImage): Promise<boolean> {
		const kind = media.isVideo ? "video" : "image";
		void showToast(`downloading ${kind} (${media.owner})`, 3000);
		try {
			await media.downloadLargestAsync();
		} catch (ex) {
			console.error(ex);
			void showToast(`${kind} download failed (${media.owner})`, 5000);
		}
		return true;
	}

	private async downloadSource(source: SourceUnderPoint): Promise<void> {
		try {
			const imgUrl = source.src;

			if (imgUrl.startsWith("blob:")) {
				console.log("Has 'blob:' prefix. Not a normal image URL.", imgUrl);

				const videoElement = source.el;
				if (!(videoElement instanceof HTMLVideoElement)) {
					console.log("Blob source is not a video element.");
					return;
				}

				const canvas = $("canvas").el;
				const context = canvas.getContext("2d");
				if (context == null) {
					console.log("Could not get 2d canvas context.");
					return;
				}

				canvas.width = videoElement.videoWidth;
				canvas.height = videoElement.videoHeight;
				context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

				const coverImageSrc = canvas.toDataURL("image/jpeg");
				const extractFilename = (pageOwnerName || "instagram_img") + " " + formatDateForFilename(new Date()) + ".jpg";

				void showToast("using now as image timestamp", 3000);
				download({ url: coverImageSrc, name: extractFilename });
				return;
			}

			const extension = await this.getExtensionFromBlobType(imgUrl);
			const filename = (pageOwnerName || "instagram_img") + " " + formatDateForFilename(new Date()) + "." + extension;

			void showToast("using now as image timestamp", 3000);
			await downloadAsync({ url: imgUrl, name: filename });
			console.log(`downloaded: ${filename}`);
		} catch (ex) {
			console.error(ex);
		}
	}

	private async getExtensionFromBlobType(url: string): Promise<string> {
		const response = await fetch(url);
		const blob = await response.blob();

		switch (blob.type) { 
			case "image/webp": return "webp";
			case "image/jpeg": return "jpg";
			case "image/png": return "png";
			case "image/gif": return "gif";
		}

		console.log(`Unknown mimetype [${blob.type}]`);
		return "jpg";
	}
}