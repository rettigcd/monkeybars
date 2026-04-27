import { $, $qAsync } from "~/lib/dom3";
import { RequestSnooper, type SnoopHandler } from "~/lib/snoop";
import type { HandledRequest } from "../extractors/base-pic-extractor";
import { loadTime } from "../services/storage-time";
import type { UserRepo } from "../types/repo-types";

type VisitingUserTrackerConstructionArgs = {
	snooper: RequestSnooper, 
	userRepo: UserRepo
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

	private userRepo: UserRepo;
	private loadTimeMs: number; // !!!

	constructor({ snooper, userRepo } : VisitingUserTrackerConstructionArgs) {
		this.userRepo = userRepo;
		this.loadTimeMs = loadTime;
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
			const following = user.friendship_status == "followiwng!!!"; // !!! WRONG

			if (following || this.userRepo.containsKey(user.username)) {
				this.userRepo.update(user.username, (u) => {
					u.id = user.id;
					u.username = user.username;
					u.fullName = user.full_name;
					u.isPrivate = user.is_private;
					u.isFollowing = following;
					u.lastVisit = this.loadTimeMs;
				});

				setPublicPrivateLabel(user.is_private);
			}
		}
	};
}


let publicPrivateSpan: HTMLElement | null = null;
let savedIsPrivate: boolean | undefined;

export function setPublicPrivateLabel(isPrivate:boolean) {
	if (publicPrivateSpan == null) {
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