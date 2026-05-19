import { RequestSnooper, type SnoopHandler } from "~/lib/snoop";
import { UserCtx } from "../user-ctx";

// UnfollowTracking
// Doesn't need to be a class.
// Could just be a function that takes the snooper and userRepo as arguments and adds the handler to the snooper.
export class UnfollowTracker {

	constructor(snooper: RequestSnooper) {
		snooper.addHandler(this.snoop);
	}

	snoop: SnoopHandler = ({ url, body, responseText }) => {
		if (
			url.pathname === "/graphql/query"
			&& new URLSearchParams(body).get("fb_api_req_friendly_name") === "usePolarisUnfollowMutation"
		) {
			const { data: { xdt_destroy_friendship: { username } } } = JSON.parse(responseText);
			console.log("unfriending: ", username);
			new UserCtx(username).isFollowing = false;
		}
	};
}
