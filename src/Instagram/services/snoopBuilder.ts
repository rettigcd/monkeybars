import { con } from "~/lib/console";
import { RequestSnooper, type RequestSnooperConfig, type SnoopedWindow } from "~/lib/snoop";
import { detectPath } from "../prune-hay";

type SnooperLogEntry = {
	responseText: string;
};

type InstagramSnooper = RequestSnooper & {
	_loadLog: SnooperLogEntry[];
	checkLogForMissingImage: (imgUrl: string) => void;
};

// Creates and configures a RequestSnooper that intercepts network requests.
// Used to monitor Instagram traffic and help debug or locate missing image data.
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

	snooper.checkLogForMissingImage = (imgUrl: string): void => {
		const matches = imgUrl.match(/.*?jpg/);
		if (!matches) {
			console.debug("missing image:", imgUrl);
			return;
		}

		const noQueryUrl = matches[0];
		const candidateResponses = snooper._loadLog.filter((x) =>
			x.responseText.includes(noQueryUrl),
		);

		const details: {
			imgUrl: string;
			simpleUrl: string;
			logMatches: SnooperLogEntry[];
			cssPath?: string[];
		} = {
			imgUrl,
			simpleUrl: noQueryUrl,
			logMatches: candidateResponses,
		};

		if (candidateResponses.length !== 0) {
			details.cssPath = detectPath(
				candidateResponses[0].responseText,
				noQueryUrl,
			);
		}

		const css = candidateResponses.length !== 0 ? "color:purple" : "";
		console.debug(
			`Missing info - found %c${details.logMatches.length} matches`,
			css,
			details,
		);
	};

	return snooper;
}
