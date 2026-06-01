import { type ObservableListener } from "~/lib/observable";
import { loadTimeMs } from "../age";
import type { BatchProducerGroup } from "../extractors/batch-producer-group";
import { PicGroup } from "../models/pic-group";
import { SingleImage } from "../models/single-image";
import { pageOwnerName } from "../services/instaDom";
import { UserCtx } from "../user-ctx";

type UserUpdateServiceConstructor = {
	batchProducer: BatchProducerGroup;
}

// Monitors Batches as they come in:
// -> attaches a downloadProgress monitor to each image
// -> calls .recordDownload(date) on user for each image downloaded.
export class UserUpdateService {

	pageOwner: string;
	loadTimeMs: number;

	constructor({ batchProducer }: UserUpdateServiceConstructor) {
		this.pageOwner = pageOwnerName;
		this.loadTimeMs = loadTimeMs;

		batchProducer.on("batchReceived", ( batch ) => {
			this.onScan_UpdateFollowingLikedLastUpload(batch);
			this.registerDownloadListeners(batch);
		});
	}

	private onScan_UpdateFollowingLikedLastUpload(batch:PicGroup[]) {
		batch.forEach(({ owner, following }) => {
			const userCtx = new UserCtx(owner);
			if (following !== undefined && (following || userCtx.isTracking))
				userCtx.isFollowing = following;
		});
	}

	// adds download listenter to every image.
	private registerDownloadListeners(batch:PicGroup[]) {
		for (const { pics } of batch)
			for (const pic of pics)
				pic.listen("downloadProgress", this.singlePicDownloadListener);
	}

	// when a pick is downloaded, updates user's download count
	private readonly singlePicDownloadListener : ObservableListener<SingleImage, "downloadProgress"> = ({ host: { owner, date }, newValue:progress }) => {
		if (progress.status == "complete" && owner)
			new UserCtx(owner).recordDownload(date);
	}
}
