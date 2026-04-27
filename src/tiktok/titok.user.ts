// ==UserScript==
// @name         Tiktok
// @namespace    http://tampermonkey.net/
// @version      1
// @description  misc
// @author       Dean Rettig
// @match        http*://www.tiktok.com/@*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tiktok.com
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_log
// @grant        unsafeWindow
// ==/UserScript==

import { $, $qAll } from "~/lib/dom3";

type TikTokWindow = Window & {
	go?: () => void;
};

declare const unsafeWindow: TikTokWindow;

function go(): void {
	const used: Record<string, true> = {};

	$qAll<HTMLImageElement>("img")
		.filter((img) => img.width > 300)
		.forEach((img) => {
			if (used[img.src])
				return;

			$(img)
				.css({ height: "300px", display: "inline-block", margin: "10px" })
				.do((el) => {
					el.className = "";
					document.body.prepend(el);
				});

			used[img.src] = true;
		});

	console.log(`Relocated ${Object.keys(used).length} images.`);
}

unsafeWindow.go = go;

queueMicrotask( console.debug.bind( console, "%cTikTok - loaded", "background-color:#DFD;" ) );