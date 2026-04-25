import { EventHostBase } from "~/utils/observable";
import { RequestSnooper, type SnoopHandler, SnoopRequest } from "~/utils/snoop";
import { PicGroup } from "./../pic-group";
import { apiTimesTouch } from "./api-times";
import type { BatchProducerEvents, HandledRequest } from "./base-pic-extractor";
import { type Edge, type InstagramLocationResponse } from "./ig-types";

// Searches GraphQL response trees matching the [friendlyName] for [edges] property.
// matches against:
//     path = "/graphql/query"
//     requests body parameter: fb_api_req_friendly_name
class GraphQLEdgeFinder extends EventHostBase<BatchProducerEvents> {
	private friendlyName: string;
	private handledLabel: string;
	private rootProp: keyof InstagramLocationResponse["data"];

	constructor(snooper: RequestSnooper, friendlyName: string, rootProp: keyof InstagramLocationResponse["data"] ) {
		super();
		this.friendlyName = friendlyName;
		this.handledLabel = `${this.constructor.name}(${friendlyName})`;
		this.rootProp = rootProp;
		snooper.addHandler(this.snoop);
	}

	snoop: SnoopHandler = (x: SnoopRequest) => {
		apiTimesTouch(this.handledLabel);

		const { url, body } = x;

		if( url.pathname !== "/graphql/query" ) return;

		if (
			url.pathname === "/graphql/query" &&
			new URLSearchParams(body).get("fb_api_req_friendly_name") === this.friendlyName
		) {

			this.processResponse(x);
			const handledRequest = x as HandledRequest;
			handledRequest.handled = this.handledLabel;
		}
	};

	processResponse({ data }: SnoopRequest): void {
		const edges = this.getEdges(data);
		const batch = edges.map((x) => x.node).map(PicGroup.fromMediaWithUser);
		this.trigger("batchReceived", batch);
	}

	private getEdges(data: unknown): Edge[] {
		const response = data as InstagramLocationResponse;
		const edges = response.data?.[this.rootProp]?.edges;
		return Array.isArray(edges) ? edges : [];
	}
}

export class LocationContent extends GraphQLEdgeFinder {
	constructor(snooper: RequestSnooper){
		super(snooper,"PolarisLocationPageTabContentQuery","xdt_location_get_web_info_tab");
	}
}

// Scrolling down through a location's Recent page
// Sample response:  location-scroll.json
export class LocationContentConnection extends GraphQLEdgeFinder {
	constructor(snooper: RequestSnooper){
		super(snooper,"PolarisLocationPageTabContentQuery_connection","xdt_location_get_web_info_tab");
	}
}
