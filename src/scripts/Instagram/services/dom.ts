import { $q, $qAll } from "~/utils/dom3";

// Provides helpers to access existing Instagram elements.
export const dom = {

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

	// For USERS, the page owner
	get pageOwner(): string { return document.location.pathname.split("/")[1]; },

};
