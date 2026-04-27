import { RequestSnooper, type SnoopHandler, SnoopRequest } from "~/lib/snoop";
import { type HandledRequest } from "../extractors/base-pic-extractor";

// Identifies UNHANDLED Snoop Requests
// Should always be processed LAST
export class IdentifyUnhandledRequests {

	constructor(snooper:RequestSnooper) {
		snooper.addHandler(this.snoop);
	}

	snoop:SnoopHandler = (x) => {
		const handledRequest = x as HandledRequest;
		if (handledRequest.handled)
			return;

		const desc = this.getDescription(x);
		if (desc)
			handledRequest.notHandled = `[${desc}]`;
	};

	getDescription({ url: { pathname } }:SnoopRequest) {
		return {
			"/ajax/bz": "ajax/bz",
			"/ajax/bulk-route-definitions/": "bulk-routes",
			"/api/v1/web/fxcal/ig_sso_users/": "ig_sso_users",
			"/ajax/bootloader-endpoint/": "boot-endpoint",
			"/api/v1/feed/reels_tray/": "reals_tray",
			"/api/v1/web/accounts/fb_profile/": "fb_profile",
			"/sync/instagram/": "sync",
		}[pathname] || (() => {
			if (pathname.endsWith("/comments/"))		return "comments";
			if (pathname.endsWith(".js"))				return "javascript";
			if (pathname.startsWith("/btmanifest/"))	return "btManifest";
			if (pathname.includes("graphql"))			return "graphql";
		})();
	}
}
