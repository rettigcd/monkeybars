import { RequestSnooper } from "~/utils/snoop";
import { BasePicExtractor } from "../base-pic-extractor";
import { type MediaNode } from "../ig-types";

type UserPostsResponse = {
	items?: MediaNode[];
};

// https://www.instagram.com/api/v1/feed/user/1560767330/?count=12&max_id=3091713838536813928_1560767330
export class UserPosts extends BasePicExtractor {
	constructor(snooper: RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches({ pathname }: URL) {
		return pathname.startsWith("/api/v1/feed/user/");
	}

	findMediaArray(json: unknown): MediaNode[] {
		const response = json as UserPostsResponse;
		return Array.isArray(response.items) ? response.items : [];
	}
}