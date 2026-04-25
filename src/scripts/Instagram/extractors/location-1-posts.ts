import type { RequestSnooper } from "~/utils/snoop";
import type { LocationRepo } from "../repo-types";
import { apiTimesTouch } from "./api-times";
import { type MediaNode } from "./ig-types";
import { LocationBase, type LocationSectionParent } from "./location-base";

type Location1PostsConstructorArgs = {
	snooper: RequestSnooper;
	startingState: { slug: string, id: string, lastVisit?: number };
	locRepo: LocationRepo;
};

// Initial Load. Contains (Location-Header,top,recent)
export class Location1Posts extends LocationBase {

	locRepo: LocationRepo;
	startingState: { slug: string, id: string, lastVisit?: number };

	constructor({ snooper, startingState, locRepo } : Location1PostsConstructorArgs) {
		super();
		snooper.addHandler(this.snoop);
		this.startingState = startingState;
		this.locRepo = locRepo;
	}

	matches({ pathname }:URL) {
		return pathname == "/api/v1/locations/web_info/";
	}

	findMediaArray(json:unknown): MediaNode[] {
		const data = json as {
			native_location_data: {
				ranked: LocationSectionParent;
				recent: LocationSectionParent;
				location_info: { lat?: number; lng?: number };
			};
		};
		apiTimesTouch(this.constructor.name);

		const { ranked, recent, location_info } = data.native_location_data;
		const { lat, lng } = location_info;

		if (lat != null)
			this.locRepo.update(this.locKey, (x) => Object.assign(x, { lat, lng }));

		return [
			this.mediaFromSectionParent(ranked),
			this.mediaFromSectionParent(recent),
		].flat(1);
	}

	handleError(err:unknown):void {
		console.error("Error parsing Loc1 response.", err);

		if (this.startingState.lastVisit) {
			const key = this.locKey;
			const lv = this.startingState.lastVisit;
			console.log(`Resetting ${key} to ${lv}`);
			this.locRepo.update(key, (x) => x.lastVisit = lv);
		}
	}

	get locKey() {
		return this.startingState.slug + " " + this.startingState.id;
	}
}
