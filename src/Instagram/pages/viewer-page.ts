import type { SnlWindow } from "../../snl/window";
import { buildBatchProducerGroup_ForUser } from "../extractors/batch-producer-group";
import { buildRequestSnooper } from "../services/snoopBuilder";
import { VideoSniffer } from "../services/video-sniffer";
import { UserUpdateService } from "../trackers/user-update-service";

type ViewerPageConstructorArgs = {
	win: SnlWindow;
};

// Reels feed, single reels, Stories and Highlights: not a profile, so no tracking UI
// (side panel, owner bar, tab title, copy button) - but still intercept requests,
// so the hotkeys can download what's on screen.
export class ViewerPage {
	public constructor({ win }: ViewerPageConstructorArgs) {
		const snooper = buildRequestSnooper(win);
		const batchProducer = buildBatchProducerGroup_ForUser(snooper, undefined); // registers videos found by the extractors
		new UserUpdateService({ batchProducer });
		new VideoSniffer(snooper);
	}
}
