import { $, $qAsync } from "~/lib/dom3";

import { by } from "~/lib/sorting";
import { HotkeyManager } from "../../lib/hotkey-manager";
import type { SnlWindow } from "../../snl/window";
import { buildBatchProducerGroup_ForUser } from "../extractors/batch-producer-group";
import { userRepo, type LocalStorageUserEntity } from "../local-storage";
import { ImageLookupByUrl } from "../services/image-lookup-by-url";
import { instaDom, pageOwnerName } from "../services/instaDom";
import { buildRequestSnooper } from "../services/snoopBuilder";
import { reportLast } from "../services/storage-time";
import { scheduleSetTabTitle } from "../tab-text";
import { FollowingScrollerTracker } from "../trackers/following-scroller-tracker";
import { IdentifyUnhandledRequests } from "../trackers/identify-unhandled-requests";
import { UnfollowTracker } from "../trackers/unfollow-tracker";
import { UserUpdateService } from "../trackers/user-update-service";
import { setPublicPrivateLabel, VisitingUserTracker, type InstagramUser } from "../trackers/visiting-user-tracker";
import { Gallery } from "../ui/gallery";
import { NextLink } from "../ui/next-link";
import { SidePanel } from "../ui/side-panel";
import { addCopyButton } from "../ui/ui";
import { makeStatusTree, UserCtx } from "../user-ctx";

// TODO: add proper types if you have them
type ConstructorArgs = {
	win: SnlWindow;
	hotkeys: HotkeyManager
};

export class UserPage {
	private ctx: any;
	private pageOwnerName: string;

	public constructor({ win, hotkeys }: ConstructorArgs) {

		const snooper = buildRequestSnooper( win );

		// const { pageOwnerName, isTracking, startingState } = this.captureStartingState();
		// capture starting state
		this.pageOwnerName = pageOwnerName;
		const pageOwnerCtx = new UserCtx(pageOwnerName);
		const isTracking = pageOwnerCtx.isTracking;
		const startingState: Partial<LocalStorageUserEntity> = isTracking
			? pageOwnerCtx.cloneLocalStorage()
			: {};

		this.pageOwnerName = pageOwnerName;

		// --- trackers ---
		new UnfollowTracker(snooper);
		new VisitingUserTracker({snooper});
		new IdentifyUnhandledRequests(snooper);
		new FollowingScrollerTracker(snooper)
			.on("foundLeaders", (followerId, leaders) =>
				this.savePeopleIAmFollowing({ followerId, leaders })
			);

		// --- batch ---
		const batchProducer = buildBatchProducerGroup_ForUser(snooper,startingState.lastVisit);

		new UserUpdateService({batchProducer});
		const gallery = new Gallery({batchProducer});

		const sidePanel = new SidePanel({ batchProducer });
		sidePanel.register(hotkeys);

		// --- lookup ---
		const iiLookup = new ImageLookupByUrl(batchProducer);
		iiLookup.on("missingImage", snooper.checkLogForMissingImage);

		// --- global ctx ---
		this.ctx = win.cmd = {
			snoopLog: snooper._loadLog,
			userRepo,
			iiLookup,
			page: this,
			pageOwnerName,
			pageOwnerCtx,
			gallery,
			sidePanel,
			startingState,
			// group: function(){
			// 	const userCtxs = UserCtx.allUsers();
			// 	const groups = groupBy(userCtxs, ctx=>ctx.groupDescriptor);
			// 	console.log(Object.entries(groups).map(([k,v])=>([k,v.length])));
			// 	return groups;
			// }
			group: makeStatusTree
		};

		window.addEventListener("load", () => this.onWindowLoad() );

		if (isTracking)
			this.initTrackedUser({ pageOwnerName, startingState });
		else
			this.initUntrackedUser();

		this.logStartingState(startingState);
		reportLast(startingState.lastVisit, "Visit");

	}

	// -------------------------------------

	private savePeopleIAmFollowing({ followerId, leaders }: { followerId: string, leaders: InstagramUser[] }) {
		console.log(`Found ${leaders.length} Leaders`);

		if (followerId !== "1039022773")
			return;

		for (const user of leaders){
			const userCtx = new UserCtx(user.username);
			userCtx.isFollowing = true;
			userCtx.isPrivate = user.is_private;
		}
	}

	private onWindowLoad() {
		this.showNextLinks();
		scheduleSetTabTitle();
		this.addDownloadCountBadge();
		addCopyButton(this.pageOwnerName);
	}

	private addDownloadCountBadge() {
		const count = new UserCtx(this.pageOwnerName).downloadsInLastYear;

		if (count <= 0)
			return;

		$qAsync("h2").then((h2El) => {
			const badge = $("div")
				.txt(`↓ ${count} last year`)
				.css({
					margin: "3px",
					padding: "2px 6px",
					color: "white",
					background: "#446",
					borderRadius: "4px",
					fontSize: "12px",
					display: "inline-block",
				});

			const ref = h2El.parentNode;
			ref?.parentNode?.insertBefore(badge.el, ref.nextSibling);
		});
	}

	private showNextLinks() {

		const host = $("div")
			.css({
				position: "fixed",
				top: "0",
				right: "0",
				background: "#ddf",
				padding: "5px",
			})
			.appendTo(instaDom.body);

		const allUsers = UserCtx.allUsers();
		NextLink.forFirstUser("stale downloaded", allUsers.filter(x=>x.totalDownloads && x.isStale).sort(by<UserCtx,number>(x=>x.refreshTime)), '').appendTo(host.el);
		NextLink.forFirstUser("stale followed", allUsers.filter(x=>x.isFollowing && x.isStale).sort(by<UserCtx,number>(x=>x.refreshTime)), '').appendTo(host.el);
	}

	private logStartingState(startingState: Partial<LocalStorageUserEntity>) {
		console.log(JSON.stringify(startingState, null, "\t"));
	}

	private initTrackedUser({ pageOwnerName, startingState }: any) {
		const { ctx } = this;

		new UserCtx(pageOwnerName).recordVisit();
		setPublicPrivateLabel(startingState.isPrivate);

		ctx.stop = () => ctx.old = new UserCtx(pageOwnerName).prune();
	}

	private initUntrackedUser() {
		const { ctx } = this;

		ctx.stop = () => {
			console.log("Tracking was previously stopped.");
		};
	}

}
