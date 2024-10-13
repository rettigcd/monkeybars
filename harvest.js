// ==UserScript==
// @name         Harvest Locations
// @namespace    http://tampermonkey.net/
// @version      2024-10-09
// @description  Highlight Users location and adds icons to clients.
// @author       Dean Rettig
// @require      file://C:/[folder]/harvest.js
// @match        https://infernored.harvestapp.com/time/day/*/*/*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=harvestapp.com
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

	const css = {
		success : {background:'green',color:'white'},
		danger : {background:'red'}
	};

	const location = (function(){
		if(!localStorage.location)
			localStorage.location = prompt('Please enter a location to highlight. For example: \'Cincinnati\'');
		return localStorage.location;
	})();

	function findEl(cssSelector){ return [...document.querySelectorAll(cssSelector)].map(el=>({el,isMatch:el.innerText.includes(location)})); }
	function applyCss({el,isMatch}){ Object.assign(el.style,isMatch ? css.success : css.danger); }

	function entries(){
		// .entry-project => 'On Deck' 'On Deck - Professional Development' 'Application Development' 'Prof Dev - [employee name]'
		[...document.querySelectorAll('.entry-client')].forEach(el=>{
			if(el.hasImage) return;
			const clean = el.innerText.replace("\n", ""), title=clean.substring(1,clean.length-2);
			const icon = {
				'IRT Billable (HOURS AND EXPENSES)': 'https://cdn-icons-png.flaticon.com/128/2256/2256995.png',
				'IRT Professional Development Benefits - 2024':'https://cdn-icons-png.flaticon.com/128/999/999735.png',
				'IRT PTO - 2024': "", 
				'Enhanced Voting': 'https://www.google.com/s2/favicons?sz=64&domain=enhancedvoting.com',
				'Vault Consulting LLC': 'https://vaultconsulting.com/wp-content/uploads/2019/10/favicon-32x32.png',
			}[title];
			if(icon){
				const proj = el.parentNode.querySelector('.entry-project');
				var img = document.createElement('IMG');
				img.src=icon;
				img.style.height="32px";
				img.style.padding="0px 8px";
				proj.insertBefore(img, proj.firstChild); 
				el.hasImage = true;
			}
			el.hasImage = true;
		})
	}

	setInterval(function(){
		// On main page when you look at it.
		findEl('.entry-task').forEach(applyCss);
		// On form when adding/updating
		findEl('.pds-chosen-group-option').filter(({isMatch})=>isMatch).forEach(applyCss); // Options
		findEl('button.pds-chosen-button div.pds-chosen-selection').filter(({el})=>el.innerText.startsWith('Billable') ).forEach(applyCss); // Selected

		entries();
	},500);

	queueMicrotask (console.log.bind (console, `%charvest.js loaded - highlighting '${location}'`,'background-color:#DFD'));
})();