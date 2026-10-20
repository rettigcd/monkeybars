import { con } from "~/lib/console";
import type { RequestSnooper, SnoopRequest } from "~/lib/snoop";
import type { MediaNode } from "../extractors/ig-types";
import { PicGroup } from "../models/pic-group";
import { recordDownloadWhenComplete } from "../trackers/user-update-service";
import { instaDom } from "./instaDom";
import { videoLookup } from "./video-lookup";

// Finds video posts in ANY intercepted JSON response (and in the page's embedded preload
// scripts on a fresh load) and registers them for download by post code.
// The dedicated extractors only understand the Posts / Tagged / location queries,
// while Reels (profile Reels tab, the /reels/ feed, /reel/CODE pages) arrive via other queries.
export class VideoSniffer {

	public constructor(snooper: RequestSnooper) {
		snooper.addHandler(this.snoop);
		if (document.readyState === "complete") this.scanScripts();
		else window.addEventListener("load", () => this.scanScripts());
	}

	private readonly snoop = (x: SnoopRequest): void => {
		if (x.responseText?.includes("video_versions"))
			this.scan(parseJsonish(x.responseText), describeRequest(x));
	};

	private scanScripts(): void {
		for (const script of instaDom.scripts)
			if (script.innerHTML.includes("video_versions"))
				this.scan(parseJsonish(script.innerHTML), "page script");
	}

	private scan(roots: unknown[], source: string): void {
		const nodes = roots.flatMap(root => findVideoNodes(root));
		let added = 0;
		for (const node of nodes) {
			if (videoLookup.has(node.code))
				continue;
			try {
				const group = PicGroup.fromMediaWithUser(node); // registers the video by code
				group.pics.forEach(pic => pic.listen("downloadProgress", recordDownloadWhenComplete));
				added++;
			}
			catch (err) {
				con.print(`videos: could not read ${node.code} from ${source}`, err);
			}
		}
		if (added)
			con.print(`videos: registered ${added} new of ${nodes.length} from ${source}`);
	}
}

type VideoNode = MediaNode & { code: string };

// Media nodes that carry their own downloadable video.
function findVideoNodes(root: unknown, found: VideoNode[] = [], depth = 0): VideoNode[] {
	if (root == null || typeof root !== "object" || 60 < depth)
		return found;

	const node = root as Partial<MediaNode>;
	if (Array.isArray(node.video_versions) && node.video_versions.length
		&& typeof node.code === "string"
		&& typeof node.user?.username === "string"
		&& node.image_versions2?.candidates?.length)
		found.push(node as VideoNode);

	for (const value of Object.values(root))
		findVideoNodes(value, found, depth + 1);
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
