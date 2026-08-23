import { $q, $qAll } from "~/lib/dom3";

// Recursively searches a parsed JSON value for the first object property
// matching `key`, returned as a string. Used to pull ids out of the page's
// embedded preload scripts, which aren't part of any documented schema.
function findKeyValue(obj: unknown, key: string, seen = new Set<unknown>()): string | undefined {
	if (obj == null || typeof obj !== "object" || seen.has(obj))
		return undefined;
	seen.add(obj);

	for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
		if (k === key && (typeof v === "string" || typeof v === "number"))
			return String(v);
		if (v && typeof v === "object") {
			const found = findKeyValue(v, key, seen);
			if (found !== undefined)
				return found;
		}
	}
	return undefined;
}

// Provides helpers to access existing Instagram elements.
export const instaDom = {

	// The owner of the BIG Details photo we are looking at.
	get focusUser():string|undefined { return $q("div.x10wlt62.xlyipyv span")?.innerHTML; },
	
	// Span containing users total image count.
	get imageCountSpan(): HTMLElement | null { return $q("div.x40hh3e span.html-span"); },

	get presentationCenter(): HTMLElement | null { return $q("div._aatk"); },
	
	// current thumb rows - for decorating
	get thumbRows(): HTMLElement[] { return $qAll("div._ac7v"); },

	get previousButton() : HTMLElement | null {
		const css = 'div.html-div>div>button[aria-label="Go back"]';
		const el = $q(css);
		if(el === null) console.debug(`${css} not found.`);
		return el;
	},

	get nextButton() : HTMLElement | null {
		const css = 'div.html-div>div>button[aria-label="Next"]';
		const el = $q(css);
		if(el === null) console.debug(`${css} not found.`);
		return el;
	},

	get scripts() : HTMLScriptElement[] { return $qAll<HTMLScriptElement>("script"); },

	get body(): HTMLElement { return document.body; },

	// The numeric pk/id of the profile whose page we're on, pulled from a JSON
	// preload embedded in a <script> tag (route.rootView.props.page_logging.params.profile_id).
	// API responses (e.g. the Tagged tab) don't always include this, so it has to come from the DOM.
	get pageOwnerId(): string | undefined {
		for (const script of instaDom.scripts) {
			let json: unknown;
			try {
				json = JSON.parse(script.textContent || "");
			}
			catch {
				continue;
			}
			const id = findKeyValue(json, "profile_id");
			if (id && id !== "0")
				return id;
		}
		return undefined;
	},

};

// For USERS, the page owner
// when visiting locations, 'explore'
export const pageOwnerName: string = location.pathname.split("/")[1];
