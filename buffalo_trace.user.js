// ==UserScript==
// @name         Buffalo Trace
// @namespace    http://tampermonkey.net/
// @version      2024-11-10
// @description  Scrore desirable tour reservations.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[folder]/snoop.js
// @match        https://reservations.buffalotracedistillery.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=buffalotracedistillery.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function(){

	// =======
	// Globals
	// =======

	const SECONDS = 1000; // mS
	const MINUTES = 60*SECONDS;
	const HOURS = 60*MINUTES;	
	const DAYS = 24*HOURS;

	const css = {
		log: 'color:yellow;background:blue;font-size:16px;'
	}

	function saveTextToFile(text,filename){
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text])); // old way that doesn't handle '#' a.href = "data:text,"+text;
		a.download = filename;
		a.click();
	}

	class TimeStampConsoleLogger{
		log(msg){
			const consoleMsg = (typeof msg == "object") ? JSON.stringify(msg,null,'\t') : msg;
			console.print('%c'+consoleMsg,css.log);
			this.entries.push({timestamp:new Date().valueOf(),msg});
		}
		entries=[]
	}

	function downloadLogsOnUnload(prefix,snooper,logger){
		function flushLog(){
			// Get current log items
			function dateTimeStr(d=new Date()){ function pad(x){ return (x<10?'0':'')+x;} return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); }
			const items = snooper._loadLog.map(x=>x.toJSON()).concat(logger.entries)
				.sort((a,b)=>a.timestamp-b.timestamp)
				.map(x => ({time:new Date(x.timestamp).toLocaleTimeString(),...x}));
			if(!items.length){ console.print('No log items to flush.'); return;}
			const logAsString = JSON.stringify(items,null,'\t');
			// Save to localStorage, file, clear localstorage
			localStorage.savedLog = logAsString;
			saveTextToFile(logAsString, prefix+' '+dateTimeStr()+'.txt');
			snooper._loadLog.length=0;
			logger.entries.length=0;
			delete localStorage.savedLog;
		}
		if(localStorage.savedLog!==undefined) {console.log("flushing previously savedLog"); flushLog(); }

		document.addEventListener('visibilitychange', ()=>{if(document.visibilityState=="hidden") flushLog(); });
		unsafeWindow.flushLog = flushLog;
	}

	var snooper = new RequestSnooper().logRequests();
	const logger = new TimeStampConsoleLogger();
	downloadLogsOnUnload('buffalo',snooper,logger);

	function findAsync(cssSelector){
		const el = document.querySelector(cssSelector);
		if(el!==null) return Promise.resolve(el);
		return new Promise((resolve,reject)=>{
			const id = setInterval(function(){
				const el = document.querySelector(cssSelector);
				if(el===null) return;
				clearInterval(id);
				resolve(el);
			},100);
		})
	}

	function findButtonAsync(id){
		return findAsync(`button[data-button-id="${id}"]`)
	}

	async function acceptAgeAsync(){
		const btn = await findButtonAsync('133.Ecommerce.AgeGate.actionButton1');
		btn.click();
		console.log('%cAge acknowledged', css.log);
	}

	function nextMonth(){
		const button = document.querySelectorAll('th.next')[0]; // there are 5
		button.click();
	}
	function prevMonth(){
		const button = document.querySelectorAll('th.prev')[0]; // there are 5
		button.click();
	}
	function getCurrentMonth(){
		const thEl = document.querySelectorAll('th.datepicker-switch')[0]  // there are 5
		const [monthName,y] = thEl.innerText.split(' ');
		const m = "January February March April May June July August September October November December".split(' ').indexOf(monthName)+1;
		return {m,y};
	}
	function seekMonth(targetM,targetY){
		let cur = getCurrentMonth();
		const action = (cur.y<targetY || cur.y==targetY && cur.m<targetM) ? nextMonth : prevMonth;
		while(cur.y!=targetY || cur.m!=targetM){
			action();
			cur = getCurrentMonth();
		}
		console.log(`%cLanded on ${cur.m} ${cur.y}`, css.log);
	}

	function getAvailable(){
		// To get all of the 'BOOK' buttons
		const buttons = [...document.querySelectorAll('div.availabletimelist li button')];
		const events = buttons.map(button=>{
			const table = button.closest('table');
			const [col1,col2,] = [...table.querySelectorAll('td')];
			const time = col1.innerText;
			const title = col2.children[0].innerText;
			const [availStr] = col2.children[2].innerText.split(' '), available = Number(availStr);
			return { time, title, available, button };
		});
		return events;
	}

	function selectTour(time,title){
		const match = getAvailable().filter(x=>x.title==title&&x.time==time);
		if(!match.length){ console.log('No matches'); return; }
		match[0].button.click();
	}

	async function fillFormAsync({first,last,email,mobile,zip,groupSize}){
		async function fillInputAsync(placeholder,value){
			(await findAsync(`input[placeholder="${placeholder}"]`)).value = value;
		}
		console.log('AAAAAAAAAAAAAAAAAAA');
		await fillInputAsync("First Name",first);
		await fillInputAsync("Last Name",last);
		await fillInputAsync("E-mail",email);
		await fillInputAsync("Confirm E-mail",email);
		await fillInputAsync("Mobile #",mobile);
		await fillInputAsync("Postal / Zip Code",zip);

		const incCountBtn = await findButtonAsync('85.Ecommerce.BookingInterfacePage_2_GatherInfo.actionButton23');
		for(let i=0;i<groupSize;++i)
			incCountBtn.click();
	}

	async function continueAsync(){
		const btn = await findButtonAsync('85.Ecommerce.BookingInterfacePage_2_GatherInfo.actionButton6');
		btn.click();
	}

	async function initAsync(){
		await acceptAgeAsync();
		// seekMonth(12,2024);
		// seek day
		// selectTour('10:00 AM','Trace Tour');
		// await fillFormAsync({first:"Dean",last:"Rettig",email:"rettigcd@gmail.com",mobile:"513-470-0774",zip:"45244",groupSize:4});
		// await continueAsync();
	}
	initAsync();

	// Command line
	unsafeWindow.nextMonth = nextMonth;
	unsafeWindow.prevMonth = prevMonth;


	queueMicrotask (console.debug.bind (console, '%cBuffalo Trace - loaded','background-color:#DFD;')); // Last line of file

})();