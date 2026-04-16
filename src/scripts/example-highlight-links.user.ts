// ==UserScript==
// @name         Example Highlight External Links
// @namespace    https://example.com/
// @version      0.1.0
// @description  Highlights external links on matching pages
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

import { qsa } from "../utils/dom";
import { log } from "../utils/log";
import { injectStyle } from "../utils/styles";

function isExternalLink(anchor: HTMLAnchorElement): boolean {
	try {
		return new URL(anchor.href, location.href).origin !== location.origin;
	} catch {
		return false;
	}
}

function main(): void {
	injectStyle(`
		.ts-userscript-external-link {
			outline: 2px solid orange;
			outline-offset: 2px;
			border-radius: 2px;
		}
	`);

	const anchors = qsa<HTMLAnchorElement>("a[href]");
	let count = 0;

	for (const anchor of anchors) {
		if (!isExternalLink(anchor)) {
			continue;
		}

		anchor.classList.add("ts-userscript-external-link");
		count += 1;
	}

	log("example-highlight-links", `Highlighted ${count} external links.`);
}

main();
