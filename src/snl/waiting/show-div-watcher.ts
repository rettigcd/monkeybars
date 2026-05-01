import { delayAsync } from "~/lib/async";
import { ShowAppearWaitResult } from "./show-appear-waiter";
import { findShowDivs } from "./show-service";

export class ShowDivWatcher {

	async watch(signal:AbortSignal) : Promise<ShowAppearWaitResult> {
		while(!signal.aborted) {
			await delayAsync(100,signal);
			const showCount = findShowDivs().length;
			if (showCount)
				return { reason: "found DIVS", showCount };
		}
		return { reason: "aborted" };
	}

}
