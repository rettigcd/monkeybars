import { type ListenFn, makeObservable, type ObservableHost } from "~/utils/observable";
import type { MediaNode } from "../extractors/ig-types";
import { sanitizeImgUrl } from "../services/image-lookup-by-url";
import { storageTime } from "../services/storage-time";
import { SingleImage } from "./single-image";

type PicGroupArgs = {
	owner: string;
	date: Date;
	pics: SingleImage[];
	following?: boolean;
	liked?: boolean;
	captionText?: string;
};

export class PicGroup implements ObservableHost<PicGroup> {
	owner!: string;
	date!: Date;
	pics!: SingleImage[];
	following?: boolean;
	liked?: boolean;
	captionText?: string;
	isNew?: boolean;
	isVisible: boolean = true;;
	sanitizedImgUrl: string;
	thumbUrl?: string;

	public listen!: ListenFn<PicGroup>;


	constructor({ owner, date, pics, following, liked, captionText }: PicGroupArgs) {
		Object.assign(this, { owner, date, pics, following, liked, captionText });
		makeObservable(this);
		this.sanitizedImgUrl = sanitizeImgUrl(pics[0].smallestUrl);
	}

	// for sorting and comparing
	// uses whatever number schema is currently configured in storageTime, which is currently ms but may change in the future
	get dateNum(): number {
		return storageTime.toNum(this.date);
	}

	static fromMediaWithUser(dto: MediaNode): PicGroup {
		const {
			user,
			taken_at,
			carousel_media,
			image_versions2,
			caption,
			usertags,
			has_liked,
		} = dto;

		const captionText = caption?.text || undefined;
		const owner = user.username;
		const date = storageTime.toDate(taken_at * 1000);

		const pics = Array.isArray(carousel_media) && 0 < carousel_media.length
				? carousel_media.map( ({ usertags, image_versions2 }) => SingleImage.fromMedia({ usertags, image_versions2, owner, date }) )
				: [SingleImage.fromMedia({ usertags, image_versions2, owner, date })];

		const following = user?.friendship_status?.following || false;

		return new PicGroup({
			owner,
			date,
			pics,
			following,
			liked: has_liked,
			captionText,
		});
	}

}
