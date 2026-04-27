import { ObservableBase } from "~/lib/observable";
import { type TimeStampConsoleLogger } from "../logging";
import { SECONDS } from "../time-format";
import { GoTimeWaiter } from "./go-time-waiter";
import { ShowAppearWaiter, type WaitStatus } from "./show-appear-waiter";

type ShowService = {
	fetchShowsAsync: () => Promise<unknown[]>;
};

export type WaitResult = {
	phase: "before" | "go" | "after" | "timeout";
	reason: string;
	shouldReload: boolean;
};

export class Waiter extends ObservableBase<Waiter> {

	public waitStatus: WaitStatus | undefined = undefined; // observable

	private readonly goTimeWaiter: GoTimeWaiter;
	private readonly showAppearWaiter: ShowAppearWaiter;

	public constructor(
		showService: ShowService,
		logger: TimeStampConsoleLogger,
		waitForShowsTimeout: number,
	) {
		super();
		this.goTimeWaiter = new GoTimeWaiter(logger, waitForShowsTimeout);
		this.showAppearWaiter = new ShowAppearWaiter(
			showService,
			logger,
			(status) => { this.waitStatus = status; }
		);
	}

	public async waitAsync(targetTime: Date, showAppearTimeout = 3 * SECONDS): Promise<WaitResult> {
		const goTimeResult = await this.goTimeWaiter.waitUntilNextAsync(targetTime);

		switch (goTimeResult.phase) {
			case "before":
			case "timeout":
				return {
					phase: goTimeResult.phase,
					reason: goTimeResult.phase,
					shouldReload: true,
				};
			case "go":
			case "after": {
				const showAppearResult = await this.showAppearWaiter.waitForShowsToAppearAsync(showAppearTimeout);
				return {
					phase: goTimeResult.phase,
					reason: showAppearResult.reason,
					shouldReload: true,
				};
			}
		}
	}

	public get delay(): number | undefined {
		return this.goTimeWaiter.delay;
	}

	public get phase(): string | undefined {
		return this.goTimeWaiter.phase;
	}

}