import { con } from "~/lib/console";
import { EventHostBase } from "~/lib/observable";
import type { RequestSnooper, SnoopRequest } from "~/lib/snoop";
import type { BatchProducerEvents } from "../extractors/base-pic-extractor";
import type { MediaNode } from "../extractors/ig-types";
import { PicGroup } from "../models/pic-group";
import { instaDom } from "./instaDom";
import { videoLookup } from "./video-lookup";

// Finds video posts in ANY intercepted JSON response (and in the page's embedded preload
// scripts on a fresh load) and registers them for download by post code.
// The dedicated extractors only understand the Posts / Tagged / location queries,
// while Reels (profile Reels tab, the /reels/ feed, /reel/CODE pages) arrive via other queries.
// Emits what it finds as batches, so they reach the side panel, gallery and download tracking
// like any other source. Must be the LAST source on a snooper, so the dedicated extractors
// register their posts first and the sniffer only adds what they missed.
export class VideoSniffer extends EventHostBase<BatchProducerEvents> {

	// scanPageScripts: false where another source already reads the page's embedded data
	// (the location page's InitialLocationPageParser), to avoid emitting those posts twice.
	public constructor(snooper: RequestSnooper, { scanPageScripts = true } = {}) {
		super();
		snooper.addHandler(this.snoop);
		if (!scanPageScripts) return;
		if (document.readyState === "complete") this.scanScripts();
		else window.addEventListener("load", () => this.scanScripts());
	}

	private readonly snoop = (x: SnoopRequest): void => {
		if (mayHoldMedia(x.responseText))
			this.scan(parseJsonish(x.responseText), describeRequest(x));
	};

	private scanScripts(): void {
		for (const script of instaDom.scripts)
			if (mayHoldMedia(script.innerHTML))
				this.scan(parseJsonish(script.innerHTML), "page script");
	}

	private scan(roots: unknown[], source: string): void {
		const found = roots.flatMap(root => findMediaNodes(root));
		const batch: PicGroup[] = [];
		for (const { node, owner } of found) {
			const id = node.pk ? String(node.pk) : undefined;
			if (videoLookup.hasId(id) || videoLookup.has(node.code ?? undefined))
				continue; // already registered (here, or by an extractor)
			try {
				// story items don't carry their own user - it's on the story ("reel") above them
				const withUser = node.user?.username ? node : { ...node, user: { ...node.user, username: owner } as MediaNode["user"] };
				const group = PicGroup.fromMediaWithUser(withUser); // registers videos by post code
				if (id && group.pics.length === 1)
					videoLookup.registerById(id, group.pics[0]);
				batch.push(group);
			}
			catch (err) {
				con.print(`videos: could not read ${node.code ?? id} from ${source}`, err);
			}
		}
		if (batch.length) {
			con.print(`videos: registered ${batch.length} new of ${found.length} from ${source}`);
			this.trigger("batchReceived", batch);
		}
	}
}

const mayHoldMedia = (text: string | undefined) => !!text && (text.includes("video_versions") || text.includes("\"story\""));

type FoundNode = { node: MediaNode; owner: string };

// Media nodes that carry their own downloadable video, plus story items (photos too),
// with the owner taken from the nearest username at or above the node.
function findMediaNodes(root: unknown, found: FoundNode[] = [], owner?: string, depth = 0): FoundNode[] {
	if (root == null || typeof root !== "object" || 60 < depth)
		return found;

	const node = root as Partial<MediaNode> & { product_type?: string; owner?: { username?: unknown } };
	const ownName = typeof node.user?.username === "string" ? node.user.username
		: typeof node.owner?.username === "string" ? node.owner.username
		: undefined;
	owner = ownName ?? owner;

	const hasImage = !!node.image_versions2?.candidates?.length;
	const isVideo = Array.isArray(node.video_versions) && node.video_versions.length > 0 && typeof node.code === "string";
	const isStoryItem = node.product_type === "story" && node.pk != null;
	if (hasImage && (isVideo || isStoryItem) && owner)
		found.push({ node: node as MediaNode, owner });

	for (const value of Object.values(root))
		findMediaNodes(value, found, owner, depth + 1);
	return found;
}

// GraphQL responses are sometimes several JSON documents, one per line (streamed/deferred parts).
function parseJsonish(text: string): unknown[] {
	text = text.replace(/^for \(;;\);/, "");
	try {
		return [JSON.parse(text)];
	}
	catch {
		return text.split("\n").flatMap(line => {
			try { return line.trim().startsWith("{") ? [JSON.parse(line)] : []; }
			catch { return []; }
		});
	}
}

function describeRequest({ url, body }: SnoopRequest): string {
	const friendlyName = typeof body === "string" ? new URLSearchParams(body).get("fb_api_req_friendly_name") : null;
	return friendlyName ? `${url.pathname} (${friendlyName})` : url.pathname;
}
