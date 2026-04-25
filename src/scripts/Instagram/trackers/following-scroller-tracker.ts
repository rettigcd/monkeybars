import { type EventHost, makeEventHost, type OnFn, type TriggerFn } from "~/utils/observable";
import { RequestSnooper, type SnoopHandler } from "~/utils/snoop";
import { type InstagramUser } from "./visiting-user-tracker";

export type FollowingScrollerEvents = {
	foundLeaders: [followerId: string, leaders: InstagramUser[]];
};

// Load followers by scrolling through list
export class FollowingScrollerTracker implements EventHost<FollowingScrollerEvents> {

	public on!: OnFn<FollowingScrollerEvents>;
	public trigger!: TriggerFn<FollowingScrollerEvents>;
	
	constructor(snooper:RequestSnooper) {
		makeEventHost<FollowingScrollerTracker,FollowingScrollerEvents>(this);
		snooper.addHandler(this.snoop);
	}

	snoop: SnoopHandler = ({ url, responseText }) => {
		const match = url.pathname.match(/friendships\/(\d+)\/following/);
		if (match === null)
			return;

		const followerId = match[1];
		const leaders = JSON.parse(responseText).users as InstagramUser[];
		this.trigger("foundLeaders", followerId, leaders);
	};
}
