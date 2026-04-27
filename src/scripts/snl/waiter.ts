import { type ListenFn, makeObservable } from "~/utils/observable";
import { GoTimeWaiter } from "./go-time-waiter";
import { ShowAppearWaiter, type WaitStatus } from "./show-appear-waiter";
import { SECONDS } from "./time-format";

type ShowService = {
	fetchShowsAsync: () => Promise<unknown[]>;
};

type Logger = {
	log: (msg: unknown) => void;
};

export class Waiter {
	public listen!: ListenFn<Waiter>;

	public waitStatus: WaitStatus | undefined = undefined;

	private readonly logger: Logger;
	private readonly goTimeWaiter: GoTimeWaiter;
	private readonly showAppearWaiter: ShowAppearWaiter;

	public constructor(
		showService: ShowService,
		logger: Logger,
		postInterval: number,
	) {
		this.logger = logger;

		this.goTimeWaiter = new GoTimeWaiter(logger, postInterval);

		this.showAppearWaiter = new ShowAppearWaiter(
			showService,
			logger,
			(status) => { this.waitStatus = status; },
			(reason) => { this.reload(reason); },
		);

		makeObservable(this);
	}

	public get delay(): number | undefined {
		return this.goTimeWaiter.delay;
	}

	public get phase(): string | undefined {
		return this.goTimeWaiter.phase;
	}

	public scheduleNext(targetTime: Date, showAppearTimeout = 3 * SECONDS): this {
		this.goTimeWaiter.scheduleNext(targetTime, {
			onBeforeOrTimeout: (phase) => { this.reload(phase); },
			onGoOrAfter: () => { this.showAppearWaiter.reloadWhenShowsAppear(showAppearTimeout); },
		});

		return this;
	}

	public reload(reason = ""): void {
		this.logger.log({ action: "reload()", reason });
		location.reload();
	}

	// for testing
	public stubReload(): this {
		this.reload = function () {
			console.log(
				"%cRELOAD",
				"background:red;color:white;border:2px solid black;",
			);
		};

		return this;
	}
}