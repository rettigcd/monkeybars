import { RequestSnooper, type SnoopHandler } from "~/lib/snoop";
import { SyncedPersistentDict } from "~/lib/storage";
import type { LocalStorageUserEntity } from "../types/local-storage-types";

// UnfollowTracking
// Doesn't need to be a class.
// Could just be a function that takes the snooper and userRepo as arguments and adds the handler to the snooper.
export class UnfollowTracker {

	_userRepo: SyncedPersistentDict<LocalStorageUserEntity>;

	constructor(snooper: RequestSnooper, userRepo:SyncedPersistentDict<LocalStorageUserEntity>) {
		this._userRepo = userRepo;
		snooper.addHandler(this.snoop);
	}

	snoop: SnoopHandler = ({ url, body, responseText }) => {
		if (
			url.pathname === "/graphql/query"
			&& new URLSearchParams(body).get("fb_api_req_friendly_name") === "usePolarisUnfollowMutation"
		) {
			const { data: { xdt_destroy_friendship: { username } } } = JSON.parse(responseText);
			console.log("unfriending: ", username);
			this._userRepo.update(username, (x) => x.isFollowing = false);
		}
	};
}
