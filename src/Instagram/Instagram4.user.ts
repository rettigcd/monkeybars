// ==UserScript==
// @name         Instagram
// @namespace    http://tampermonkey.net/
// @version      4
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/dist/Instagram4.user.js
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

import { con, silenceConsole } from "~/lib/console";
import { openInTab } from "~/lib/gm";
import { HotkeyManager } from "~/lib/hotkey-manager";
import { formatDateForFilename } from "./date-formats";
import { LocationPage } from "./pages/location-page";
import { UserPage } from "./pages/user-page";
import { ScreenImageActions } from "./screen-image-actions";
import { instaDom } from "./services/instaDom";
import { win } from "./types/window";

silenceConsole(win);

function openFocusUserProfilePage() {
	const focusUser = instaDom.focusUser;
	if (focusUser)
		openInTab(`https://instagram.com/${focusUser}`);
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

	const hotkeys = new HotkeyManager();
	const screenImageActions = new ScreenImageActions(win);
	hotkeys.register(" ", () => screenImageActions.downloadImageInCenter());
	hotkeys.register("d", () => screenImageActions.downloadImageUnderMouse());
	hotkeys.register("t", () => screenImageActions.showTaggedUsersUnderMouse());
	hotkeys.register("p", openFocusUserProfilePage);
	hotkeys.register("Ctrl+Shift+U", saveUsersToFile);
	hotkeys.register("ArrowDown", () => instaDom.nextButton?.click() );
	hotkeys.register("ArrowUp", () => instaDom.previousButton?.click());
	hotkeys.start();

	if (window.location.pathname.startsWith("/explore/locations"))
		new LocationPage({win,hotkeys});
	else if (window.location.pathname != "/")
		new UserPage({ win, hotkeys });

	con.print("%cInstagram4.js loaded", "background-color:#DFD");
}

initInstagram4();