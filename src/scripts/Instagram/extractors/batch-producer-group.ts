import { makeEventHost, type EventHost, type OnFn, type TriggerFn } from "~/utils/observable";
import { RequestSnooper } from "~/utils/snoop";
import { type BatchProducerEvents } from "./base-pic-extractor";
import { DetailsPopup } from "./misc/details-popup";
import { PicGroup } from "./pic-group";
import { Profile_Posts, Profile_Tagged } from "./user/profile-extractors";
import { SavedPosts } from "./user/saved-posts";
import { UserPosts } from "./user/user-posts";

// Generates batches of PicGroups from multiple sources, and marks them as new or not based on the last visit timestamp. 
export class BatchProducerGroup 
	implements EventHost<BatchProducerEvents> 
{
	lastVisit: number;

	public on!: OnFn<BatchProducerEvents>;
	public trigger!: TriggerFn<BatchProducerEvents>;

	constructor(lastVisit: number|undefined, batchProviders: EventHost<BatchProducerEvents>[]) {
		this.lastVisit = lastVisit || 0;
		makeEventHost<BatchProducerGroup, BatchProducerEvents>(this);

		for (const source of batchProviders)
			source.on("batchReceived", this.routeBatch);
	}

	routeBatch = ( batch: PicGroup[] ) => {
		for (const picGroup of batch)
			picGroup.isNew = this.isNew(picGroup);
		this.trigger("batchReceived", batch);
	};

	isNew(picGroup:PicGroup): boolean {
		return this.lastVisit < picGroup.dateNum;
	}
}

export function buildBatchProducerGroup_ForUser(snooper:RequestSnooper, lastVisit:number|undefined) {
	return new BatchProducerGroup(lastVisit, [
		new Profile_Posts(snooper),
		new Profile_Tagged(snooper),
		new SavedPosts(snooper),
		new UserPosts(snooper),
		new DetailsPopup(snooper),
	]);

}