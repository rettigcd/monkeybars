// ==UserScript==
// @name         Outlook Folder Icons
// @namespace    http://tampermonkey.net/
// @version      2024-10-17
// @description  try to take over the world!
// @author       You
// @require      file://C:/[folder]/outlook.user.js
// @match        https://outlook.office.com/mail/*
// @icon         https://www.google.com/s2/favicons?sz=32&domain=outlook.com
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	function styleFolder(folderName,style){
		const folder = document.querySelector(`div[data-folder-name="${folderName}"]`);
		if(folder == null || folder.hasIcon) return;
		folder.hasIcon = true;
			Object.assign(folder.style,style.folder||{});
		const span = folder.querySelector('span.FyKl6.cxHVn.zC7De');
		if(span != null)
			Object.assign(span.style,style.span||{});
	}

	function bg(color,url){ return `${color} url(${url}) left center no-repeat`}
	function googleBg(color,domain){ return bg(color,`https://www.google.com/s2/favicons?sz=24&domain=${domain}`)}

	function addIcons(){
		styleFolder('compliancemate',{
			folder:{background:bg('#8f8','https://cdn2.hubspot.net/hub/7014597/hubfs/compliancemate%20teardrop%20logo.jpg?width=28&height=28')},
			span:{"font-weight":"bold"}
		});
		styleFolder('infernored',{
			folder:{background:googleBg('#c88','infernored.com'),color:'white'},
			span:{color:'white',"font-weight":"bold"}
		});
		styleFolder('harvest',{
			folder:{background:googleBg('#fa0','harvestapp.com')},
			span:{"font-weight":"bold"},
		});
		styleFolder('luck',{
			folder:{background:googleBg('', 'luckcompanies.com'),border:"thin solid #4f4"},
			span:{background:'#8f8',"font-weight":"bold"}
		});
		styleFolder('snl',{
			folder:{background:googleBg('', 'nbc.com'),border:"thin solid blue"},
			span:{background:'#8f8',"font-weight":"bold"}
		});
		styleFolder('apple',{
			folder:{background:googleBg('', 'apple.com'),border:"thin solid #8080ff"},
			span:{background:'#8f8',"font-weight":"bold"}
		});
	}
	setInterval(addIcons,30000);
	setTimeout(addIcons,500);

})();