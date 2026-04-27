import { MINUTES, SECONDS } from "../time-format";

type DelayPhase = "before" | "go" | "after" | "timeout";

type DelayResult = {
	delay: number;
	phase: DelayPhase;
};

type Logger = {
	log: (msg: unknown) => void;
};

export type GoTimeWaitResult = {
	delay: number;
	phase: DelayPhase;
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

	public waitUntilNextAsync(targetTime: Date): Promise<GoTimeWaitResult> {
		this.target = targetTime;

		const { delay, phase } = this.getDelay();
		this.delay = delay;
		this.phase = phase;

		this.logger.log({
			action: "GoTimeWaiter.waitUntilNextAsync()",
			goTime: this.target.toLocaleString(),
			delay,
			phase,
			refreshTime: new Date(Date.now() + delay).toLocaleTimeString(),
		});

		return new Promise((resolve) => {
			setTimeout(() => {
				resolve({ delay, phase });
			}, delay);
		});
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

		if (offset !== undefined && offset < this.postRetryPeriod)
			return { delay: this.postInterval, phase: "after" };

		return { delay: 0, phase: "timeout" };
	}

	// + is after target, - is before target
	public getOffsetFromTarget(): number | undefined {
		return this.target ? Date.now() - this.target.valueOf() : undefined;
	}


}
