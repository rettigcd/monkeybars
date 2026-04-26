import { $, $qAsync } from "~/utils/dom3";
import { SyncedPersistentDict } from "~/utils/storage";

import type { SnlWindow } from "../../snl/window";
import { buildBatchProducerGroup_ForUser } from "../extractors/batch-producer-group";
import { dom } from "../services/dom";
import { calcDownloadsInLastYear } from "../services/download-stats";
import { ImageLookupByUrl } from "../services/image-lookup-by-url";
import { HotkeyManager } from "../services/key-presses";
import { buildRequestSnooper } from "../services/snoopBuilder";
import { loadTime, reportLast } from "../services/storage-time";
import { scheduleSetTabTitle } from "../tab-text";
import { FollowingScrollerTracker } from "../trackers/following-scroller-tracker";
import { IdentifyUnhandledRequests } from "../trackers/identify-unhandled-requests";
import { UnfollowTracker } from "../trackers/unfollow-tracker";
import { UserUpdateService } from "../trackers/user-update-service";
import { type InstagramUser, setPublicPrivateLabel, VisitingUserTracker } from "../trackers/visiting-user-tracker";
import type { UserEntity, UserRepo } from "../types/repo-types";
import { Gallery } from "../ui/gallery";
import { NextLink } from "../ui/next-link";
import { SidePanel } from "../ui/side-panel";
import { addCopyButton } from "../ui/ui";
import { UserReports } from "../user-reports";

// TODO: add proper types if you have them
type ConstructorArgs = {
	win: SnlWindow;
	hotkeys: HotkeyManager
};

export class UserPage {
	private userRepo: UserRepo;
	private ctx: any;
	private reports: UserReports;
	private pageOwner: string;

	public constructor({ win, hotkeys }: ConstructorArgs) {

		const userRepo = this.userRepo = new SyncedPersistentDict("users");
		const snooper = buildRequestSnooper( win );

		const { pageOwner, isTracking, startingState } = this.captureStartingState();
		this.pageOwner = pageOwner;

		// --- trackers ---
		new UnfollowTracker(snooper, userRepo);
		new VisitingUserTracker({snooper,userRepo});
		new IdentifyUnhandledRequests(snooper);
		new FollowingScrollerTracker(snooper)
			.on("foundLeaders", (followerId, leaders) =>
				this.savePeopleIAmFollowing({ followerId, leaders })
			);

		// --- batch ---
		const batchProducer = buildBatchProducerGroup_ForUser(snooper,startingState.lastVisit);

		new UserUpdateService({userRepo,batchProducer});
		const gallery = new Gallery({batchProducer});

		const sidePanel = new SidePanel({ batchProducer, userRepo });
		sidePanel.register(hotkeys);

		// --- lookup ---
		const iiLookup = new ImageLookupByUrl(batchProducer);
		iiLookup.on("missingImage", snooper.checkLogForMissingImage);

		const reports = this.reports = new UserReports({ userRepo, iiLookup });

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
			this.userRepo.update(user.username, (u: any) => {
				u.username = user.username;
				u.fullName = user.full_name;
				u.isPrivate = user.is_private;
				u.id = user.id;
				u.isFollowing = true;
			});
	}

	private onWindowLoad() {
		this.showNextLinks();
		scheduleSetTabTitle();
		this.addDownloadCountBadge(calcDownloadsInLastYear);
		addCopyButton(this.pageOwner);
	}

	private addDownloadCountBadge(countUserDownloads: any) {
		const user = this.userRepo.get(this.pageOwner) || {};
		const count = countUserDownloads(user);

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
			.appendTo(dom.body);

		this.oldestDownloadedLink(reports).appendTo(host.el);
		this.oldestTrackedLink(reports).appendTo(host.el);
	}

	private captureStartingState() : {
		pageOwner: string;
		isTracking: boolean;
		startingState: Partial<UserEntity>;
	} {
		const pageOwner = this.pageOwner = dom.pageOwner;
		const isTracking = this.userRepo.containsKey(pageOwner);
		const startingState: Partial<UserEntity> = isTracking
			? structuredClone(this.userRepo.get(pageOwner))
			: {};

		return { pageOwner, isTracking, startingState };
	}

	private logStartingState(startingState: Partial<UserEntity>) {
		console.log(JSON.stringify(startingState, null, "\t"));
	}

	private initTrackedUser({ pageOwner, startingState }: any) {
		const { userRepo, ctx } = this;

		userRepo.update(pageOwner, (u: any) => (u.lastVisit = loadTime));
		setPublicPrivateLabel(startingState.isPrivate);

		ctx.stop = () => {
			ctx.old = userRepo.get(pageOwner);
			userRepo.remove(pageOwner);
			console.log("Stopped tracking:", ctx.old);
		};
	}

	private initUntrackedUser() {
		const { ctx } = this;

		ctx.stop = () => {
			console.log("Tracking was previously stopped.");
		};
	}

	private oldestDownloadedLink(reports: UserReports) {
		return NextLink.forFirstUser("stale downloaded", reports.downloaded.stale());
	}

	private oldestTrackedLink(reports: UserReports) {
		return NextLink.forFirstUser("stale followed", reports.followed.stale());
	}
}
