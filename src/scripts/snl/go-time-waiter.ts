import { MINUTES, SECONDS } from "./time-format";

type DelayPhase = "before" | "go" | "after" | "timeout";

type DelayResult = {
	delay: number;
	phase: DelayPhase;
};

type Logger = {
	log: (msg: unknown) => void;
};

type GoTimeWaiterOptions = {
	onBeforeOrTimeout: (phase: "before" | "timeout") => void;
	onGoOrAfter: (phase: "go" | "after") => void;
};

export class GoTimeWaiter {
	public delay?: number;
	public phase?: DelayPhase;

	private readonly logger: Logger;
	private readonly preRefreshOffsets: number[];
	private readonly postInterval: number;
	private readonly postRetryPeriod: number;

	private target?: Date;

	public constructor(logger: Logger, postInterval: number) {
		this.logger = logger;
		this.preRefreshOffsets = [60 * MINUTES, 15 * MINUTES, 2 * MINUTES, 20 * SECONDS, 0];
		this.postInterval = postInterval;
		this.postRetryPeriod = 2 * MINUTES;
	}

	public scheduleNext(
		targetTime: Date,
		handlers: GoTimeWaiterOptions,
	): this {
		this.target = targetTime;

		const { delay, phase } = this.getDelay();
		this.delay = delay;
		this.phase = phase;

		this.logger.log({
			action: "GoTimeWaiter.scheduleNext()",
			goTime: this.target.toLocaleString(),
			delay,
			phase,
			refreshTime: new Date(Date.now() + delay).toLocaleTimeString(),
		});

		setTimeout(() => {
			switch (phase) {
				case "timeout":
				case "before":
					handlers.onBeforeOrTimeout(phase);
					break;

				case "go":
				case "after":
					handlers.onGoOrAfter(phase);
					break;
			}
		}, delay);

		return this;
	}

	public getDelay(): DelayResult {
		const offset = this.getOffsetFromTarget();

		if (offset !== undefined && offset < 0) {
			const nextRefresh = this.preRefreshOffsets.find((s) => offset + s < 0) ?? 0;

			return {
				delay: -offset - nextRefresh,
				phase: nextRefresh === 0 ? "go" : "before",
			};
		}

		if (offset !== undefined && offset < this.postRetryPeriod) {
			return { delay: this.postInterval, phase: "after" };
		}

		return { delay: 0, phase: "timeout" };
	}

	// + is after target, - is before target
	public getOffsetFromTarget(): number | undefined {
		return this.target ? Date.now() - this.target.valueOf() : undefined;
	}
}
