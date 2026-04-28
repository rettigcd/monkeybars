import { delayAsync } from "~/lib/async";
import { ShowWatcher } from "./show-appear-waiter";

export class ShowTimeout implements ShowWatcher{
	private readonly timeout:number; 
	constructor(timeout:number){
		this.timeout = timeout;
	}

	async watch(signal:AbortSignal): Promise<{ reason: string }> {
		await delayAsync(this.timeout, signal);
		if (signal.aborted)
			return { reason:"aborted"};
		return { reason: "timed out waiting for show to appear" };
	}
}
