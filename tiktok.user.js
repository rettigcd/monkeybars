// ==UserScript==
// @name         Tiktok
// @namespace    http://tampermonkey.net/
// @version      1
// @description  misc
// @author       Dean Rettig
// @require      file://C:/Users/rettigcd/src/monkeybars/tiktok.user.js
// @match        http*://www.tiktok.com/@*
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=tiktok.com
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_log
// @grant        unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    function go(){
console.log(11);
        const imgs = [...document.querySelectorAll('img')]
            .filter(x=>x.width>300);
        const imgUrls = imgs
            .map(x=>x.src)
            .filter((v,i,a)=>a.indexOf(v)===i)
console.log(22);
        // to move them to top
        const used={};
        imgs.forEach(x=>{
            if(used[x.src]) return;
            document.body.prepend(x);
            x.style.height="300px";
            x.style.display="inline-block";
            x.style.margin="10px";
            x.classList.remove(...x.classList);
            used[x.src]=true;
        })
        console.log('Relocated '+Object.keys(used).length+' images.');
    }

    unsafeWindow.go = go;


    queueMicrotask (console.debug.bind (console, '%cTikTok - loaded','background-color:#DFD;')); // Last line of file

})()