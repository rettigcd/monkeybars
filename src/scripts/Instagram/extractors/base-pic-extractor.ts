import { EventHost, makeEventHost, OnFn, TriggerFn } from "~/utils/observable";
import { SnoopHandler, SnoopRequest } from "~/utils/snoop";
import { PicGroup } from "../pic-group";
import { apiTimesTouch } from "./api-times";
import { MediaNode } from "./ig-types";

export type HandledRequest = SnoopRequest & {
	handled?: string; // the class that handled it
	batch?: PicGroup[]; // the batch of pics extracted from it, if applicable
	notHandled?: string; // if it wasn't handled, a description of what it was
};

export type BatchProducerEvents = {
	batchReceived: [batch: PicGroup[]];
};

export abstract class BasePicExtractor implements EventHost<BatchProducerEvents> {

	public on!: OnFn<BatchProducerEvents>;
	public trigger!: TriggerFn<BatchProducerEvents>;

	constructor() {
		makeEventHost<BasePicExtractor,BatchProducerEvents>(this);
	}

	setBatch(batch: PicGroup[]): void {
		this.trigger("batchReceived", batch);
	}

	abstract matches( url: URL, body? : string ): boolean;

	abstract findMediaArray(json: unknown): MediaNode[];

	handleError?( err: unknown, responseText: string ): void;

	snoop:SnoopHandler = (x:SnoopRequest) => {

		const { url, body }  = x;
		if (this.matches(url, body)) {
			apiTimesTouch(this.constructor.name);
			const handledRequest = x as HandledRequest;
			this.processResponse(handledRequest);
			handledRequest.handled = this.constructor["name"];
		}
	};

	processResponse(x:HandledRequest): void {
		const { responseText } = x;
		try {
			const json = JSON.parse(responseText);
			const batch: PicGroup[] = this.findMediaArray(json).map(PicGroup.fromMediaWithUser);
			this.setBatch( x.batch = batch );
		}
		catch (err) {
			if (this.handleError) {
				this.handleError(err, responseText);
				return;
			}
			console.error("Error parsing responseText", err);
		}
	}
}
