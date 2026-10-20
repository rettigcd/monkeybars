import { type ListenFn, makeObservable, type ObservableHost } from "~/lib/observable";
import { toMs } from "~/lib/time";
import type { MediaNode } from "../extractors/ig-types";
import { sanitizeImgUrl } from "../services/image-lookup-by-url";
import { videoLookup } from "../services/video-lookup";
import { SingleImage } from "./single-image";

type PicGroupArgs = {
	owner: string;
	date: Date;
	pics: SingleImage[];
	following?: boolean;
	liked?: boolean;
	captionText?: string;
	coauthors?: string[];
};

export class PicGroup implements ObservableHost<PicGroup> {
	public readonly owner!: string;
	public readonly pics!: SingleImage[];
	public readonly following?: boolean;
	public readonly liked?: boolean;
	public readonly captionText?: string;
	public readonly coauthors!: string[]; // usernames from Instagram's "collab post" coauthor_producers
	public readonly sanitizedImgUrl: string;
	public readonly date!: Date; // used to build separator / row title

	public isVisible: boolean = true; // observable
	public isNew?: boolean; // this prop is set later after the batch has ben routed to batch-producer-group
	public thumbUrl?: string; // the (sanitized?) url that Instagram is using to represent that group - pulled from the DOM

	public listen!: ListenFn<PicGroup>;


	constructor({ owner, date, pics, following, liked, captionText, coauthors = [] }: PicGroupArgs) {
		Object.assign(this, { owner, date, pics, following, liked, captionText, coauthors });
		makeObservable(this);
		this.sanitizedImgUrl = sanitizeImgUrl(pics[0].smallestUrl);
	}

	// for sorting and comparing
	get dateMs(): number { return this.date.valueOf(); }

	// Instagram media pk's encode the creation time in their upper bits (Snowflake-style),
	// offset from a custom epoch of 2011-08-24. Used when the API response omits taken_at.
	static takenAtMsFromPk(pk: string): number {
		const INSTAGRAM_EPOCH_MS = 1314220021721n;
		return Number((BigInt(pk) >> 23n) + INSTAGRAM_EPOCH_MS);
	}

	static fromMediaWithUser(dto: MediaNode): PicGroup {
		const {
			pk,
			code,
			user,
			taken_at,
			carousel_media,
			image_versions2,
			video_versions,
			video_dash_manifest,
			caption,
			usertags,
			has_liked,
			coauthor_producers,
		} = dto;

		const captionText = caption?.text || undefined;
		const owner = user.username;
		const dateMs = taken_at !== undefined ? toMs(taken_at * 1000) : PicGroup.takenAtMsFromPk(pk);
		const date = new Date(dateMs);

		const coauthors = (coauthor_producers ?? []).map(({ username }) => username);

		const isCarousel = Array.isArray(carousel_media) && 0 < carousel_media.length;
		const pics = isCarousel
				? carousel_media.map( ({ usertags, image_versions2, video_versions, video_dash_manifest }) => SingleImage.fromMedia({ usertags, image_versions2, video_versions, video_dash_manifest, owner, date, coauthors }) )
				: [SingleImage.fromMedia({ usertags, image_versions2, video_versions, video_dash_manifest, owner, date, coauthors })];

		// Carousel videos can't be identified by post code alone (the code covers every slide).
		if (!isCarousel)
			videoLookup.register(code, pics[0]);

		const following = user?.friendship_status?.following || false;

		return new PicGroup({
			owner,
			date,
			pics,
			following,
			liked: has_liked,
			captionText,
			coauthors,
		});
	}

}
