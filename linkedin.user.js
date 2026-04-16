// ==UserScript==
// @name         LinkedIn Jobs
// @namespace    http://tampermonkey.net/
// @version      0
// @description  Track jobs applied
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/storage.js
// @require      file://C:/[monkeyBarsFolder]/epoch_time.js
// @require      file://C:/[monkeyBarsFolder]/utils.js
// @require      file://C:/[monkeyBarsFolder]/snoop.js
// @require      file://C:/[monkeyBarsFolder]/observable.js
// @require      file://C:/[monkeyBarsFolder]/linkedin.user.js
// @match        https://www.linkedin.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=linkedin.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// Requires (a) Developer Mode = Enabled & (b) Allow Local URLs

(function() {
	'use strict';

	const BOB = unsafeWindow.BOB = [];

	// =====================
	// Set up SNOOPER
	// =====================
	function fetchInterceptor(url,options){
		if(typeof(url)=='string'){
			if(url.startsWith('chrome-extension'))
				return new Promise(()=>{}); // never resolves
		}
		BOB.push({url});
		return undefined;
	}
	const snooper = new RequestSnooper({fetchInterceptor});







	Object.assign(unsafeWindow,{snooper});
	console.print('%clinkedin.user.js loaded','background-color:#DFD'); // Last line of file
})();
