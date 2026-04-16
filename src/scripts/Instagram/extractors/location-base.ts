import { BasePicExtractor } from "./base-pic-extractor";
import { MediaNode } from "./ig-types";

export type LocationSectionParent = {
	status: string;
	sections?: {
		layout_type: string;
		layout_content: {
			medias: {
				media: unknown;
			}[];
		};
	}[];
};

export abstract class LocationBase extends BasePicExtractor {
	constructor() {
		super();
	}

	mediaFromSectionParent(sectionParent: LocationSectionParent): MediaNode[] {
		if (sectionParent.status == "fail" || !sectionParent.sections) {
			console.error("Fail", sectionParent);
			return [];
		}

		return sectionParent.sections
			.filter((s) => s.layout_type == "media_grid")
			.map((sec) => sec.layout_content.medias.map((media) => media.media))
			.flat(1) as MediaNode[];
	}
}
