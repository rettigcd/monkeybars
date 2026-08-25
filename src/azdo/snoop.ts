import { RequestSnooper, type SnoopedWindow } from "~/lib/snoop";

export function snoopAzureDevOpsRequests(win: SnoopedWindow): RequestSnooper {
	const snooper = new RequestSnooper(win).logRequests(({ url }) =>
		url.hostname.endsWith("visualstudio.com") || url.hostname === "dev.azure.com",
	);

	snooper.addHandler((request) => {
		if (request.url.pathname.includes("/_apis/"))
			console.debug("Azure DevOps API response", request);
	});

	return snooper;
}
