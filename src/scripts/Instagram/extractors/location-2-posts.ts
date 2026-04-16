import { RequestSnooper } from "~/utils/snoop";
import { apiTimesTouch } from "./api-times";
import { MediaNode } from "./ig-types";
import { LocationBase, LocationSectionParent } from "./location-base";


// https://www.instagram.com/api/v1/locations/web_info/?location_id=1251125&show_nearby=false
export class Location2Posts extends LocationBase {

	constructor(snooper:RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches({ pathname }:URL) {
		return pathname.startsWith("/api/v1/locations/")
			&& pathname.endsWith("/sections/");
	}

	findMediaArray(json:unknown): MediaNode[] {
		apiTimesTouch(this.constructor.name);
		return this.mediaFromSectionParent(json as LocationSectionParent);
	}

}
