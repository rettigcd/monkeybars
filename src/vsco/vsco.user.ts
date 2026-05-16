// ==UserScript==
// @name         VSCO Gallery
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Efficient VSCO Gallery surfer
// @author       Dean Rettig
// @match        http*://vsco.co/*
// @match        http*://vsco.com/*
// @require      file://C:/[monkeyBarsFolder]/dom.js
// @require      file://C:/[monkeyBarsFolder]/epoch_time.js
// @require      file://C:/[monkeyBarsFolder]/observable.js
// @require      file://C:/[monkeyBarsFolder]/storage.js
// @require      file://C:/[monkeyBarsFolder]/vsco.user.js
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=vsco.co
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_log
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

import { addStyleSheet } from "~/lib/dom3";
import { saveTextToFile } from "~/lib/download";
import { HotkeyManager } from "~/lib/hotkey-manager";
import { by } from "~/lib/sorting";
import { throwExp } from "~/lib/throw";
import { formatDate } from "./format-date";
import { Gallery } from "./models/gallery-model";
import { ImageModel } from "./models/image-model";
import { NewImagesModel } from "./models/new-images-model";
import { win } from "./types/window";
import { UserAccess } from "./user-access";
import { UserCtx } from "./user-ctx";
import { initUserPageAsync } from "./user-page";
import { UserStore } from "./user-store";
import { scrollToTop } from "./views/calendar-view";
import { Layout } from "./views/layout";
import { pageOwnerName } from "./vscoDom";


(function() {
	'use strict';
	
	const pageLoadTimeMs = Date.now();	
	UserCtx.nowMs = pageLoadTimeMs;
	ImageModel.nowMs = pageLoadTimeMs

	function track(model:ImageModel){
		// !!! move this out of here and into some kind of listener 
		model.listen("downloadProgress", ({newValue:{status}}) => {
			if(status == "complete")
				userStore.get(model.owner).logDownloadImage(model);
		});
	}
	
	// Services / repositories / models
	const gallery = new Gallery();
	const userAccess = new UserAccess();
	const userStore = new UserStore(userAccess,track);
	const newImagesModel = new NewImagesModel(userStore);

	newImagesModel.listen("scannedNewImages", ({host,newValue:rows})=>{
		if(rows.length === 0) return;
		gallery.rows = rows;
		host.scannedNewImages = [];
	});

	// UI / Views - general
	const uiLayout = new Layout( gallery, newImagesModel );
	uiLayout.withActions(...userStore.nextLinks.map(x=>x.makeDiv()));

	const hotkeys = new HotkeyManager();
	hotkeys.register("o", () => gallery.openLast());
	hotkeys.register("x", () => gallery.closeFirst());
	hotkeys.register("Home", () => scrollToTop());
	hotkeys.register("Ctrl+Shift+U",()=>{
		const filename = `vsco.localStorage.users ${formatDate.forFilename(new Date())}.json`;
		saveTextToFile({text:localStorage.users,filename,type:"application/json"});
		console.log("localStorage.users saved to "+filename);
	});
	hotkeys.start();

	const reports = {
		status : function(status=throwExp('must supply status')){
			return userStore.allUsers
				.filter(u=>u.data.status==status)
				.sort(by(user=>user.username))
				.map( user=>[user.username,user.data.status].join('\t') )
				.join('\r\n');
		},
		failures : function(){
			return userStore.allUsers
				.filter(u=>u.data.status=="failed")
				.sort(by(user=>user.data.firstFailure))
				.map(user => user.data.toFailureString() )
				.join("\r\n")
		},
		toReview : function(){ console.log(userStore.allUsers.filter(u=>u.data.status=="queued").map(user=>user.username).join("\r\n")); },
		findLinksTo: function(needle:string){ console.log(userStore.findFriendLinksTo(needle).join("\r\n")); }
	}

	win.cmd = {
		userStore,
		reports 
	};

	// Removes Google Ad
	setInterval(function(){ document.querySelectorAll("ins[data-google-query-id]").forEach(x=>x.remove());},5000);
	addStyleSheet(`div[data-google-query-id]{ 
		visibility:hidden !important;
		height:0 !important; min-height:0 !important; overflow:hidden !important;
		position: fixed; left: -10000px; top: -10000px;
		pointer-events:none !important;
	}`)
	// make Google Ad less obvious
//	addStyleSheet(`div[data-google-query-id]{ filter: grayscale(1) blur(2px); opacity: 0.15; }`)

	// -----  Init User  -----
	if(pageOwnerName)
		initUserPageAsync( pageOwnerName, userStore, uiLayout, hotkeys, gallery, pageLoadTimeMs, win );

})();