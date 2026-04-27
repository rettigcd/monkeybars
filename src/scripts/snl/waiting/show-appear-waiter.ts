import { SECONDS } from "../time-format";

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

export type ShowAppearWaitResult = {
	reason: string;
	attempt: number;
	count: number | "?";
	duration: number;
};

export class ShowAppearWaiter {
	private readonly showService: ShowService;
	private readonly logger: Logger;
	private readonly onStatusChanged: StatusChangedHandler;

	public constructor(
		showService: ShowService,
		logger: Logger,
		onStatusChanged: StatusChangedHandler,
	) {
		this.showService = showService;
		this.logger = logger;
		this.onStatusChanged = onStatusChanged;
	}

	public waitForShowsToAppearAsync(timeout = 3 * SECONDS): Promise<ShowAppearWaitResult> {
		this.logger.log({ action: "ShowAppearWaiter.waitForShowsToAppearAsync()", timeout });

		const watchingForShowsStart = Date.now();
		let attempt = 0;
		let lastStatus: WaitStatus = { attempt, count: "?" };

		return new Promise((resolve) => {
			const intervalId = setInterval(async () => {
				try {
					++attempt;

					lastStatus = { attempt, count: "?" };
					this.onStatusChanged(lastStatus);

					const shows = await this.showService.fetchShowsAsync();

					lastStatus = { attempt, count: shows.length };
					this.onStatusChanged(lastStatus);

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

				const result: ShowAppearWaitResult = {
					reason,
					attempt: lastStatus.attempt,
					count: lastStatus.count,
					duration: Date.now() - watchingForShowsStart,
				};

				this.logger.log({
					action: "ShowAppearWaiter.waitForShowsToAppearAsync()-done",
					...result,
				});

				resolve(result);
			};

		});
		
	}
}
// https://httpbin.org/delay/5
// https://slowwly.robertomurray.co.uk/delay/3000/url/http://example.com
