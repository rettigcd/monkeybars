import { type ObservableListener } from "~/lib/observable";
import { throwExp } from "~/lib/throw";
import type { BatchProducerGroup } from "../extractors/batch-producer-group";
import { PicGroup } from "../pic-group";
import { dom } from "../services/dom";
import { loadTime } from "../services/storage-time";
import { SingleImage } from "../single-image";
import type { UserRepo } from "../types/repo-types";

type UserUpdateServiceConstructor = {
	userRepo: UserRepo;
	batchProducer: BatchProducerGroup;
}

// Monitors Batches as they come in and updates User data
export class UserUpdateService {

	userRepo: UserRepo;
	pageOwner: string;
	loadTimeMs: number;

	constructor({ userRepo, batchProducer }: UserUpdateServiceConstructor) {
		this.userRepo = userRepo || throwExp("UserService missing userRepo");
		this.pageOwner = dom.pageOwner;
		this.loadTimeMs = loadTime;

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
				pic.listen("downloaded", this.singlePicDownloadListener);
	}

	singlePicDownloadListener : ObservableListener<SingleImage, "downloaded"> = ({ host: { owner, date }, newValue:downloaded }) => {
		if (downloaded && owner) {
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
