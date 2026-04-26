import { con } from "~/utils/console";
import { GM, type GMProgressHandler } from "~/utils/gm";
import { type ListenFn, makeObservable, type ObservableHost } from "~/utils/observable";
import { by } from "~/utils/sorting";
import { throwExp } from "~/utils/throw";
import { formatDateForFilename } from "../date-formats";
import type { ImageCandidate, TaggedImageMedia, UserTags } from "../extractors/ig-types";


type SingleImageMediaArgs = TaggedImageMedia & {
	owner: string;
	date: Date;
};

type ImageDimension = "width" | "height";

export class SingleImage implements ObservableHost<SingleImage> {
	taggedUsers: string[];
	images: ImageCandidate[];
	largestUrl: string;
	smallestUrl: string;
	largestDimensionName: ImageDimension;
	owner: string;
	date: Date;
	filename: string;
	downloaded = false;

	public listen!: ListenFn<SingleImage>;

	constructor(taggedUsers: string[], images: ImageCandidate[], owner: string, date: Date) {
		this.taggedUsers = taggedUsers;

		const nonSquareImages = images.filter(({ height, width }) => height !== width);
		// console.debug(`${nonSquareImages.length} of ${images.length} are non-square`);
		if (images.length * 40 <= nonSquareImages.length * 100)
			images = nonSquareImages;

		this.images = images.sort(by(({ height }) => height));
		this.smallestUrl = this.images[0].url;
		this.largestUrl = this.images[this.images.length - 1].url;
		this.largestDimensionName = images[0].width < images[0].height ? "height" : "width";

		this.owner = owner;
		this.date = date;

		const ext = this.smallestUrl.includes(".webp") ? ".webp" : ".jpg";
		this.filename = [owner, ...taggedUsers].slice(0, 10).join(" ")
			+ " " + formatDateForFilename(date) + ext;

		makeObservable(this);
	}

	static fromMedia({ usertags, image_versions2, owner, date = throwExp("date") }: SingleImageMediaArgs): SingleImage {
		const taggedUsers:string[] = SingleImage.parseUserTags(usertags);
		return new SingleImage(taggedUsers, image_versions2.candidates, owner, date);
	}

	static fromUrlAndOwner(url: string, imageWidth: number, imageHeight: number, owner: string): SingleImage {
		const imageCandidate: ImageCandidate = { url, width:imageWidth, height:imageHeight };
		return new SingleImage([], [imageCandidate], owner, new Date());
	}

	static parseUserTags(usertags: UserTags | undefined | null): string[] {
		try {
			return (
				usertags &&
				usertags.in
					.sort(by(({ position }) => position[0]))
					.map((x: any) => x.user.username)
			) || [];
		}
		catch {
			return [];
		}
	}

	getThumbUrl(minSize = 0): string {
		const largerThanRequested = this.images.filter(({ width, height }) => minSize < Math.max(width, height));
		return largerThanRequested.length ? largerThanRequested[0].url : this.largestUrl;
	}

	// Downloads the cleaned-up URL of the requested url
	async downloadAsync(requestedUrl:string,onprogress?:GMProgressHandler){ // $$$
		const matching = this.images.filter(({url}) => url.includes(requestedUrl)).reverse();
		await GM.downloadAsync({url:matching[0]?.url || requestedUrl, name:this.filename, onprogress });
		this.downloaded=true;
		con.print(`downloaded: ${this.filename}`);
	}

	public async downloadLargestAsync(onprogress?: GMProgressHandler){
		await GM.downloadAsync({url:this.largestUrl, name:this.filename, onprogress });
		this.downloaded=true;
		con.print(`downloaded: ${this.filename}`);
	}

}
