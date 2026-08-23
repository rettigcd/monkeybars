import { GraphQLContentExtractor } from "../graphql-extractor";
import type { InstagramProfileResponse } from "../ig-types";

// User's timeline / front page - "Posts"
export class Profile_Posts extends GraphQLContentExtractor<InstagramProfileResponse["data"]> {
	protected readonly friendlyNames = [
		"PolarisProfilePostsWWWQuery", // new: 2026-08-23
		"PolarisProfilePostsTabContentWWWQuery_connection", // new: 2026-08-23
		"PolarisProfilePostsQuery",	// missing: 2026-08-23
		"PolarisProfilePostsTabContentQuery_connection", // missing: 2026-08-23
	];

	protected readonly rootProp = "xdt_api__v1__feed__user_timeline_graphql_connection";
}

// User's tagged page - "Tagged" 
export class Profile_Tagged extends GraphQLContentExtractor<InstagramProfileResponse["data"]> {
	protected readonly friendlyNames = [
		"PolarisProfileTaggedTabContentQuery",
		"PolarisProfileTaggedTabContentQuery_connection",
	];

	protected readonly rootProp = "xdt_api__v1__usertags__user_id__feed_connection";
}