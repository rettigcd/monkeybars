import { type ListenFn, makeObservable, type ObservableHost } from "~/lib/observable";
import { toMs } from "~/lib/time";
import type { MediaNode } from "../extractors/ig-types";
import { sanitizeImgUrl } from "../services/image-lookup-by-url";
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
	public readonly owner!: string;
	public readonly pics!: SingleImage[];
	public readonly following?: boolean;
	public readonly liked?: boolean;
	public readonly captionText?: string;
	public readonly sanitizedImgUrl: string;
	public readonly date!: Date; // used to build separator / row title

	public isVisible: boolean = true; // observable
	public isNew?: boolean; // this prop is set later after the batch has ben routed to batch-producer-group 
	public thumbUrl?: string; // the (sanitized?) url that Instagram is using to represent that group - pulled from the DOM

	public listen!: ListenFn<PicGroup>;


	constructor({ owner, date, pics, following, liked, captionText }: PicGroupArgs) {
		Object.assign(this, { owner, date, pics, following, liked, captionText });
		makeObservable(this);
		this.sanitizedImgUrl = sanitizeImgUrl(pics[0].smallestUrl);
	}

	// for sorting and comparing
	get dateMs(): number { return this.date.valueOf(); }

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
		const date = new Date(toMs(taken_at * 1000));

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
