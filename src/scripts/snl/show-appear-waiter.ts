import { SECONDS } from "./time-format";

export type WaitStatus = {
	attempt: number;
	count: number | "?";
};

type ShowService = {
	fetchShowsAsync: () => Promise<unknown[]>;
};

type Logger = {
	log: (msg: unknown) => void;
};

type StatusChangedHandler = (status: WaitStatus) => void;
type ReloadHandler = (reason: string) => void;

export class ShowAppearWaiter {
	private readonly showService: ShowService;
	private readonly logger: Logger;
	private readonly onStatusChanged: StatusChangedHandler;
	private readonly onReload: ReloadHandler;

	public constructor(
		showService: ShowService,
		logger: Logger,
		onStatusChanged: StatusChangedHandler,
		onReload: ReloadHandler,
	) {
		this.showService = showService;
		this.logger = logger;
		this.onStatusChanged = onStatusChanged;
		this.onReload = onReload;
	}

	public reloadWhenShowsAppear(timeout = 3 * SECONDS): void {
		this.logger.log({ action: "ShowAppearWaiter.reloadWhenShowsAppear()", timeout });

		const watchingForShowsStart = Date.now();
		let attempt = 0;

		const intervalId = setInterval(async () => {
			try {
				++attempt;

				this.onStatusChanged({ attempt, count: "?" });

				const shows = await this.showService.fetchShowsAsync();

				this.onStatusChanged({ attempt, count: shows.length });

				if (shows.length) {
					done("showService found shows");
				}
			} catch (err) {
				this.logger.log(err);
			}
		}, 500);

		const timeoutId = setTimeout(() => {
			done("timed out waiting for show to appear");
		}, timeout);

		const done = (reason: string): void => {
			clearTimeout(timeoutId);
			clearInterval(intervalId);

			this.logger.log({
				action: "ShowAppearWaiter.reloadWhenShowsAppear()-done",
				reason,
				duration: Date.now() - watchingForShowsStart,
			});

			this.onReload(reason);
		};
	}
}
