// ==UserScript==
// @name         SNL Standby Line
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Snag SNL Standby Line tickes.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[folder]/observable.js
// @require      file://C:/[folder]/dom.js
// @require      file://C:/[folder]/snoop.js
// @require      file://C:/[folder]/storage.js
// @require      file://C:/[folder]/snl.user.js
// @match        https://bookings-us.qudini.com/booking-widget/events/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nbc.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/choose (NBC / SNL)
// dress: https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/27688
// live:  https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/27689

// Find test case by googling "https://bookings-us.qudini.com/booking-widget/events" with the quotes
// https://bookings-us.qudini.com/booking-widget/events/Y283RE67JM8#/event/choose
// https://bookings-us.qudini.com/booking-widget/events/DBY5E5JLLXG#/event/choose

(function(){

	// =======
	// Globals
	// =======

	const SECONDS = 1000; // mS
	const MINUTES = 60*SECONDS;
	const HOURS = 60*MINUTES;	
	const DAYS = 24*HOURS;

	const liveShow = "LIVE SHOW"; // LIVE SHOW STANDBY - Saturday Night Live
	const dressRehearsal = "DRESS REHEARSAL"; // DRESS REHEARSAL STANDBY - Saturday Night Live
	const snlOrgId = "B9KIOO7ZIQF";
	const [,orgId,eventId] = document.location.href.match(/events\/([^#]+)#\/event\/(.*)/);
	const isSnl = orgId == snlOrgId;

	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	const css = {
		topBar: {position:'fixed',top:'0px',right:'0px',backgroundColor:'#ddf',zIndex:1000},
		subBar: {margin:0},
		status: {border:'thin solid black',padding:'2px 4px',"font-size":"12px"},
		success: {color:"white", backgroundColor:'green'},
		fail: {color:"white", backgroundColor:'red'},
		input: {width:"100px"},
		configState: "background-color:#AAF;font-size:16px;"
	}

	const goTime = (function getNextThursday10Am(){
		const date = new Date();
		const daysFromNow = ((7+4)-date.getDay())%7;
		const targetDate = new Date(date.valueOf() + daysFromNow * DAYS);
		const yyyy = targetDate.getFullYear(), mm = targetDate.getMonth(), dd = targetDate.getDate();
		return new Date(yyyy,mm,dd,10,0,0,0); // (my clock is ahead by 582ms per https://time.gov)
	})(), nowMs = new Date().valueOf();
	function goStamp(){ return new Date().valueOf()-goTime.valueOf(); }
	function nowStamp(){ return new Date().valueOf()-nowMs;}

	const fetchInterceptor = (url) => url.path.includes('ingest.sentry.io') ? new Promise(()=>{}) : undefined; // for ingest, never resolve
	const snooper = new RequestSnooper({fetchInterceptor}).logRequests();
	unsafeWindow.snooper = snooper;

	function saveTextToFile(text,filename){
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text])); // old way that doesn't handle '#' a.href = "data:text,"+text;
		a.download = filename;
		a.click();
	}

	const perma={
		log(msg){ 
			this.entries.push({timestamp:new Date().valueOf(),msg});
			console.print(msg);
		},
		entries:[]
	};

	window.addEventListener('beforeunload', ()=>{
		function dateTimeStr(d=new Date()){ function pad(x){ return (x<10?'0':'')+x;} return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); }
		const prefix = 'snl '+orgId;
		const items = snooper._loadLog.map(x=>x.toJSON()).concat(perma.entries)
			.sort((a,b)=>a.timestamp-b.timestamp)
			.map(x => ({tsTxt:new Date(x.timestamp).toLocaleTimeString(),...x}));
		saveTextToFile(JSON.stringify(items,null,'\t'), prefix+' '+dateTimeStr()+'.log');
	}, false);

	perma.log('test');

	// =================
	// Class Definitions
	// =================

	// Properties are the current configuration values.
	class MyConfig{
		constructor(repo){
			this.repo = repo;

			const obs = new Observable(this);
			// Form values
			'firstName,lastName,email,phone,groupSize,show'.split(',').forEach(prop=>{
				obs.define(prop,'');
			})
			// Options
			obs.define('configOptions',[]);
			obs.define('showOptions',[]);
			// config name
			obs.define('configName','')
			this.listen('configName',(x)=>this._onConfigNameChanged(x));
			// default
			obs.define('isDefault');
		}
		addUser(){
			const newLabel = prompt('Enter name for new config');
			if(!newLabel) return;
			this.configOptions = [...this.configOptions,newLabel];
			this.configName = newLabel;
			this.saveUser();
		}
		removeName(){
			const {configName} = this;
			if(!configName) return;
			if(prompt(`Please confirm deleting '${configName}' by typing the word 'delete'`) != 'delete') return;
			
			const index = this.configOptions.indexOf(configName);
			if (index !== -1)
				this.configOptions = this.configOptions.filter((el,i)=>i != index);
			this.repo.remove(configName);
			console.log('removed',configName);
		}
		saveUser(){
			const {firstName,lastName,phone,email,groupSize,show,isDefault} = this;
			if(isDefault){
				if(this._lastDefaultConfigName)
					this.repo.update(this._lastDefaultConfigName,x=>x.isDefault=false);
				this._lastDefaultConfigName = this.configName;
			}
			this.repo.update(this.configName,x=>Object.assign(x,{firstName,lastName,phone,email,groupSize,show,isDefault}));
			console.log('user saved');
		}
		toJSON(){
			const {firstName,lastName,phone,email,show} = this;
			return {firstName,lastName,phone,email,show};
		}
		_onConfigNameChanged({newValue}){
			const x = this.repo.get(newValue);
			Object.assign(this,x);
		}
	}

	const bind = {
		textInput: function(input,host,prop){ // builds an action that can be used in .chain()
			input.value = host[prop];
			input.on('input',()=> host[prop]=input.value );
			host.listen(prop,({newValue})=>{ if(input.value != newValue) input.value = newValue; });
		},
		checkbox: function(cb,host,prop){
			cb.checked = host[prop];
			cb.on('click',()=> host[prop]=cb.checked );
			host.listen(prop,({newValue})=>{ if(cb.checked != newValue) cb.checked = newValue; });
		},
		optionsToStringArr: function(select,host,prop){
			function setOptions(newOptions){
				const valsToAdd = [ ...newOptions ];
				[...select.children].forEach(o=>{
					const text = o.innerText, idx = valsToAdd.indexOf(text);
					if(idx==-1) select.remove(o); else valsToAdd. valsToAdd.splice(idx,1);
				})
				for(let n of valsToAdd) select.add(newOption(n));
			}
			setOptions(host[prop]);
			host.listen(prop,({newValue})=> setOptions(newValue) );
		},
		selectValue: function(select,host,prop){
			select.value = host[prop];
			select.on('change',()=>host[prop]=select.value );
			host.listen(prop,({newValue})=>{ 
				if(select.value != newValue) select.value = newValue; 
			});
		}
	};

	function showConfig(config,topBar){
		const inputBar = newEl('p').css(css.subBar).css({background:"#aaf"}).setText('Config: ').appendTo(topBar);
		newSelect().chain(x=>bind.optionsToStringArr(x,config,'configOptions')).chain(x=>bind.selectValue(x,config,'configName')).appendTo(inputBar);
		newEl('button').setText('➕').on('click',()=>config.addUser()).appendTo(inputBar);
		newEl('button').setText('➖').on('click',()=>config.removeName()).appendTo(inputBar);
		newInput().css(css.input).attr('placeholder','first').chain(x=>bind.textInput(x,config,'firstName')).appendTo(inputBar);
		newInput().css(css.input).attr('placeholder','last').chain(x=>bind.textInput(x,config,'lastName')).appendTo(inputBar);
		newInput().css(css.input).attr('placeholder','phone').chain(x=>bind.textInput(x,config,'phone')).appendTo(inputBar);
		newInput().css({width:"200px"}).attr('placeholder','email').chain(x=>bind.textInput(x,config,'email')).appendTo(inputBar);
		newInput().css({width:"50px"}).attr('placeholder','1-4').chain(x=>bind.textInput(x,config,'groupSize')).appendTo(inputBar);
		newSelect().chain(x=>bind.optionsToStringArr(x,config,'showOptions')).chain(x=>bind.selectValue(x,config,'show')).appendTo(inputBar);
		newInput('checkbox').css({height:"18px",width:"18px",'vertical-align':'top'}).chain(x=>bind.checkbox(x,config,'isDefault')).appendTo(inputBar);
		newEl('button').setText('💾').on('click',()=>config.saveUser()).appendTo(inputBar);
	}

	class ShowDiv{
		div; label;
		constructor(div){
			this.div=div;
			this.label=div.getAttribute('aria-label');
		}
		static findCurrentAsync(timeout=1*SECONDS){
			return new Promise((resolve,reject)=>{
				const timeoutTime = new Date().valueOf() + timeout;
				const timerId = setInterval(()=>{
					const shows = ShowDiv.findCurrent();
					if(shows.length || timeoutTime < new Date().valueOf()){
						resolve(shows);
						clearInterval(timerId);
					}
				},100)
			})
		}
		static findCurrent(){
			return [...document.querySelectorAll('div[aria-label]')]
				.map(div=>new ShowDiv(div))
				.filter(({label})=>label);
		}
	}
	//==================
	// ::Waiter
	//==================
	class Waiter {
		constructor(orgId){
			this.orgId=orgId;
			this.pre = [60*MINUTES,45*MINUTES,30*MINUTES,15*MINUTES,5*MINUTES,2*MINUTES,1*MINUTES,20*SECONDS,10*SECONDS,0];
			this.postInterval = 2*SECONDS;
			this.postRetryPeriod = 2*MINUTES;
			if(this.pre[this.pre.length-1] != 0) this.pre.push(0);
			// pre must be in descending order, and should end with 0
		}
	
		// == Phase 1 - waiting for target goTime ==
		// 1) runs a timer that updates the time until Go-Time
		// 2) schedules a Timeout to refresh
		scheduleNext(target, showAppearTimeout=3*SECONDS){ // starts time for next reload / or monitor for shows
			this.target = target;
			console.print(`Go time: %c${this.target.toDateString()} ${this.target.toLocaleString()}`,'background-color:#AAF;')
			const {delay,phase} = this.getDelay(); this.delay = delay; this.phase = phase;
			if(delay === undefined) return;
			const targetRefreshTime = new Date( new Date().valueOf() + delay );
			console.print(`Scheduling page refresh for %c${targetRefreshTime.toLocaleTimeString()}`,'background-color:#dfd');
			
			setTimeout( ()=> {
				switch(phase){
					case 'before': this.reload(); break;
					case 'go': this.reloadWhenShowsAppear(showAppearTimeout); break;
					case 'after': this.reloadWhenShowsAppear(showAppearTimeout); break;
					default: break;
				}
				clearInterval( intervalId );
			}, delay );

			return this;
		}

		// Adds UI to status bar and updates it when .delay is changed.
		displayRemainingTime(statusBar){
			const timeEl = newEl('span').css(css.status).css({color:'black',backgroundColor:'white'});//.appendTo(statusBar);
			const tMinusEl = newEl('span').css(css.status).css({color:'black',backgroundColor:'white'}).appendTo(statusBar);
			const refreshEl = newEl('span').css(css.status).css({color:'black',backgroundColor:'white'});//.appendTo(statusBar);
			const phaseEl = newEl('span').css(css.status).css({color:'black',backgroundColor:'white'});//.appendTo(statusBar);
			this.watchEl =newEl('span').css(css.status).css({color:'black',backgroundColor:'pink'}).setText('-----').appendTo(statusBar);
			newEl('button').css(css.status).css({pointer:'cursor'}).setText('RELOAD').on('click',()=>this.reload()).appendTo(statusBar);

			// update delay
			const intervalId = setInterval( () => {
				const {delay,phase} = this.getDelay();
				const refreshSec = this.formatSeconds( -delay );
				const targetSec = this.formatSeconds( this.getOffsetFromTarget() );
				timeEl.innerText=`Time:${new Date().toLocaleTimeString()}`;
				tMinusEl.innerText=`Target: ${targetSec}`;
				tMinusEl.style.color = (delay>0) ? "green" : "red";
				refreshEl.innerText=`Refresh: ${refreshSec}`;
				phaseEl.innerText=`Phase: ${phase}`;
			}, 100 )

			return this;
		}

		formatSeconds(mS){
			const prefix = mS<0 ?"-":"+";
			if(mS<0) mS = -mS;
			const allRemainingTenths = Math.floor(mS * 10 / SECONDS);
			const tenths = allRemainingTenths % 10;
			const totalSeconds = (allRemainingTenths-tenths) / 10;
			let seconds = totalSeconds %60;
			const minutes = (totalSeconds-seconds)/60;
			if(seconds < 10) seconds = '0'+seconds;
			return `${prefix}${minutes}:${seconds}.${tenths}`;
		}

		getDelay(){
			const offset = this.getOffsetFromTarget();

			if(offset < 0){
				const nextRefresh = this.pre.find(s=>offset+s<0); // find 1st that is still before target
				return {
					delay:(-offset)-nextRefresh,   // (now-target) - (refreshTime-target)
					phase: nextRefresh == 0 ? 'go' : 'before',
				};
			}

			if( offset < this.postRetryPeriod ){
				return {delay:this.postInterval, phase: 'after'};
			}

			// Exceeded try period
			return {delay:undefined,phase:'timeout'};
		}

		// + is after, - is before
		getOffsetFromTarget(){ return new Date().valueOf() - this.target.valueOf(); }

		// == Phase 2 - waiting for shows ==
		reloadWhenShowsAppear(timeout=3*SECONDS){
			this.watchingForShowsStart = new Date().valueOf();
			const waiter = this;
			console.print(`Waiting ${timeout}ms for shows to appear`);
			let attempt = 0;

			if(this.watchEl) this.watchEl.style.backgroundColor='#FF8';
			const intervalId = setInterval(async () => {
				try{
					++attempt;
					this.watchText(`Attempt ${attempt}`)
					const shows = await waiter.fetchShowsAsync();
					this.watchText(`Attempt ${attempt} - ${shows.length}`);
					console.log(`${shows.length} shows`);
					if(shows.length) done();
				} catch (err){ }
			},250);
			const timeoutId = setTimeout(done, timeout);
			function done(){ clearTimeout(timeoutId); clearInterval(intervalId); waiter.reload(); }
		}
		watchText(text){ if(this.watchEl) this.watchEl.innerText=text; }
	
		async fetchShowsAsync(){
			const response = await fetch(`https://bookings-us.qudini.com/booking-widget/event/events/${this.orgId}`);
			if(!response.ok) throw "bad response";
			return await response.json();
		}

		reload(){ location.reload(); }

		// for testing
		stubReload(){
			this.reload = function(){
				this.done=new Date();
				if(this.watchingForShowsStart)
					console.log(`Show-watch duration: ${this.done.valueOf()-this.watchingForShowsStart}`);
				console.log("%cRELOAD",'background:red;color:white;border:2px solid black;');
			};
			return this;
		}

	}

	//==================
	// ::Submit
	//==================

	class Status{
		success;
		text;
		constructor(success,text){this.success=success;this.text=text;}
		static pass(text){ return new Status(true,text); }
		static fail(text){ return new Status(false,text); }
	}

	class Submitter {

		constructor(config){

			this.config = config;

			this.startMonitorTime = new Date().valueOf(); // record when start monitoring

			this.status = {}
			new Observable(this.status).define('attempt').define('show')
				.define('groupSize').define('bookEvent')
				.define('firstName').define('lastName').define('email').define('mobileNumber')
				.define('cb').define('submit');

			this.foundShow = false;
			this.submittedForm = false;
			this.finders = {
				// Phase 1
				setGroupSize:      () => this.setGroupSize(this.config.groupSize),
				validateGroupSize: () => this.validateGroupSize(this.config.groupSize),
				bookEvent:         () => this.bookEvent(),

				// Phase 2
				first: ()=> this.setTextValue('firstName',this.config.firstName),
				last: ()=>  this.setTextValue('lastName',this.config.lastName),
				email: ()=> this.setTextValue('email',this.config.email),
				mobileNumber: ()=> this.setTextValue('mobileNumber',this.config.phone),

				privacyAgreement: () => this.checkPrivacyAgreement(),
			};

		}

		showInStatusBar(statusBar){
			statusBar.innerHTML = '';
			const {status} = this;

			function create(prop){
				const span = newEl('span').css(css.status).appendTo(statusBar);
				if(prop)
					status.listen(prop,({newValue})=>{ 
						span.innerHTML=newValue.text;
						Object.assign(span.style,newValue.success?css.success:css.fail);
					});
				return span;
			}

			const attemptStatus = create();
			Object.assign(attemptStatus.style,{cursor:'pointer'});
			attemptStatus.addEventListener("click", this.stop.bind(this))
			this.status.listen('attempt',({attempt})=>{
				if(attempt == "stopped"){
					attemptStatus.innerHTML = 'Stopped';
					attemptStatus.style.color='red';
				} else {
					attemptStatus.style.color='green';
					attemptStatus.style.backgroundColor = 'white';
					attemptStatus.innerHTML = attempt;
				}
			});
			"show,groupSize,bookEvent,firstName,lastName,mobileNumber,email,cb,submit".split(',').forEach(create);
			return this;
		}

		monitor(){
			console.print('%cattempting to submit page...','color:green;');

			this.attempt = 0;
			this.intervalId = setInterval(this.onTick.bind(this),200);

			// set focus on first element
			const fn=[...document.getElementsByName('firstName')];
			if(fn.length>0 && fn[0].focus) fn[0].focus();
		}

		onTick(){
			this.inputs = [...document.querySelectorAll('input')];

			if(!this.foundShow)
				this.foundShow = this.selectShow();

			// loop through finders
			const keys = Object.keys(this.finders);
			for(const key of keys){
				if(this.finders[key]())
					delete this.finders[key];
			}

			// if no finders are left, try to submit the form
			const isReadyToSubmit = Object.keys(this.finders) == 0 || !(this._findSubmitButton()||{}).disabled;
			if( isReadyToSubmit && !this.submittedForm){
				this.submittedForm = this.submitForm();
				if(this.submittedForm) this.stop();
			}

			const maxAttempts = 500;
			if(++this.attempt == maxAttempts){
				this.stop();
				this.status.attempt="stopped";
			} else
				this.status.attempt=`Attempt ${this.attempt} of ${maxAttempts}`;
		}

		stop(){ clearInterval(this.intervalId); }

		selectShow(){ // return null if unsuccessful
			if(this.config.show){
				const show = ShowDiv.findCurrent()
					.find( ({label})=>label.includes(this.config.show) );
				if(show){
					try{ show.div.click(); }catch(err){}
					this.status.show = Status.pass('`Show selected.');
					return true;
				}
			}

			this.status.show = Status.fail(`'${this.config.show}' not found.`);
		}

		// Fills in the Form Text + triggers 
		// Triggers validatio nvia events
		setTextValue(sub,value){
			try{
				const matches = this.inputs.filter(i=>i.name == sub );

				if(matches.length != 1){
					this.status[sub] = Status.fail(`'${sub}': (${matches.length})`);
					return false;
				}
				const match = matches[0];
				match.value = value;
				match.dispatchEvent(new Event('change'));
				match.dispatchEvent(new Event('blur'));

				this.status[sub] = Status.pass(`${sub} &#x2714;`)
				return true;
			}
			catch(ex){
				console.error('setTextValue',ex);
			}
		}

		// GroupSize - Part 1
		// Open Group-Size dropdown and clicks groups size
		// once it thinks it has succeeded, it stops trying - gives user the ability to intercede
		setGroupSize(size){
			try{
				const groupSizeDiv = this.getGroupSizeDiv();
				if(groupSizeDiv ==null)
					this.status.groupSize = Status.fail('group-size not found.');
				if(groupSizeDiv == null) return false;

				// -----------------
				// CLICK - Open Dropdown
				if(!groupSizeDiv.classList.contains('open')){
					const openDropDownButton = groupSizeDiv.querySelector('button.dropdown-toggle');
					if(openDropDownButton != null)
						openDropDownButton.click();
				}

				// -----------------
				// CLICK - Find option & Set it!
				const options = [...groupSizeDiv.querySelectorAll('div.group-size-dropdown ul.dropdown-menu li a')];
				const index = Math.max(+size,1)-1; // assuming size=1 is in index=0 // missing or negative size, use 1
				if(!(index < options.length)){
					this.status.groupSize = Status.fail(`Too few Grp-Size Options: ${options.length}`);
					// status.fail(`Too few Grp-Size Options: ${options.length}`);
					return false;
				}
				options[index].click();

				return true; // This should disable the auto-clicking.
			}
			catch(er){
				console.error('setGroupSize',er);
			}

		}


		// GroupSize - Part 2
		// Checks if the select-group-size action succeeded
		// Does not actually Do anything, allows user to intercede
		validateGroupSize(size){
			try{
				const groupSizeDiv = this.getGroupSizeDiv();
				if(groupSizeDiv ==null){
					this.status.groupSize = Status.fail('group-size not found.');
					return null;
				}

				// check if it was set
				const btns = [...groupSizeDiv.querySelectorAll('button')];
				const changed = btns.length==2 && btns[0].innerHTML == size;
				if(changed){
					this.status.groupSize = Status.pass("Grp-Size &#x2714;")
				} else {
					this.status.groupSize = Status.fail("Grp-Size NOT Set")
				}
				return changed;
			}
			catch(er){
				console.error('setGroupSize',er);
			}

		}

		getGroupSizeDiv(){
			return document.querySelector('div.group-size div.group-size-dropdown');
		}

		// Step 1 - After selecting group size
		bookEvent(){
			const btn = document.querySelector('button.btn-book-event');
			if(btn == null){
				this.status.bookEvent = Status.fail('Book-Event not found');
				return false;
			}
			if(btn.click) btn.click();
			if(btn.triggerHandler) btn.triggerHandler('click');
			this.status.bookEvent = Status.pass('Book-Event &#x2714;');
			return true;
		}

		checkPrivacyAgreement(){
			try{
				const checkBox = document.querySelector('#privacy-agreement');
				if(checkBox == null){
					this.status.cb = Status.fail('privacy-agreement not found.');
					return false;
				}
				checkBox.checked = true;
				checkBox.dispatchEvent(new Event('change'));
				checkBox.dispatchEvent(new Event('click'));
				this.status.cb = Status.pass('checked privacy-agreement');
				return true;
			}
			catch(ex){
				console.error('checkPrivacyAgreement',ex);
				this.status.cb = Status.fail('CB exception.');
			}
			return false;
		}

		// Step 2 - After filling out all user information.
		submitForm(){

			const submitButton = this._findSubmitButton();
			if(submitButton == null){
				this.status.submit = Status.fail('no submit found');
				return;
			}
			if( submitButton.disabled ){
				this.status.submit = Status.fail('submit is disabled');
				return false;
			}

			const now = new Date().toLocaleString();
			this.status.submit = Status.pass(`submitting &#x2714;`);
			console.print(`submitting at ${now}`,nowStamp(),goStamp());
			perma.log(`submitting at ${now} ${nowStamp()} ${goStamp()}`);
			submitButton.click();
			return true;
		}
		_findSubmitButton(){ return document.querySelector('button.btn-complete'); }

		// for testing:
		stubSubmit(){
			console.print('%cstubbing out the submit button.','color:red;');
			const oldFinder = this._findSubmitButton;
			this._findSubmitButton = function(){
				return { 
					get disabled(){ const btn = oldFinder(); return btn==null || btn.disabled; },
					click:function(){ console.log("%c!!! SUBMITTED !!!","background:red;font-size:16px;padding:3px;font-weight:bold;color:white;"); }
				};
			}
		}

	}

	// Run on Page-Load to know what state we are in.
	function showCountAsync(timeout = 2*SECONDS){
		// wait for either:
		return new Promise((resolve,reject)=>{

			// the shows to appear on the snooper
			snooper.addHandler(x => {
				const {url:{pathname},responseText} = x;
				if(pathname.includes('/booking-widget/event/events/')){
					stop('snoop',JSON.parse(responseText).length);
					x.handled = "events";
				}
			} );

			// the DIVs to appear
			const timerId = setInterval(()=>{ const count = ShowDiv.findCurrent().length; if(count) stop('div',count); },100);
			// or the timeout
			const timeoutId = setTimeout(()=>stop('timeout',0), timeout);
			function stop(reason,showCount){ 
				resolve(showCount); 
				clearInterval(timerId); 
				clearTimeout(timeoutId);
				console.print('Initial show counts:',showCount,reason,nowStamp(),goStamp());
			}
		})
	}

	// ===============
	// ::Init
	// ===============
	async function initPageAsync(){

		const configRepo = new SyncedPersistentDict(orgId);
		const myConfig = new MyConfig( configRepo );
		const waiter = new Waiter( orgId )
	
		myConfig.showOptions = ["[none]",liveShow,dressRehearsal];
		myConfig.configOptions = configRepo.keys();
		myConfig.configName = configRepo.entries().filter(([,values])=>values.isDefault).map(([name,])=>name)[0];
	
		console.print(`${orgId}: Using Config: %c[${myConfig.configName}] for [${myConfig.show}]` + (isSnl?" SNL":""),css.configState)
		console.print(JSON.stringify(myConfig,null,'\t'))

		// wait for shows to load
		const hasShows = await showCountAsync();
	
		// UI
		const topBar = newEl('div').css(css.topBar).appendTo( document.body );
		const statusBar = newEl('p').css(css.subBar).appendTo( topBar );
		showConfig(myConfig,topBar);

		if(hasShows){
			const submitter = new Submitter(myConfig).showInStatusBar(statusBar);
			if(!isSnl) submitter.stubSubmit();
			submitter.monitor();
		} else if( new Date().valueOf() < goTime.valueOf() ){
			waiter.scheduleNext(goTime,5*SECONDS).displayRemainingTime(statusBar);
			// waiter.stubReload().scheduleNext(new Date(new Date().valueOf()+10*SECONDS),5*SECONDS).displayRemainingTime(statusBar);
		} else {
			waiter.reloadWhenShowsAppear(5*SECONDS);
		}

		unsafeWindow.test = {
			waiter : {
				fetch: async function(){
					try{
						const shows = await waiter.fetchShowsAsync();
						console.log(`%cFound ${shows.length} Shows`,'color:green');
					} catch(err){
						console.error(err);
					}
				},
				reload: function(){ waiter.reload(); },
				timesOut: function(){
					let fetchCounts = 0;
					const waiter = new Waiter(orgId);
					waiter.fetchShowsAsync = () => { fetchCounts++; return Promise.resolve([]) };
					waiter.stubReload();
					waiter.reloadWhenShowsAppear(3*SECONDS);
				},
				findsShows: function(){ // after 1.5 seconds
					const findShowsAfter = new Date().valueOf() + 1500;
					let fetchCounts = 0;
					const waiter = new Waiter(orgId);
					waiter.fetchShowsAsync = () => { 
						fetchCounts++;
						const delta = new Date().valueOf() - findShowsAfter, shows = 0<delta ? ["show"] : [];
						return Promise.resolve( shows );
					};
					waiter.stubReload();
					waiter.reloadWhenShowsAppear(3*SECONDS);
				},
				hitsTargetAndFinds: function(){
					const start = new Date().valueOf();
					waiter.stubReload();
					waiter.scheduleNext(new Date(start + 3*SECONDS));
				}
			},
		}

	};
	initPageAsync();

	queueMicrotask (console.debug.bind (console, '%cSNL Standby - loaded','background-color:#DFD;')); // Last line of file

})();
/*
TODO: 
	Test Target Time
	Test checkbox
	Consider not reloading at target time but just enable Waiter

Given: soon target time
When: cross target
Then: engaves waiter, which reloads

Currently: If Shows, submit them.     
	CON: can't test reload while there is a show

Switch To: If before target, Reload.  
	CON: could possibly be show and not see it.
	CON: can't test form selection


*/