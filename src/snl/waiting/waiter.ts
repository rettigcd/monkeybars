import { ObservableBase } from "~/lib/observable";
import { type TimeStampConsoleLogger } from "../logging";
import { ShowService } from "../show-service";
import { SECONDS } from "../time-format";
import { GoTimeWaiter } from "./go-time-waiter";
import { ShowAppearWaiter, type WaitStatus } from "./show-appear-waiter";
import { ShowServiceChecker } from "./show-service-checker";
import { ShowTimeout } from "./show-timeout";

export type WaitResult = {
	phase: "before" | "go" | "after" | "timeout";
	reason: string;
	shouldReload: boolean;
};

export class Waiter extends ObservableBase<Waiter> {

	public waitStatus: WaitStatus | undefined = undefined; // observable

	private readonly goTimeWaiter: GoTimeWaiter;
	private readonly showAppearWaiter: ShowAppearWaiter;
	private readonly logger: TimeStampConsoleLogger;

	public constructor(
		showService: ShowService,
		logger: TimeStampConsoleLogger,
		waitForShowsTimeout: number,
	) {
		super();
		this.logger = logger;
		this.goTimeWaiter = new GoTimeWaiter(logger, waitForShowsTimeout);
		this.showAppearWaiter = new ShowAppearWaiter([
			new ShowTimeout(3*SECONDS),
			new ShowServiceChecker((status) => { this.waitStatus = status; },logger,showService),
		]);
	}

	public async waitAsync(targetTime: Date): Promise<WaitResult> {
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

				this.logger.log({ action: "ShowAppearWaiter.waitForShowsToAppearAsync()"});

				const showAppearResult = await this.showAppearWaiter.waitForShowsToAppearAsync();

				this.logger.log({ 
					action: "ShowAppearWaiter.waitForShowsToAppearAsync()-done",
					...showAppearResult,
				});

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