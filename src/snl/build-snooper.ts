import { RequestSnooper, type FetchInterceptor, type SnoopedWindow } from "~/lib/snoop";

export function buildSnooper(win:SnoopedWindow): RequestSnooper {
	
	const fetchInterceptor: FetchInterceptor = (url, _options) => {
		const urlText = String(url);

		// prevent ingest-sentry from going apeshit when something throws an exception
		if (urlText.includes("ingest.sentry.io"))
			return new Promise<Response>(() => {});

		return undefined;
	};

	return new RequestSnooper(win, { fetchInterceptor }).logRequests();
}