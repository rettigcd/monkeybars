import { $ } from "~/lib/dom3";

import { HotkeyManager } from "../../lib/hotkey-manager";
import type { SnlWindow } from "../../snl/window";
import { reportLast } from "../age";
import { buildBatchProducerGroup_ForUser } from "../extractors/batch-producer-group";
import { userRepo, type LocalStorageUserEntity } from "../local-storage";
import { ImageLookupByUrl } from "../services/image-lookup-by-url";
import { instaDom, pageOwnerName } from "../services/instaDom";
import { buildRequestSnooper } from "../services/snoopBuilder";
import { makeStatusGroupTree } from "../status-group-tree";
import { scheduleSetTabTitle } from "../tab-text";
import { FollowingScrollerTracker } from "../trackers/following-scroller-tracker";
import { IdentifyUnhandledRequests } from "../trackers/identify-unhandled-requests";
import { UnfollowTracker } from "../trackers/unfollow-tracker";
import { UserUpdateService } from "../trackers/user-update-service";
import { setPublicPrivateLabel, VisitingUserTracker, type InstagramUser } from "../trackers/visiting-user-tracker";
import { Gallery } from "../ui/gallery";
import { SidePanel } from "../ui/side-panel";
import { makeStatusGroupTable } from "../ui/status-group-table";
import { addCopyButton } from "../ui/ui";
import { UserCtx } from "../user-ctx";
import { VideoSniffer } from "../services/video-sniffer";

// TODO: add proper types if you have them
type ConstructorArgs = {
	win: SnlWindow;
	hotkeys: HotkeyManager
};

const nextLinkHostCss = {
	position: "fixed",
	top: "0",
	right: "0",
	background: "#ddf",
	padding: "5px",
};

// Distinct from the status table so it doesn't read as another stat row.
const pageOwnerBarCss = {
	display: "flex",
	gap: "12px",
	justifyContent: "center",
	marginTop: "6px",
	padding: "4px 8px",
	borderRadius: "4px",
	background: "#FFD700",
	color: "black",
	fontSize: "12px",
	fontWeight: "bold",
};


export class UserPage {
	private cmd: any;
	private pageOwnerName: string;
	private pageOwnerCtx: UserCtx;
	private readonly startingState: Partial<LocalStorageUserEntity>;


	public constructor({ win, hotkeys }: ConstructorArgs) {

		const snooper = buildRequestSnooper( win );

		// capture starting state
		this.pageOwnerName = pageOwnerName;
		const pageOwnerCtx = this.pageOwnerCtx = new UserCtx(pageOwnerName);

		// BUG: This would be correct if dl indicated we actually visited a page.
		// However, location pages are incorrectly ++dl so this is not correct until we get that stopped.
		// pageOwnerCtx.applyDlYear();

		const isTracking = pageOwnerCtx.isTracking;
		this.startingState = isTracking ? pageOwnerCtx.cloneLocalStorage() : {};
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
		const batchProducer = buildBatchProducerGroup_ForUser(snooper,this.startingState.lastVisit);

		new UserUpdateService({batchProducer});
		new VideoSniffer(snooper); // after the extractors: picks up videos (e.g. Reels) they don't handle

		const iiLookup = new ImageLookupByUrl(batchProducer);
		iiLookup.on("missingImage", snooper.checkLogForMissingImage);

		// === UI stuff ===
		const gallery = new Gallery({batchProducer, getId: () => instaDom.pageOwnerId});

		const sidePanel = new SidePanel({ batchProducer }).register(hotkeys);

		window.addEventListener("load", () => this.onWindowLoad() ); // more UI init

		// --- global ctx ---
		this.cmd = win.cmd = {
			snoopLog: snooper._loadLog,
			userRepo,
			iiLookup,
			page: this,
			pageOwnerName,
			pageOwnerCtx,
			gallery,
			sidePanel,
			startingState:this.startingState,
			group: makeStatusGroupTree
		};

		if (isTracking)
			this.initTrackedUser();
		else
			this.initUntrackedUser();

		this.logStartingState();
		reportLast(this.startingState.lastVisit, "Visit");

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
		addCopyButton(this.pageOwnerName);
	}

	private showNextLinks() {

		$("div").css(nextLinkHostCss)
			.withChildren(
				makeStatusGroupTable(makeStatusGroupTree()),
				this.makeStatusDiv(),
				this.pageOwnerCtx.isTracking ? $('button').on('click',(e)=>{ 
					if(!confirm("Pruning current user.")) return;
					this.pageOwnerCtx.prune(); 
					(e.currentTarget as HTMLButtonElement)?.remove();
				} ).txt("prune") : null
			)
			.appendTo(instaDom.body);

	}

	// Stand-alone bar (below the status table) describing the page owner. Hidden when there is nothing to show.
	private makeStatusDiv(){
		const {lastVisit} = this.startingState;
		const hasVisit = lastVisit !== undefined && 0 < lastVisit;
		if(!hasVisit && this.pageOwnerCtx.totalDownloads === 0)
			return null;

		return $('div').css(pageOwnerBarCss).withChildren(
			$('span').txt(hasVisit ? `Last Visit: ${new Date(lastVisit).toDateString()}` : "Last Visit: none" ),
			$('span').txt(`DL: ${this.pageOwnerCtx.downloadsInLastYear}` ),
		)
	}

	private logStartingState() {
		console.log(JSON.stringify(this.startingState, null, "\t"));
	}

	private initTrackedUser() {
		const { cmd } = this;

		this.pageOwnerCtx.recordVisit();
		setPublicPrivateLabel(this.startingState.isPrivate);
		cmd.stop = () => cmd.old = new UserCtx(pageOwnerName).prune();
	}

	private initUntrackedUser() {
		const { cmd } = this;

		cmd.stop = () => {
			console.log("Tracking was previously stopped.");
		};
	}

}
