// ==UserScript==
// @name         Job Requirements
// @namespace    http://tampermonkey.net/
// @version      3
// @description  Highlight job requirements
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/job.user.js
// @match        https://remote.co/job-details/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// Requires (a) Developer Mode = Enabled & (b) Allow Local URLs

unsafeWindow.addEventListener('load', function() {
	// Wait for the page to load
	setTimeout(function() {
		// Highlight job requirements
		highlightJobRequirements();
	}, 1000);
});

function highlightJobRequirements() {

	//	const html = document.documentElement.innerHTML;
	//	console.log(html.length);

	const ps = [...document.querySelectorAll('p')];
	ps.forEach((a)=>{

		const regex = /NET|React|Azure|AWS/g;
		a.innerHTML = a.innerHTML.replaceAll(regex, "<span style='color: red;'>$&</span>")

	});

}
