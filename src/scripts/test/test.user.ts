// ==UserScript==
// @name         Testing
// @namespace    http://tampermonkey.net/
// @version      4
// @description  Just for testing how Typescript builds
// @author       Dean Rettig
// @run-at       document-start
// @grant        GM_download
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

import { con as bbb } from "~/utils/console";

bbb.print("BOB");