import { $, $qAsync } from "~/lib/dom3";

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
import { UserCtx } from "../user-ctx";
import { UserReports } from "../user-reports";

// TODO: add proper types if you have them
type ConstructorArgs = {
	win: SnlWindow;
	hotkeys: HotkeyManager
};

export class UserPage {
	private ctx: any;
	private reports: UserReports;
	private pageOwner: string;

	public constructor({ win, hotkeys }: ConstructorArgs) {

		const snooper = buildRequestSnooper( win );

		const { pageOwner, isTracking, startingState } = this.captureStartingState();
		this.pageOwner = pageOwner;

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

		const reports = this.reports = new UserReports({ iiLookup });

		// --- global ctx ---
		this.ctx = win.cmd = {
			snoopLog: snooper._loadLog,
			userRepo,
			iiLookup,
			reports,
			page: this,
			next: () => this.oldestTrackedLink(reports).goto(),
			nextDownloaded: () => this.oldestDownloadedLink(reports).goto(),
			pageOwner,
			gallery,
			sidePanel,
			startingState,
		};

		window.addEventListener("load", () => this.onWindowLoad() );

		if (isTracking)
			this.initTrackedUser({ pageOwner, startingState });
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

		for (const user of leaders)
			new UserCtx(user.username).save(user);
	}

	private onWindowLoad() {
		this.showNextLinks();
		scheduleSetTabTitle();
		this.addDownloadCountBadge();
		addCopyButton(this.pageOwner);
	}

	private addDownloadCountBadge() {
		const count = new UserCtx(this.pageOwner).downloadsInLastYear;

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
		const { reports } = this;

		const host = $("div")
			.css({
				position: "fixed",
				top: "0",
				right: "0",
				background: "#ddf",
				padding: "5px",
			})
			.appendTo(instaDom.body);

		this.oldestDownloadedLink(reports).appendTo(host.el);
		this.oldestTrackedLink(reports).appendTo(host.el);
	}

	private captureStartingState() : {
		pageOwner: string;
		isTracking: boolean;
		startingState: Partial<LocalStorageUserEntity>;
	} {
		const pageOwner = this.pageOwner = pageOwnerName;
		const isTracking = new UserCtx(pageOwner).isTracking;
		const startingState: Partial<LocalStorageUserEntity> = isTracking
			? new UserCtx(pageOwner).cloneLocalStorage()
			: {};

		return { pageOwner, isTracking, startingState };
	}

	private logStartingState(startingState: Partial<LocalStorageUserEntity>) {
		console.log(JSON.stringify(startingState, null, "\t"));
	}

	private initTrackedUser({ pageOwner, startingState }: any) {
		const { ctx } = this;

		new UserCtx(pageOwner).recordVisit();
		setPublicPrivateLabel(startingState.isPrivate);

		ctx.stop = () => ctx.old = new UserCtx(pageOwner).prune();
	}

	private initUntrackedUser() {
		const { ctx } = this;

		ctx.stop = () => {
			console.log("Tracking was previously stopped.");
		};
	}

	private oldestDownloadedLink(reports: UserReports) {
		return NextLink.forFirstUser("stale downloaded", reports.downloaded.stale(), '');
	}

	private oldestTrackedLink(reports: UserReports) {
		return NextLink.forFirstUser("stale followed", reports.followed.stale(), '');
	}
}
