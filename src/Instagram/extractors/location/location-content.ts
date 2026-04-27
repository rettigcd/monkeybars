import { GraphQLContentExtractor } from "../graphql-extractor";
import { type InstagramLocationResponse } from "../ig-types";

export class LocationContent extends GraphQLContentExtractor<InstagramLocationResponse["data"]> {
	protected readonly friendlyNames = [
		"PolarisLocationPageTabContentQuery",			// Location's Recent page - initial
		"PolarisLocationPageTabContentQuery_connection" // Location's Recent page - scrolling down
	];

	protected readonly rootProp = "xdt_location_get_web_info_tab";
}