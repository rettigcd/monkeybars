// ==UserScript==
// @name         Instagram 4
// @namespace    http://tampermonkey.net/
// @version      4
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/Instagram4.user.js
// @match        https://www.instagram.com/*
// @exclude      https://www.instagram.com/p/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_download
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

// Requires:
// (a) Developer mode
// (b) Allow User Scripts
// (c) Allow access to file URLs

import { con, silenceConsole } from "~/utils/console";
import { GM } from "~/utils/gm";
import { formatDateForFilename } from "./date-formats";
import { dom } from "./dom";
import { HotkeyManager } from "./key-presses";
import { LocationPage } from "./location-page";
import { ScreenImageActions } from "./screen-image-actions";
import { UserPage } from "./user-page";
import { type InstagramWindow } from "./window";

declare const unsafeWindow: InstagramWindow;

silenceConsole(unsafeWindow);

function openFocusUserProfilePage() {
	const focusUser = dom.focusUser;
	if (focusUser)
		GM.openInTab(`https://instagram.com/${focusUser}`);
	else
		console.log("No focusUser found.");
}

function saveUsersToFile() {
	const filename = `instagram.localStorage.users ${formatDateForFilename(new Date())}.json`;
	downloadTextToFile(localStorage.users, filename);
	console.log("localStorage.users save to " + filename);
}

// Triggers a browser download of plain text content as a file.
// Used for exporting data like localStorage or logs.
function downloadTextToFile(text:string, filename:string) {
	const a = document.createElement("a");
	a.href = URL.createObjectURL(new Blob([text]));
	a.download = filename;
	a.click();
}

export function initInstagram4(): void {

	// unsafeWindow.console = {
	// 	__proto__: unsafeWindow.console,
	// 	log: function () { this.logArgs.push(arguments); },
	// 	logArgs: [],
	// };

	const hotkeys = new HotkeyManager();
	const screenImageActions = new ScreenImageActions(unsafeWindow);
	hotkeys.register(" ", () => screenImageActions.downloadImageInCenter());
	hotkeys.register("d", () => screenImageActions.downloadImageUnderMouse());
	hotkeys.register("t", () => screenImageActions.showTaggedUsersUnderMouse());
	hotkeys.register("p", openFocusUserProfilePage);
	hotkeys.register("Ctrl+Shift+U", saveUsersToFile);
	hotkeys.register("ArrowDown", () => dom.nextButton?.click() );
	hotkeys.register("ArrowUp", () => dom.previousButton?.click());
	hotkeys.start();

	if (window.location.pathname.startsWith("/explore/locations"))
		new LocationPage({win:unsafeWindow,hotkeys});
	else if (window.location.pathname != "/")
		new UserPage({ win:unsafeWindow, hotkeys });

	con.print("%cInstagram4.js loaded", "background-color:#DFD");
}

initInstagram4();