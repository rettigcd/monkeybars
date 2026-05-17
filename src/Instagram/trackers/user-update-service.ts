import { type ObservableListener } from "~/lib/observable";
import { SyncedPersistentDict } from "~/lib/storage";
import { throwExp } from "~/lib/throw";
import type { BatchProducerGroup } from "../extractors/batch-producer-group";
import { PicGroup } from "../models/pic-group";
import { SingleImage } from "../models/single-image";
import { instaDom } from "../services/instaDom";
import { loadTimeMs } from "../services/storage-time";
import { type LocalStorageUserEntity } from "../types/local-storage-types";

type UserUpdateServiceConstructor = {
	userRepo: SyncedPersistentDict<LocalStorageUserEntity>;
	batchProducer: BatchProducerGroup;
}

// Monitors Batches as they come in and updates User data
export class UserUpdateService {

	userRepo: SyncedPersistentDict<LocalStorageUserEntity>;
	pageOwner: string;
	loadTimeMs: number;

	constructor({ userRepo, batchProducer }: UserUpdateServiceConstructor) {
		this.userRepo = userRepo || throwExp("UserService missing userRepo");
		this.pageOwner = instaDom.pageOwner;
		this.loadTimeMs = loadTimeMs;

		this.singlePicDownloadListener = this.singlePicDownloadListener.bind(this);

		batchProducer.on("batchReceived", ( batch ) => {
			this.onScan_UpdateFollowingLikedLastUpload(batch);
			this.registerDownloadListeners(batch);
		});
	}

	onScan_UpdateFollowingLikedLastUpload(batch:PicGroup[]) {
		batch.forEach(({ owner, following }) => {
			if (following || this.userRepo.containsKey(owner)) {
				this.userRepo.update(owner, (x) => {
					x.username = owner;
					if (following)
						x.isFollowing = following;
				});
			}
		});
	}

	registerDownloadListeners(batch:PicGroup[]) {
		for (const { pics } of batch)
			for (const pic of pics)
				pic.listen("downloadProgress", this.singlePicDownloadListener);
	}

	singlePicDownloadListener : ObservableListener<SingleImage, "downloadProgress"> = ({ host: { owner, date }, newValue:progress }) => {
		if (progress.status == "complete" && owner) {
			const year = date.getFullYear();
			this.userRepo.update(owner, (u) => {
				u.username ??= owner;
				u.dl ??= {};
				u.dl[year] = (u.dl[year] || 0) + 1;
				if (owner === this.pageOwner && (u.lastVisit || 0) < this.loadTimeMs)
					u.lastVisit = this.loadTimeMs;
			});
		}
	}
}
