import { RequestSnooper, SnoopRequest } from "~/utils/snoop";
import { BasePicExtractor } from "./base-pic-extractor";
import { MediaNode, type Edge, type InstagramLocationResponse } from "./ig-types";

// Searches GraphQL response trees matching any of the [friendlyName(s)] for [edges] property.
// matches against:
//     path = "/graphql/query"
//     requests body parameter: fb_api_req_friendly_name
export class LocationContent extends BasePicExtractor {

	private readonly friendlyNames = [
		"PolarisLocationPageTabContentQuery",			// Location's Recent page - initial
		"PolarisLocationPageTabContentQuery_connection" // Location's Recent page - scrolling down
	];
	private readonly rootProp: keyof InstagramLocationResponse["data"] =
		"xdt_location_get_web_info_tab";

	constructor(snooper : RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches(url: URL, body?: string): boolean {
		if (url.pathname !== "/graphql/query") return false;

		const friendlyName = this.getFriendlyName(body);
		return !!friendlyName && this.friendlyNames.includes(friendlyName);
	}

	findMediaArray(json: InstagramLocationResponse): MediaNode[] {
		const edges = json.data[this.rootProp].edges;

		return Array.isArray(edges)
			? edges.map((x: Edge) => x.node)
			: [];
	}

	getHandledLabel(x: SnoopRequest): string { 
		const friendlyName = this.getFriendlyName(x.body);
		return `${this.constructor.name}(${friendlyName})`;
	}

	private getFriendlyName(body: string|undefined): string | null {
		return new URLSearchParams(body).get("fb_api_req_friendly_name");
	}
}
