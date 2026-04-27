import { type EventHost, EventHostBase } from "~/lib/observable";
import type { BatchProducerEvents } from "../extractors/base-pic-extractor";
import type { UserEntity } from "../types/repo-types";
import { PicGroup } from "./pic-group";
import { SingleImage } from "./single-image";

type ImageLookupEntry = {
	singleImage?: SingleImage;
	index?: number;
};

export function sanitizeImgUrl(url: string): string {
	const len = url.indexOf("?");
	return len < 0 ? url : url.substring(0, len);
}

export function isFollowing(fs?: UserEntity): boolean {
	return !!(fs && fs.isFollowing);
}

type ImageLookupByUrlEvents = {
	missingImage: [imgUrl: string];
};

// For each Pickgroup displayed,
// stores: date,following,liked,filename,index
// NOTE:
//      ImageInfo classes are initialized internally
//      caller just gets ImageInfo and modify them, never create them.
export class ImageLookupByUrl extends EventHostBase<ImageLookupByUrlEvents> {
	
	private readonly _dict: Record<string, ImageLookupEntry> = {};

	constructor(batchProducer: EventHost<BatchProducerEvents>) {
		super();
		this._dict = {};

		batchProducer.on("batchReceived", ( batch : PicGroup[]) => {
			batch.forEach((picGroup: PicGroup) => {
				this.addGroup(picGroup);
			});
		});
	}

	modValue(key: string, mod: (entry: ImageLookupEntry) => void): void {
		key = this.sanitize(key);
		if (!this.hasKey(key))
			this._dict[key] = { singleImage: undefined, index: undefined };
		mod(this._dict[key]);
	}

	getValue(key: string): ImageLookupEntry {
		key = this.sanitize(key);
		return this._dict[key];
	}

	hasKey(key: string): boolean {
		key = this.sanitize(key);
		return Object.prototype.hasOwnProperty.call(this._dict, key);
	}

	sanitize(url: string): string {
		return sanitizeImgUrl(url);
	}

	addGroup(group: PicGroup): void {
		try {
			group.pics.forEach((single) => this.addSingle(single));
		}
		catch (ex) {
			console.log("unable to save to images to lookup", this);
			throw ex;
		}
	}

	addSingle(singleImage: SingleImage): void {
		singleImage.images.forEach(({ url }) => {
			this.modValue(url, (x) => Object.assign(x, { singleImage }));
		});
	}

	getImageFor(imgUrl: string): SingleImage | null {
		if (this.hasKey(imgUrl)) {
			const { singleImage } = this.getValue(imgUrl);
			if (singleImage)
				return singleImage;
		}

		this.trigger("missingImage", imgUrl);
		return null;
	}

	allImages() : SingleImage[] {
		return Object.values(this._dict).map((x) => x.singleImage).filter((x) => x != null);
	}

	_missingStandIn = "";
}