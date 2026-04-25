import { RequestSnooper } from "~/utils/snoop";
import { BasePicExtractor } from "./base-pic-extractor";
import { type MediaNode } from "./ig-types";

// From the Pop-up Details modal you get when you click on an image in either
// 	- user's Posts page OR 
//  - user's Tagged page
export class DetailsPopup extends BasePicExtractor {
	constructor(snooper:RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches({ pathname }:URL) {
		return pathname.startsWith("/api/v1/media/") && pathname.endsWith("/info/");
	}

	findMediaArray(json: unknown) {
		return (json as {items:MediaNode[]}).items;
	}
}