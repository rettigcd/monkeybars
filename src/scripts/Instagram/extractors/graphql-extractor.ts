import { RequestSnooper, type SnoopHandler, SnoopRequest } from "~/utils/snoop";
import { BasePicExtractor } from "./base-pic-extractor";
import { type Edge, type InstagramProfileResponse, type MediaNode } from "./ig-types";

type GraphQLRequest = SnoopRequest & {
	handled?: string;
	bodyParams?: URLSearchParams;
	friendlyName?: FriendlyName;
};

type ProfileRootProp = keyof InstagramProfileResponse["data"];

type FriendlyName =
	| "PolarisProfilePostsQuery"
	| "PolarisProfilePostsTabContentQuery_connection"
	| "PolarisProfileTaggedTabContentQuery"
	| "PolarisProfileTaggedTabContentQuery_connection";

type FriendlyNameConfig = {
	simple: string;
	mainPropName: ProfileRootProp;
};

const GQL1 = "xdt_api__v1__feed__user_timeline_graphql_connection";
const GQL2 = "xdt_api__v1__usertags__user_id__feed_connection";

const friendlyNameConfigs: Record<FriendlyName, FriendlyNameConfig> = {

	// These are from a Users Posts/Main/Default/Timeline page
	PolarisProfilePostsQuery: { simple: "Post-0", mainPropName: GQL1, }, // The initial post
	PolarisProfilePostsTabContentQuery_connection: { simple: "Post-n", mainPropName: GQL1, }, // subsequent posts

	PolarisProfileTaggedTabContentQuery: { simple: "Tag-0", mainPropName: GQL2, },
	PolarisProfileTaggedTabContentQuery_connection: { simple: "Tag-N", mainPropName: GQL2, },
};

export class GraphQLExtractor extends BasePicExtractor {

	private mainPropName!: ProfileRootProp;

	constructor(snooper: RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	snoop: SnoopHandler = (x) => {
		const { url, body } = x;

		if (!this.matches(url)) {
			return;
		}

		const bodyParams = new URLSearchParams(body);
		const friendlyName = bodyParams.get("fb_api_req_friendly_name");

		if (!friendlyName || !this.isFriendlyName(friendlyName)) {
			return;
		}

		const config = friendlyNameConfigs[friendlyName];

		const request = x as GraphQLRequest;
		request.bodyParams = bodyParams;
		request.friendlyName = friendlyName;
		request.handled = `${this.constructor.name}-${config.simple}`;

		this.mainPropName = config.mainPropName;
		this.processResponse(x);
	};

	matches({ pathname }: URL): boolean {
		return pathname === "/api/graphql"
			|| pathname === "/graphql/query";
	}

	findMediaArray( json: unknown ): MediaNode[] {
		try {
			const response = json as {
				data?: InstagramProfileResponse["data"];
				errors?: unknown[];
			};

			if (Array.isArray(response.errors) && response.errors.length > 0) {
				console.log("Query error", json);
				return [];
			}

			const edges = response.data?.[this.mainPropName]?.edges;
			if (!Array.isArray(edges)) {
				return [];
			}

			return edges.map((edge: Edge) => edge.node);
		}
		catch {
			console.log("Unable to find media array:", this.mainPropName, json);
			return [];
		}
	}

	private isFriendlyName(value: string): value is FriendlyName {
		return value in friendlyNameConfigs;
	}
}