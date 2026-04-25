import type { RequestSnooper, SnoopedWindow, SnoopRequest } from "~/utils/snoop";
import { TimeStampConsoleLogger } from "./logging";
import { SECONDS } from "./time-format";

type ShowCountResult = {
	showCount: number;
	reason: "div" | "timeout" | "snooper";
};

type ShowDiv = {
	div: Element;
	label: string;
};


// Monitors the page and backend requests to determine when SNL standby shows become available.
// It detects shows either by watching DOM elements or intercepting network responses via the snooper.
// Provides polling via fetch as a fallback to catch transitions from “no shows” to “shows available.”
// Designed to support both real execution and testing by allowing overrides of snooping and DOM detection logic.
export class ShowService {
	private fetchAttempt = 0;

	public constructor(
		private readonly orgId: string,
		private readonly snooper: RequestSnooper,
		private readonly logger: TimeStampConsoleLogger,
		private readonly win: SnoopedWindow,
	) {}

	// Called at start-up. Watches the page and the Snooper to determine how many shows there are.
	public waitForShowCountAsync(timeout = 2 * SECONDS): Promise<ShowCountResult> {
		// wait for either:
		return new Promise<ShowCountResult>((resolve) => {
			const stop = (reason: ShowCountResult["reason"], showCount: number): void => {
				clearInterval(timerId);
				clearTimeout(timeoutId);
				resolve({ showCount, reason });
			};

			// 1) the DIVs to appear
			const timerId = setInterval(() => {
				const count = this.findCurrentDivs().length;
				if (count) {
					stop("div", count);
				}
			}, 100);

			// 2) or the timeout
			const timeoutId = setTimeout(() => stop("timeout", 0), timeout);

			// 3) the shows to appear on the snooper (do this LAST to ensure timers/intervals are started before we try to clear them.)
			this.snooper.addHandler((request: SnoopRequest) => {
				const {
					url: { pathname },
					responseText,
				} = request;

				if (this.isSnoopPath(pathname)) {
					const shows = JSON.parse(responseText) as unknown[];
					stop("snooper", shows.length);
					(request as SnoopRequest & { handled: string }).handled = "events";
				}
			});
		});
	}

	// called periodically to detect noshow-to-hasshows transition
	public async fetchShowsAsync(): Promise<unknown[]> {
		const attempt = ++this.fetchAttempt;
		this.logger.log(`querying shows (attempt ${attempt})`);

		// https://bookings-us.qudini.com/booking-widget/event/events/2HYM77D8NYO/event/choose
		const myUrl = `https://bookings-us.qudini.com/booking-widget/event/events/${this.orgId}`;
		const response = await this.win.fetch(myUrl);

		if (!response.ok) {
			throw new Error("bad response");
		}

		const shows = (await response.json()) as unknown[];
		this.logger.log(`found: ${shows.length} shows. (attempt ${attempt})`);
		return shows;
	}

	// override to disable snoop - for testing
	public isSnoopPath(pathname: string): boolean {
		return pathname.includes("/booking-widget/event/events/");
	}

	// override to disable div - for testing
	public findCurrentDivs(): ShowDiv[] {
		return [...document.querySelectorAll("div[aria-label]")]
			.map((div) => ({
				div,
				label: div.getAttribute("aria-label"),
			}))
			.filter((item): item is ShowDiv => item.label !== null);
	}
}