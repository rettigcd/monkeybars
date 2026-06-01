import { $, $qAsync } from "~/lib/dom3";
import { RequestSnooper, type SnoopHandler } from "~/lib/snoop";
import type { HandledRequest } from "../extractors/base-pic-extractor";
import { UserCtx } from "../user-ctx";

type VisitingUserTrackerConstructionArgs = {
	snooper: RequestSnooper, 
}

export type InstagramUser = {
	id: number;
	username: string;
	full_name: string;
	friendship_status: string;
	is_private: boolean;
}

// When visiting someones page (aka their 'Posts' tab)
// checks if we are following them and if so, saves following=true status to userRepo
export class VisitingUserTracker {

	constructor({ snooper } : VisitingUserTrackerConstructionArgs) {
		snooper.addHandler(this.snoop);
	}

	private snoop: SnoopHandler = (snoopRequest) => {
		const { url, body } = snoopRequest;

		if (
			url.pathname === "/graphql/query"
			&& new URLSearchParams(String(body??"")).get("fb_api_req_friendly_name") === "PolarisProfilePageContentDirectQuery"
		) {
			const handledRequest = snoopRequest as HandledRequest;
			handledRequest.handled = VisitingUserTracker.name;
			const user = (snoopRequest.json as any).user as InstagramUser;
			const isFollowing = user.friendship_status == "followiwng!!!"; // !!! WRONG

			const userCtx = new UserCtx(user.username);
			if (isFollowing || userCtx.isTracking) {
				userCtx.recordVisit();
				userCtx.isPrivate = user.is_private;
				userCtx.isFollowing = isFollowing;
				setPublicPrivateLabel(user.is_private);
			}
		}
	};
}


let publicPrivateSpan: HTMLElement | null = null;
let savedIsPrivate: boolean | undefined;

export function setPublicPrivateLabel(isPrivate?:boolean) {
	if (publicPrivateSpan === null) {
		// create the span & attach it to its host.
		const span = publicPrivateSpan = $("span").el;
		$qAsync("div._ap3a")
			.then((div) => div.appendChild(span));
	}

	if (savedIsPrivate === undefined) {
		savedIsPrivate = isPrivate;
		publicPrivateSpan.textContent = isPrivate ? "-Private"
			: (isPrivate === false) ? "-Public"
			: "-Unknown";
	}
};