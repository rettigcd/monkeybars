import { RequestSnooper, SnoopRequest } from "~/utils/snoop";
import { BasePicExtractor } from "./base-pic-extractor";
import { type Edge, type MediaNode } from "./ig-types";

export abstract class GraphQLContentExtractor<TData> extends BasePicExtractor {
	protected abstract readonly friendlyNames: readonly string[];
	protected abstract readonly rootProp: keyof TData;

	constructor(snooper: RequestSnooper) {
		super();
		snooper.addHandler(this.snoop);
	}

	matches(url: URL, body?: string): boolean {
		if (url.pathname !== "/api/graphql" && url.pathname !== "/graphql/query") return false;

		const friendlyName = this.getFriendlyName(body);
		return !!friendlyName && this.friendlyNames.includes(friendlyName);
	}

	findMediaArray(json: { data?: TData; errors?: unknown[] }): MediaNode[] {
		if (Array.isArray(json.errors) && json.errors.length > 0) {
			console.log("Query error", json);
			return [];
		}

		const root = json.data?.[this.rootProp] as { edges?: Edge[] } | undefined;
		const edges = root?.edges;

		return Array.isArray(edges)
			? edges.map((edge) => edge.node)
			: [];
	}

	getHandledLabel(x: SnoopRequest): string {
		const friendlyName = this.getFriendlyName(x.body);
		return `${this.constructor.name}( ${friendlyName} )`;
	}

	private getFriendlyName(body?: string): string | null {
		return body
			? new URLSearchParams(body).get("fb_api_req_friendly_name")
			: null;
	}
}