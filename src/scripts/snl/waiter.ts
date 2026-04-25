import { type ListenFn, makeObservable } from "~/utils/observable";
import { MINUTES, SECONDS } from "./time-format";

type DelayPhase = "before" | "go" | "after" | "timeout";

type DelayResult = {
	delay: number;
	phase: DelayPhase;
};

export type WaitStatus = {
	attempt: number;
	count: number | "?";
};

export class Waiter {
	public listen!: ListenFn<Waiter>;

	public delay?: number;
	public phase?: DelayPhase;

	private _showService: { fetchShowsAsync: () => Promise<unknown[]>; };
	private _logger: { log: (msg: unknown) => void; };

	private pre: number[];
	private postInterval: number;
	private postRetryPeriod: number;

	private target?: Date;

	// observable property (defined at runtime)
	public waitStatus: WaitStatus | undefined = undefined;

	public constructor(
		showService: { fetchShowsAsync: () => Promise<unknown[]> },
		logger: { log: (msg: unknown) => void },
		postInterval: number
	) {
		this._showService = showService;
		this._logger = logger;

		this.pre = [60 * MINUTES, 15 * MINUTES, 2 * MINUTES, 20 * SECONDS, 0];
		this.postInterval = postInterval;
		this.postRetryPeriod = 2 * MINUTES;

		if (this.pre[this.pre.length - 1] != 0) this.pre.push(0);

		// pre must be in descending order, and should end with 0
		makeObservable(this);
	}

	// == Phase 1 - waiting for target goTime ==
	// 1) runs a timer that updates the time until Go-Time
	// 2) schedules a Timeout to refresh
	public scheduleNext(targetTime: Date, showAppearTimeout = 3 * SECONDS): this {
		// starts time for next reload / or monitor for shows
		this.target = targetTime;

		const { delay, phase } = this.getDelay();
		this.delay = delay;
		this.phase = phase;

		this._logger.log({
			action: "scheduleNext()",
			goTime: this.target.toLocaleString(),
			delay,
			phase,
			refreshTime: new Date(Date.now() + delay).toLocaleTimeString(),
		});

		setTimeout(() => {
			switch (phase) {
				case "timeout":
				case "before":
					this.reload(phase);
					break;
				case "go":
				case "after":
					this.reloadWhenShowsAppear(showAppearTimeout);
					break;
			}
		}, delay);

		return this;
	}

	public reload(reason = ""): void {
		this._logger.log({ action: "reload()", reason });
		location.reload(); /// !!! THIS DOESN'T WORK!
	}

	// == Phase 2 - waiting for shows ==
	public reloadWhenShowsAppear(timeout = 3 * SECONDS): void {
		this._logger.log({ action: "reloadWhenShowsAppear()", timeout });

		const watchingForShowsStart = Date.now();
		const { _logger: logger, _showService: showService } = this;

		const reload = (x: unknown) => this.reload(String(x));
		let attempt = 0;

		const intervalId = setInterval(async () => {
			try {
				++attempt;

				this.waitStatus = { attempt, count: "?" };

				const shows = await showService.fetchShowsAsync();

				this.waitStatus = { attempt, count: shows.length };

				if (shows.length) done("showService found shows");
			} catch (err) {
				logger.log(err);
			}
		}, 500);

		const timeoutId = setTimeout(() => {
			done("timed out waiting for show to appear");
		}, timeout);

		function done(reason: string) {
			clearTimeout(timeoutId);
			clearInterval(intervalId);

			logger.log({
				action: "reloadWhenShowsAppear()-done",
				reason,
				duration: Date.now() - watchingForShowsStart,
			});

			reload(reason);
		}
	}

	public getDelay(): DelayResult {
		const offset = this.getOffsetFromTarget();

		if (offset !== undefined && offset < 0) {
			const nextRefresh = this.pre.find((s) => offset + s < 0) ?? 0;

			return {
				delay: -offset - nextRefresh,
				phase: nextRefresh === 0 ? "go" : "before",
			};
		}

		if (offset !== undefined && offset < this.postRetryPeriod)
			return { delay: this.postInterval, phase: "after" };

		// Exceeded try period
		return { delay: 0, phase: "timeout" };
	}

	// + is after, - is before
	public getOffsetFromTarget(): number | undefined {
		return this.target ? Date.now() - this.target.valueOf() : undefined;
	}

	// for testing
	public stubReload(): this {
		this.reload = function () {
			console.log(
				"%cRELOAD",
				"background:red;color:white;border:2px solid black;"
			);
		};
		return this;
	}
}