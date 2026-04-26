import { GraphQLContentExtractor } from "../graphql-extractor";
import { InstagramProfileResponse } from "../ig-types";

// User's timeline / front page - "Posts"
export class Profile_Posts extends GraphQLContentExtractor<InstagramProfileResponse["data"]> {
	protected readonly friendlyNames = [
		"PolarisProfilePostsQuery",
		"PolarisProfilePostsTabContentQuery_connection",
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