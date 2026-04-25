import { type EventHost, makeEventHost, type OnFn, type TriggerFn } from "~/utils/observable";
import { dom } from "../dom";
import { PicGroup } from "../pic-group";
import { findProp } from "../prune-hay";
import { type BatchProducerEvents } from "./base-pic-extractor";
import { type Edge } from "./ig-types";

// sample response: location-initial-script
export class InitialLocationPageParser implements EventHost<BatchProducerEvents> {

	id: number;

	public on!: OnFn<BatchProducerEvents>;
	public trigger!: TriggerFn<BatchProducerEvents>;

	constructor() {
		makeEventHost(this);
		this.id = setInterval(() => this.scanScriptsForMedia(), 3000);
	}

	scanScriptsForMedia() {
		const scripts: HTMLScriptElement[] = dom.scripts;

		// try to find the 1 edge that contains the media nodes
		const edgeScripts = scripts
			.filter((x) => x.innerHTML.includes("edges"))
			.map(x => x.innerHTML);

		const edgeArrays = edgeScripts
			.map((x) => findProp(JSON.parse(x), "edges") as Edge[] | undefined | null)
			.filter((x): x is Edge[] => Array.isArray(x));

		// if we don't find exactly 1, something is wrong and we should wait for the next scan
		if (edgeArrays.length != 1) {
			console.log(`${edgeArrays.length} media-nodes scrips found.`);
			return;
		}

		// get the PicGroup array from the media nodes and save it as the last batch
		try {
			const batch = edgeArrays[0]
				.map((x) => x.node)
				.map(PicGroup.fromMediaWithUser);

			this.trigger("batchReceived", batch);
		}
		catch (ex) {
			console.error(ex);
		}

		clearInterval(this.id);
	}
}
