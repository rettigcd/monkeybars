import { $ } from "~/utils/dom3";
import { BatchProducerGroup } from "../batch-producer-group";
import { dom } from "../dom";
import { sanitizeImgUrl } from "../models";
import { PicGroup } from "../pic-group";
import { timestampToAgeString } from "../storage-time";

type GalleryConstructorArgs = {
	batchProducer: BatchProducerGroup;
};


type ThumbRowElement = HTMLElement & {
	index?: number;
};

type ThumbCellElement = HTMLElement & {
	decorated?: boolean;
};

// Stores PicGroups as they come in via the batch producer.
// Runs on a timer and decorates thumbs as they appear with info from the PicGroup.
export class Gallery {
	private readonly lookup: Record<string, PicGroup>;
	private readonly sanitizeImgUrl: (url: string) => string;

	public constructor({
		batchProducer,
	}: GalleryConstructorArgs) {
		this.lookup = {};
		this.sanitizeImgUrl = sanitizeImgUrl;

		this.startWatchingThumbs();
		batchProducer.on("batchReceived", (batch) => this.storeBatch(batch));
	}

	private storeBatch(batch: PicGroup[]): void {
		for (const picGroup of batch) {
			this.lookup[picGroup.sanitizedImgUrl] = picGroup;
		}
	}

	private startWatchingThumbs(): void {
		window.setInterval(() => this.decorateThumbs(), 1000);
	}

	private decorateThumbs(): void {
		const rows = dom.thumbRows as ThumbRowElement[];
		if (rows.length === 0)
			return;

		const firstIndex = rows[0].index;
		const lastIndex = rows[rows.length - 1].index;
		const rowOffset =
			firstIndex
			?? (lastIndex !== undefined ? lastIndex - (rows.length - 1) : 0);

		for (let i = 0; i < rows.length; ++i) {
			const row = rows[i];

			if (row.index == null) {
				row.index = rowOffset + i;
				row.style.position = "relative";
				this.buildRowRangeLabel(row.index).appendTo(row);
			}

			for (let j = 0; j < row.children.length; ++j) {
				const cell = row.children[j] as ThumbCellElement;
				if (cell.decorated)
					continue;

				const imgEl = cell.querySelector("img");
				if (!(imgEl instanceof HTMLImageElement))
					continue;

				const sanitizedImgUrl = this.sanitizeImgUrl(imgEl.src);
				const picGroup = this.lookup[sanitizedImgUrl];

				if (picGroup == null)
					continue;

				this.decorateThumb({ imgEl, picGroup });
				cell.decorated = true;
			}
		}
	}

	private decorateThumb(args: {
		imgEl: HTMLImageElement;
		picGroup: PicGroup;
	}): void {
		const { imgEl, picGroup } = args;
		const { following = false, liked = false, pics } = picGroup;
		const { ageText, ageColor } = timestampToAgeString(picGroup.dateNum);
		const isNew = picGroup.isNew ?? false;

		picGroup.thumbUrl = imgEl.src;

		const firstPic = picGroup.pics[0];
		if (firstPic == null)
			return;

		const a = this.sanitizeImgUrl(imgEl.src);
		const b = this.sanitizeImgUrl(firstPic.smallestUrl);
		if (a !== b) {
			console.warn("Group urls do not match", a, b);
		}

		const host = imgEl.parentElement;
		if (host == null)
			return;

		host.style.position = "relative";

		this.buildAgeBadge({
			ageText,
			ageColor,
			liked,
			isNew,
			following,
		}).appendTo(host);

		if (pics.length > 1) {
			this.buildMultiImageOverlay({
				host,
				imgEl,
				pics,
			}).appendTo(host);
		}
	}

	private buildRowRangeLabel(rowIndex: number) {
		return $("div")
			.txt(`${rowIndex * 3 + 1}-${rowIndex * 3 + 3}`)
			.css({
				position: "absolute",
				bottom: "5px",
				right: "10px",
				background: "rgba(0,0,0,0.2)",
				padding: "2px 10px",
				color: "white",
			});
	}

	private buildAgeBadge(args: {
		ageText: string;
		ageColor: string;
		liked: boolean;
		isNew: boolean;
		following: boolean;
	}) {
		const {
			ageText,
			ageColor,
			liked,
			isNew,
			following,
		} = args;

		let txt = `Age: ${ageText}`;
		if (liked)
			txt += " ♥ ";
		if (isNew)
			txt += " NEW! ";

		return $("span")
			.txt(txt)
			.css({
				...(isNew
					? { color: "black", background: "yellow" }
					: { color: "white", background: ageColor }),
				...(following
					? { border: "solid black thick", fontWeight: "900" }
					: {}),
				position: "absolute",
				zIndex: "1000",
			});
	}

	private buildMultiImageOverlay(args: {
		host: HTMLElement;
		imgEl: HTMLImageElement;
		pics: PicGroup["pics"];
	}) {
		const { host, imgEl, pics } = args;

		const showImagesSpan = $("span")
			.txt(`+ ${pics.length - 1}`)
			.css({
				position: "absolute",
				bottom: "0",
				zIndex: "1000",
				color: "red",
				background: "white",
				border: "thin solid red",
				borderRadius: "4px",
				font: "bold 28px Arial",
				padding: "4px 12px",
			})
			.on("click", (event: Event) => {
				event.stopPropagation();
				event.preventDefault();

				this.hideGrayOverlay(showImagesSpan.el);
				showImagesSpan.el.remove();

				const numPerRow = 4;
				const clipSize = imgEl.width / numPerRow;
				const thumbPics = pics.slice(1);
				const rowsNeeded = Math.floor((thumbPics.length - 1) / numPerRow) + 1;

				thumbPics.forEach((si, index) => {
					const colIndex = index % numPerRow;
					const rowIndex = (index - colIndex) / numPerRow;
					const useRow = rowsNeeded - rowIndex - 1;

					this.buildOverlayImage({
						src: si.smallestUrl,
						left: `${colIndex * clipSize}px`,
						bottom: `${useRow * clipSize}px`,
						size: `${clipSize - 4}px`,
					}).appendTo(host);
				});
			});

		return showImagesSpan;
	}

	private buildOverlayImage(args: {
		src: string;
		left: string;
		bottom: string;
		size: string;
	}) {
		const { src, left, bottom, size } = args;

		return $("img")
			.attr("src", src)
			.css({
				position: "absolute",
				width: size,
				height: size,
				border: "thick solid black",
				left,
				bottom,
			});
	}

	private hideGrayOverlay(sourceElement: HTMLElement): void {
		try {
			const aElement = sourceElement.parentElement?.parentElement?.parentElement;
			const ul = aElement?.querySelector("ul");
			const overlay = ul?.parentElement;
			const overlayContainer = overlay?.parentElement;

			if (overlay instanceof HTMLElement)
				overlay.style.display = "none";

			if (overlayContainer instanceof HTMLElement)
				overlayContainer.style.display = "none";
		}
		catch (error) {
			console.error(error);
		}
	}
}