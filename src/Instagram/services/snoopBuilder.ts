import { con } from "~/lib/console";
import { RequestSnooper, type RequestSnooperConfig, type SnoopedWindow } from "~/lib/snoop";

type SnooperLogEntry = {
	responseText: string;
};

type InstagramSnooper = RequestSnooper & {
	_loadLog: SnooperLogEntry[];
};

// Creates and configures a RequestSnooper that intercepts network requests.
// Used to monitor Instagram traffic.
export function buildRequestSnooper(win: SnoopedWindow): InstagramSnooper {
	let showLogMessage = true;

	function fetchInterceptor(
		url: string | URL,
		options?: RequestInit,
	): Promise<never> | undefined {
		void options;

		if (typeof url === "string" && url.includes("edge-chat.instagram.com")) {
			if (showLogMessage) {
				con.print("intercepted:", url);
				con.print("additional interceptions will not be shown.");
				showLogMessage = false;
			}

			return new Promise<never>(() => {});
		}

		return undefined;
	}

	const config: RequestSnooperConfig = { fetchInterceptor };
	const snooper = new RequestSnooper( win, config )
		.logRequests(({ url }: { url: URL }) =>
			[
				"https://www.instagram.com/logging/falco",
				"https://graph.instagram.com/logging_client_events",
			].includes(url.toString()) === false,
		) as InstagramSnooper;

	return snooper;
}
