import { $ } from "~/utils/dom3";
import { GM } from "~/utils/gm";
import { formatDateForFilename } from "./date-formats";
import { dom } from "./dom";
import { SingleImage } from "./single-image";

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

export class ScreenImageActions {
	private missingStandIn = "";
	private readonly pointerTracker: PointerTracker;

	public constructor(win: MouseMoveSource) {
		this.pointerTracker = new PointerTracker(win);
	}

	// Used by key press tracker
	public async downloadImageInCenter(): Promise<void> {
		const point = this.getCenterOfPresentation() ?? this.pointerTracker.getCurrentPosition();
		await this.downloadImageUnderPoint(point);
	}

	// Used by key press tracker
	public async downloadImageUnderMouse(): Promise<void> {
		await this.downloadImageUnderPoint(this.pointerTracker.getCurrentPosition());
	}

	// Used by key press tracker
	public showTaggedUsersUnderMouse(): void {
		const point = this.getCenterOfPresentation() ?? this.pointerTracker.getCurrentPosition();
		const found = this.getImageUnderPoint(point);

		if (found == null) {
			return;
		}

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

		// !!! Add this back in when you restore URL lookup.
		// const singleImage = iiLookup.getImageFor(imgUrl);
		// if (singleImage != null) {
		// 	return { singleImage, imgUrl };
		// }

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
		const el = dom.presentationCenter;
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
				const src = el instanceof HTMLImageElement ? el.src : getBackgroundImage(el);
				return { el: el as HTMLElement, src };
			})
			.filter((item): item is SourceUnderPoint => item.src != null);
	}

	private async downloadImageUnderPoint(point: MousePoint): Promise<void> {
		try {
			const sources = this.getSourcesUnder(point);
			if (sources.length === 0) {
				console.log("no img");
				return;
			}

			const source = sources[0];
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
				const extractFilename = (dom.pageOwner || "instagram_img") + " " + formatDateForFilename(new Date()) + ".jpg";

				GM.download({ url: coverImageSrc, name: extractFilename });
				return;
			}

			const extension = await this.getExtensionFromBlobType(imgUrl);
			const filename = (dom.pageOwner || "instagram_img") + " " + formatDateForFilename(new Date()) + "." + extension;

			await GM.downloadAsync({ url: imgUrl, name: filename });
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