// ==UserScript==
// @name         SNL Standby Line - TEST
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Test script that requests SNL Standby Line tickets
// @author       Dean Rettig
// @require      file://C:/[folder]/snl.user.js
// @match        https://bookings-us.qudini.com/booking-widget/events/*
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==


(function(){

	unsafeWindow.runTests = async function(){

		const SECONDS = 1000;
		const {waiter,showService,myConfig,initial} = unsafeWindow.cmd;
		const old_isSnoopPath = showService.isSnoopPath;
		const old_findCurrentDivs = showService.findCurrentDivs;
		const dontLog = {log(){}}
		const noLogShowService = new showService.constructor(showService.orgId,dontLog);

		function assert(actual){
			const a=JSON.stringify(actual);
			return {
				equals(expected,testName){
					const e=JSON.stringify(expected);
					if(a==e)
						console.print(`%c${testName} - pass`, 'color:green');
					else
						console.print(`%c${testName} - failed\r\nExpect:${e}\r\nActual:${a}`, 'color:red');
				},
				isGreaterThan(lowerValue,testName){
					if(lowerValue<actual)
						console.print(`%c${testName} - pass`, 'color:green');
					else
						console.print(`%c${testName} - failed\r\nExpected ${a} > ${lowerValue}`, 'color:red');
				}
			}
		}

		const showCount = 38;

		// =============
		// ShowService
		// =============
		// SUT: showService - When: searching for show-divs => finds them
		assert(showService.findCurrentDivs().map(x=>x.tagName).length).equals(showCount,'showService.findCurrentDivs()');

		// SUT: showService - When waiting for shows to appear => finds them via the snooper
		assert(await showService.waitForShowCountAsync()).equals({showCount,reason:"snoop"},'showService.waitForShowCount-1');

		// SUT: showService - Given: no shows via api > when wait For Shows to appear => finds via DIVs
		showService.isSnoopPath = ()=>false;
		const abc = await showService.waitForShowCountAsync();
		assert(abc.showCount).isGreaterThan(1,'showService.waitForShowCount-2a');
		assert(abc.reason).equals("div",'showService.waitForShowCount-2b');

		// SUT: showService - Given: no shows > When wait For shows to appear => times out
		showService.findCurrentDivs = () => [];
		assert(await showService.waitForShowCountAsync()).equals({"showCount":0,"reason":"timeout"},'showService.waitForShowCount-3');

		showService.findCurrentDivs = old_findCurrentDivs;
		showService.isSnoopPath = old_isSnoopPath;

		// SUT: showService - When calling show API > finds shows
		assert(await showService.waitForShowCountAsync()).equals({showCount,"reason":"snoop"},'showService.waitForShowCount-4');

		// =============
		// Waiter
		// =============
		// Schedule Next - still in early phase (before)
		const result = await new Promise((resolve)=>{
			const w1 = new waiter.constructor(showService,dontLog);
			w1.reload = reason=>resolve({reason});
			w1.reloadWhenShowsAppear = timeout=>resolve({action:"rwsa",timeout});
			w1.scheduleNext(new Date(new Date().valueOf()+11*SECONDS));
		});
		assert(result).equals({reason:"before"},'waiter.scheduleNext-before');

		// Schedule Next - hit go-time > find show > reload
		assert(await new Promise((resolve)=>{
			const w1 = new waiter.constructor(noLogShowService,dontLog);
			w1.reload = reason=>resolve({reason});
			w1.scheduleNext(new Date(new Date().valueOf()+1*SECONDS));
		})).equals({reason:"showService found shows"},'waiter.scheduleNext-go-with-shows');

		// Schedule Next - hit go-time > no show > timeout
		assert(await new Promise((resolve)=>{
			const noShowService = {_logger:dontLog,fetchShowsAsync(){return Promise.resolve([]);}};
			const w1 = new waiter.constructor(noShowService,dontLog);
			w1.reload = reason=>resolve({reason});
			w1.scheduleNext(new Date(new Date().valueOf()+1*SECONDS));
		})).equals({reason:"timed out waiting for show to appear"},'waiter.scheduleNext-go-no-shows');

		// Schedule Next - after go-time > ?? Wait? or Reload now?
		assert(await new Promise((resolve)=>{
			const w1 = new waiter.constructor(noLogShowService,dontLog);
			w1.reload = reason=>resolve({reason});
			w1.scheduleNext(new Date(new Date().valueOf()-2*SECONDS));
		})).equals({reason:"showService found shows"},'waiter.scheduleNext-after go time');

		console.print('%c== Tests Complete ==', 'color:green');

		// =============
		// Submitter
		// =============

	}


})();