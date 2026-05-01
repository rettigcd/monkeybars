import { delayAsync } from "~/lib/async";
import { ShowAppearWaitResult, ShowWatcher } from "./show-appear-waiter";

// Waits a certain amount of time for a show to appear then just times out.
export class ShowTimeout implements ShowWatcher{

	private readonly timeout:number; 

	constructor(timeout:number){
		this.timeout = timeout;
	}

	async watch(signal:AbortSignal): Promise<ShowAppearWaitResult> {
		await delayAsync(this.timeout, signal);
		if (signal.aborted)
			return { reason:"aborted"};
		return { reason: `timed out (${this.timeout}mS) waiting for show to appear` };
	}
}
