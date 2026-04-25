import { RequestSnooper } from "~/utils/snoop";
import { BasePicExtractor } from "./base-pic-extractor";
import { type MediaNode, type SavedPostsResponse } from "./ig-types";

// https://www.instagram.com/api/v1/feed/saved/posts/ ...stuff
// Posts that I saved personally, from my user > Saved page.
export class SavedPosts extends BasePicExtractor {
	constructor(snooper: RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches({ pathname }: URL) {
		return pathname == "/api/v1/feed/saved/posts/";
	}

	findMediaArray(json: unknown): MediaNode[] {
		return (json as SavedPostsResponse).items.map(x => x.media);
	}
}