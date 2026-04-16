// ==UserScript==
// @name         Example Banner Script
// @namespace    https://example.com/
// @version      0.1.0
// @description  Adds a small dismissible banner to matching pages
// @match        https://example.com/*
// @grant        none
// ==/UserScript==

import { create, qs } from "../utils/dom";
import { log } from "../utils/log";
import { injectStyle } from "../utils/styles";

function main(): void {
	if (qs("[data-ts-userscript-banner]")) {
		return;
	}

	injectStyle(`
		.ts-userscript-banner {
			position: fixed;
			top: 12px;
			right: 12px;
			z-index: 999999;
			padding: 10px 14px;
			border-radius: 8px;
			background: #111;
			color: #fff;
			font: 14px/1.4 sans-serif;
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
		}

		.ts-userscript-banner button {
			margin-left: 10px;
			cursor: pointer;
		}
	`);

	const banner = create("div", {
		className: "ts-userscript-banner",
		attributes: {
			"data-ts-userscript-banner": "true"
		}
	});

	const text = create("span", { text: "Example Banner Script is running." });
	const closeButton = create("button", { text: "Dismiss" });
	closeButton.type = "button";
	closeButton.addEventListener("click", () => banner.remove());

	banner.append(text, closeButton);
	document.body.appendChild(banner);

	log("example-banner", "Banner injected");
}

main();
