import { delayAsync } from "~/lib/async";
import { TimeStampConsoleLogger } from "../logging";
import { ShowService } from "../show-service";
import { ShowWatcher, WaitStatus } from "./show-appear-waiter";

type StatusChangedHandler = (status: WaitStatus) => void;

export class ShowServiceChecker implements ShowWatcher{
	private readonly onStatus: StatusChangedHandler		
	private readonly logger: TimeStampConsoleLogger;
	private readonly showService: ShowService;

	constructor( 
		onStatus: StatusChangedHandler,
		logger: TimeStampConsoleLogger,
		showService: ShowService
	){
		this.onStatus = onStatus;
		this.logger = logger;
		this.showService = showService;
	}

	async watch(signal:AbortSignal): Promise<{ reason: string }> {
		let attempt = 0;

		while (!signal.aborted) {
			await delayAsync(500, signal);

			if (signal.aborted)
				break;

			try {
				const status = await this.checkForShowsAsync(++attempt);
				this.onStatus(status);

				if (status.count !== "?" && status.count > 0) {
					return { reason: "showService found shows" };
				}
			} catch (err) {
				this.logger.log(err);
			}
		}

		return {reason:"aborted"};
	}

	private async checkForShowsAsync(attempt: number): Promise<WaitStatus> {
		const checkingStatus: WaitStatus = { attempt, count: "?" };
		this.onStatus(checkingStatus);

		const shows = await this.showService.fetchShowsAsync();

		const checkedStatus: WaitStatus = { attempt, count: shows.length };
		this.onStatus(checkedStatus);

		return checkedStatus;
	}

}
