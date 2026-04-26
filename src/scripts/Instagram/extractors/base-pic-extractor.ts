import { EventHostBase } from "~/utils/observable";
import { type SnoopHandler, SnoopRequest } from "~/utils/snoop";
import { PicGroup } from "../models/pic-group";
import { apiTimesTouch } from "./api-times";
import { type MediaNode } from "./ig-types";

export type HandledRequest = SnoopRequest & {
	handled?: string; // the class that handled it
	batch?: PicGroup[]; // the batch of pics extracted from it, if applicable
	notHandled?: string; // if it wasn't handled, a description of what it was
};

export type BatchProducerEvents = {
	batchReceived: [batch: PicGroup[]];
};

export abstract class BasePicExtractor extends EventHostBase<BatchProducerEvents> {

	setBatch(batch: PicGroup[]): void {
		this.trigger("batchReceived", batch);
	}

	abstract matches( url: URL, body? : string ): boolean;

	abstract findMediaArray(json: unknown): MediaNode[];

	handleError?( err: unknown, responseText: string ): void;

	snoop:SnoopHandler = (x:SnoopRequest) => {

		const { url, body }  = x;
		if (this.matches(url, body)) {
			const handledLabel = this.getHandledLabel(x);
			apiTimesTouch(handledLabel);
			const handledRequest = x as HandledRequest;
			this.processResponse(handledRequest);
			handledRequest.handled = handledLabel;
		}
	};

	getHandledLabel(x:SnoopRequest) { void x; return this.constructor.name; }

	processResponse(x:HandledRequest): void {
		try {
			const batch: PicGroup[] = this.findMediaArray(x.json).map(PicGroup.fromMediaWithUser);
			this.setBatch( x.batch = batch );
		}
		catch (err) {
			if (this.handleError) {
				this.handleError(err, x.responseText);
				return;
			}
			console.error("Error parsing responseText", err);
		}
	}
}
