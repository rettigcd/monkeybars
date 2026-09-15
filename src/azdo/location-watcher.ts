// Azure DevOps is a single-page app: 
// navigating between work items, repos, boards, etc. calls history.pushState/replaceState instead of loading a new document. 
// The browser has no native "urlchange" event and popstate only fires on back/forward navigation, so we patch history ourselves.

type PatchableMethod = "pushState" | "replaceState";

function patchHistoryMethod(method: PatchableMethod, onChange: () => void): () => void {
	const original = history[method];

	history[method] = function (this: History, ...args: Parameters<History[PatchableMethod]>) {
		const result = original.apply(this, args);
		onChange();
		return result;
	} as History[PatchableMethod];

	return () => {
		history[method] = original;
	};
}

export function watchLocationChange(onUrlChange: (url: string) => void): () => void {
	let lastHref = location.href;

	const fireIfChanged = () => {
		if (location.href === lastHref) return;
		lastHref = location.href;
		onUrlChange(lastHref);
	};

	const unpatchPushState = patchHistoryMethod("pushState", fireIfChanged);
	const unpatchReplaceState = patchHistoryMethod("replaceState", fireIfChanged);
	window.addEventListener("popstate", fireIfChanged);

	return () => {
		unpatchPushState();
		unpatchReplaceState();
		window.removeEventListener("popstate", fireIfChanged);
	};
}
