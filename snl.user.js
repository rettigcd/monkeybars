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
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/27688 - dress
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/27689 - live

// Find test case by googling "https://bookings-us.qudini.com/booking-widget/events" with the quotes
// https://bookings-us.qudini.com/booking-widget/events/DBY5E5JLLXG#/event/choose  - Hotwheels
// https://bookings-us.qudini.com/booking-widget/events/6CO60SDFVYO#/event/choose  - Thanksgiving Apps and sides
// https://bookings-us.qudini.com/booking-widget/events/UZJLSRJUNZC/event/choose   - cafe classic
// https://bookings-us.qudini.com/booking-widget/events/2HYM77D8NYO/event/choose   - how to design cozy holiday bed

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
	
	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	const css = {
		topBar: {position:'fixed',top:'0px',right:'0px',backgroundColor:'#ddf',zIndex:1000},
		subBar: {margin:0},
		status: {border:'thin solid black',padding:'2px 4px',"font-size":"14px",backgroundColor:'white',color:'black'},
		success: {color:"white", backgroundColor:'green'},
		fail: {color:"white", backgroundColor:'red'},
		input: {width:"100px"},
		log: 'font-style:italic; color:black; font-size:14px; font-weight:bold;text-shadow: 1px 1px 2px #55f;'
	};

	function getNextThursday10Am(){
		const date = new Date();
		const daysFromNow = ((7+4)-date.getDay())%7;
		const targetDate = new Date(date.valueOf() + daysFromNow * DAYS);
		const yyyy = targetDate.getFullYear(), mm = targetDate.getMonth(), dd = targetDate.getDate();
		return new Date(yyyy,mm,dd,10,0,0,0);
	}

	function buildSnooper(){
		const fetchInterceptor = (url) => { // url might be string, URL, or Request
			// prevent ingest-sentry from going apeshit when something throws an excepton
			if(url.toString().includes('ingest.sentry.io') ) return new Promise(()=>{});
			return undefined;
		}
		return new RequestSnooper({fetchInterceptor}).logRequests();
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
		window.addEventListener('beforeunload', ()=>{
			function dateTimeStr(d=new Date()){ function pad(x){ return (x<10?'0':'')+x;} return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); }
			const items = snooper._loadLog.map(x=>x.toJSON()).concat(logger.entries)
				.sort((a,b)=>a.timestamp-b.timestamp)
				.map(x => ({time:new Date(x.timestamp).toLocaleTimeString(),...x}));
			saveTextToFile(JSON.stringify(items,null,'\t'), prefix+' '+dateTimeStr()+'.log');
		}, false);
	}

	function formatSeconds(mS){
		if(mS===undefined) return '';
		const prefix = mS<0 ?"-":"+";
		if(mS<0) mS = -mS;

		let x = Math.floor(mS * 10 / SECONDS);
		function rem(d,pad=true){ const r=x%d; x=(x-r)/d; return (r<10&&pad) ? ('0'+r):r; }
		const t=rem(10,false), s=rem(60), m=rem(60), h=rem(24);
		return x!=0 ? `${prefix}${x} ${h}:${m}:${s}.${t}` 
			: h!='00' ? `${prefix}${h}:${m}:${s}.${t}`
			: m!='00' ? `${prefix}${m}:${s}.${t}`
			: `${prefix}${s}.${t}`;
	}

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
					if(idx==-1) // not found in vals-to-add
						select.remove(o); // remove option
					else  // found in vals-to-add
						valsToAdd.splice(idx,1); // remove from vals-to-add because it is already theer
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

	// Adds UI to status bar and updates it when .delay is changed.
	function waiterView(waiter,topBar){
		const statusBar = newEl('p').css(css.subBar).appendTo( topBar );
		const timeEl = newEl('span').css(css.status).appendTo(statusBar);
		const tMinusEl = newEl('span').css(css.status).appendTo(statusBar);
		const watchEl = newEl('span').css(css.status).setText('Shows: ?').appendTo(statusBar);
		const refreshEl = newEl('span').css(css.status).appendTo(statusBar);
		newEl('button').css(css.status).css({pointer:'cursor'}).setText('RELOAD').on('click',()=>waiter.reload('button click')).appendTo(statusBar);

		waiter.listen('waitStatus',({newValue,oldValue})=>{
			if(oldValue===undefined) watchEl.style.backgroundColor='#8F8';
			const {attempt,count} = newValue;
			watchEl.innerText=`Shows: ${count} (${attempt})`;
			watchEl.style.backgroundColor = count == '0' ? '#F88' : '#8F8';
		});

		// update delay
		const intervalId = setInterval( () => {
			// Current Time
			timeEl.innerText=`Time:${new Date().toLocaleTimeString()}`;
			// T-(Time remaining) until Target
			const offsetFromTarget = waiter.getOffsetFromTarget();
			const targetStr = formatSeconds( offsetFromTarget );
			tMinusEl.innerText =`Target: ${targetStr}`; tMinusEl.style.color = (offsetFromTarget<0) ? "green" : "red";
			// Refresh
			const {delay} = waiter.getDelay();
			refreshEl.innerText =`Refresh: ${formatSeconds( -delay )}`;
		}, 100 )
	}

	function configView(config,topBar){
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

	function generateView({myConfig,waiter,submitter}){
		const topBar = newEl('div').css(css.topBar);
		configView(myConfig,topBar);
		waiterView(waiter,topBar);
		submitter.showInStatusBar(topBar);
		// wait for body to appear
		const id = setInterval(function(){if(document.body){topBar.appendTo(document.body);clearInterval(id);}else console.log('nobody');}, 200);
	}

	//==================
	// ::Waiter
	//==================
	class Waiter {
		constructor(showService,logger){
			this._showService = showService;
			this._logger = logger;
			this.pre = [60*MINUTES,45*MINUTES,30*MINUTES,15*MINUTES,5*MINUTES,2*MINUTES,1*MINUTES,20*SECONDS,10*SECONDS,0];
			this.postInterval = 2*SECONDS;
			this.postRetryPeriod = 2*MINUTES;
			if(this.pre[this.pre.length-1] != 0) this.pre.push(0);
			// pre must be in descending order, and should end with 0
			new Observable(this).define('waitStatus');
		}
	
		// == Phase 1 - waiting for target goTime ==
		// 1) runs a timer that updates the time until Go-Time
		// 2) schedules a Timeout to refresh
		scheduleNext(targetTime, showAppearTimeout=3*SECONDS){ // starts time for next reload / or monitor for shows
			this.target = targetTime;
			const {delay,phase} = this.getDelay(); this.delay = delay; this.phase = phase;

			this._logger.log({
				action:'scheduleNext()',
				goTime:this.target.toDateString()+' '+this.target.toLocaleString(), 
				delay, phase, 
				refreshTime:new Date( new Date().valueOf() + delay ).toLocaleTimeString()
			});
			
			setTimeout( ()=> {
				switch(phase){
					case 'timeout':
					case 'before':
						this.reload(phase); 
						break;
					case 'go':
					case 'after':
						this.reloadWhenShowsAppear(showAppearTimeout); 
						break;
				}
			}, delay );

			return this;
		}

		reload(reason=''){
			this._logger.log({action:"reload()",reason}); location.reload();
		}

		// == Phase 2 - waiting for shows ==
		reloadWhenShowsAppear(timeout=3*SECONDS){
			this._logger.log({action:'reloadWhenShowsAppear()',timeout});
			const watchingForShowsStart = new Date().valueOf();
			const {_logger:logger,_showService:showService} = this;
			const reload = (x) => this.reload(x);
			let attempt = 0;

			const intervalId = setInterval(async () => {
				try{
					++attempt;
					this.waitStatus = {attempt,count:"?"}; // `Shows: ? (${attempt})`;
					const shows = await showService.fetchShowsAsync();
					this.waitStatus = {attempt,count:shows.length}; // `Shows: ${shows.length} (${attempt})`;
					if(shows.length) done('showService found shows');
				} catch (err){
					logger.log(err);
				}
			},250);
			const timeoutId = setTimeout(function(){ 
				done('timed out waiting for show to appear'); 
			}, timeout);
			function done(reason){ 
				clearTimeout(timeoutId); 
				clearInterval(intervalId); 
				logger.log({
					action:'reloadWhenShowsAppear()-done',
					reason,
					duration:new Date().valueOf()-watchingForShowsStart
				});
				reload(reason);
			}
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
			return {delay:0,phase:'timeout'};
		}

		// + is after, - is before
		getOffsetFromTarget(){ return this.target ? new Date().valueOf() - this.target.valueOf() : undefined; }

		// for testing
		stubReload(){
			this.reload = function(){
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

		constructor(config,showService,logger){

			this.config = config;
			this._showService = showService;
			this._logger = logger;

			this.startMonitorTime = new Date().valueOf(); // record when start monitoring

			// make status observable
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

		showInStatusBar(topBar){
			const statusBar = newEl('p').css(css.subBar).appendTo( topBar );
			statusBar.innerHTML = '';
			const {status} = this;

			function create(prop){
				const span = newEl('span').css(css.status).appendTo(statusBar);
				if(prop)
					status.listen(prop,({newValue})=>{ 
						span.innerText=newValue.text;
						Object.assign(span.style,newValue.success?css.success:css.fail);
					});
				return span;
			}

			const attemptStatus = create();
			Object.assign(attemptStatus.style,{cursor:'pointer'});
			attemptStatus.addEventListener("click", ()=>this.stop())
			status.listen('attempt',({attempt})=>{
				if(attempt == "stopped"){
					attemptStatus.innerHTML = 'Stopped';
					attemptStatus.style.color='red';
				} else {
					attemptStatus.style.color='green';
					attemptStatus.style.backgroundColor = 'white';
					attemptStatus.innerHTML = attempt;
				}
			});
			"show,groupSize,bookEvent,firstName,lastName,mobileNumber,email,cb,submit".split(',')
				.forEach(create);
			return this;
		}

		monitor(){
			this._logger.log('attempting to submit page...');

			this.attempt = 0;
			this.intervalId = setInterval(()=>this.onTick(),200);

			// set focus on first element
			// const fn=[...document.getElementsByName('firstName')];
			// if(fn.length>0 && fn[0].focus) fn[0].focus();
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
				const show = this._showService.findCurrentDivs()
					.find( ({label})=>label.includes(this.config.show) );
				if(show){
					try{ show.div.click(); }catch(err){}
					this._logger.log({action:'selectShow()',show});
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

				this._logger.log({action:'setText',sub,value});
				this.status[sub] = Status.pass(`${sub} ✔`)
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
					return false;
				}
				options[index].click();

				this._logger.log({action:'setGroupSize()',size});
				return true;
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
				this.status.groupSize = changed
					? Status.pass("Grp-Size ✔")
					: Status.fail("Grp-Size NOT Set");
				return changed;
			}
			catch(er){
				console.error('validateGroupSize',er);
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
			this.status.bookEvent = Status.pass('Book-Event ✔');
			this._logger.log({action:"bookEvent()"});
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
				this._logger.log({action:"checkPRivacyAgreement()"});
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

			this.status.submit = Status.pass(`submitting ✔`);
			this._logger.log("submitting form...");
			submitButton.click();
			return true;
		}
		_findSubmitButton(){ return document.querySelector('button.btn-complete'); }

		// for testing:
		stubSubmit(){
			console.print('%cstubbing out the form submit button.','color:red;');
			const oldFinder = this._findSubmitButton;
			this._findSubmitButton = function(){
				return { 
					get disabled(){ const btn = oldFinder(); return btn==null || btn.disabled; },
					click:function(){ console.log("%c!!! SUBMITTED !!!","background:red;font-size:16px;padding:3px;font-weight:bold;color:white;"); }
				};
			}
		}

	}

	class ShowService{
		constructor(orgId,snooper,logger){ this.orgId = orgId; this._snooper=snooper; this._logger=logger; }
		// Called at start-up. Watches the page and the Snooper to determine how many shows there are.
		waitForShowCountAsync(timeout = 2*SECONDS){
			// wait for either:
			return new Promise((resolve,reject)=>{

				// 1) the DIVs to appear
				const timerId = setInterval(()=>{ const count = this.findCurrentDivs().length; if(count) stop('div',count); },100);

				// 2) or the timeout
				const timeoutId = setTimeout(()=>stop('timeout',0), timeout);

				// 3) the shows to appear on the snooper (do this LAST to ensure timers/intervals are started before we try to clear them.)
				this._snooper.addHandler(x => {
					const {url:{pathname},responseText} = x;
					if(this.isSnoopPath(pathname)){
						stop('snoop',JSON.parse(responseText).length);
						x.handled = "events";
					}
				} );

				function stop(reason,showCount){ 
					clearInterval(timerId); 
					clearTimeout(timeoutId);
					resolve({showCount,reason}); 
				}
			})
		}
		// called periodically to detect noshow-to-hasshows transition
		async fetchShowsAsync(){
			this._logger.log('querying: shows');
			                                        // https://bookings-us.qudini.com/booking-widget/event/events/2HYM77D8NYO/event/choose
			const response = await unsafeWindow.fetch(`https://bookings-us.qudini.com/booking-widget/event/events/${this.orgId}`);
			if(!response.ok) throw "bad response";
			const shows = await response.json();
			this._logger.log(`found: ${shows.length} shows.`);
			return shows;
		}
		// override to disable snoop - for testing
		isSnoopPath(pathname){ return pathname.includes('/booking-widget/event/events/'); }
		// override to disable div - for testing
		findCurrentDivs(){
			return [...document.querySelectorAll('div[aria-label]')]
				.map(div=>({div,label:div.getAttribute('aria-label')}))
				.filter(({label})=>label);
		}
	}

	// ===============
	// ::Init
	// ===============
	async function initPageAsync(){

		let goTime = getNextThursday10Am();
		let waitForShowsTimeout = 5*SECONDS;
		const [,orgId,eventId] = document.location.href.match(/events\/([^#\/]+).*\/event\/([^#\/]+)/);
		const isSnl = orgId == snlOrgId;

		const logger = new TimeStampConsoleLogger();
		const snooper = buildSnooper();
		const showService = new ShowService( orgId, snooper, logger );
		const waiter = new Waiter( showService, logger )
		const configRepo = new SyncedPersistentDict(orgId);
		const myConfig = new MyConfig( configRepo );
		const submitter = new Submitter(myConfig,showService,logger);
	
		myConfig.showOptions = ["[none]",liveShow,dressRehearsal];
		myConfig.configOptions = configRepo.keys();
		myConfig.configName = configRepo.entries().filter(([,values])=>values.isDefault).map(([name,])=>name)[0];
		downloadLogsOnUnload('snl '+orgId, snooper, logger);

		if(localStorage.testUi){
			delete localStorage.testUi;
			goTime = new Date(new Date().valueOf()+5*SECONDS);
			waitForShowsTimeout = 10*SECONDS
			const showShowsAfter = 5*SECONDS;
			Object.assign(showService,{ 
				showTime: goTime.valueOf() + showShowsAfter, 
				waitForShowCountAsync(){ return Promise.resolve({showCounts:0,reason:'timeout'}); }, 
				fetchShowsAsync(){ const hasShows = new Date() >= this.showTime; return Promise.resolve( hasShows ? ["show1","show2"] : [] ); } 
			});
			Object.assign(waiter,{
				reload(){ logger.log('RELOAD-STUB called!'); }
			});
			console.log('DUDE - TESTING');
		}

		// Start...
		logger.log({action:"start",orgId,configName:myConfig.configName,show:myConfig.show,isSnl,eventId});

		// wait for shows to load
		const initial = await showService.waitForShowCountAsync(); 
		logger.log(`Initial show counts: ${initial.showCount} from ${initial.reason}`);

		// View
		generateView({myConfig,waiter,submitter});

		if(initial.showCount){
			if(!isSnl) submitter.stubSubmit();
			submitter.monitor();
		} else{
			if( new Date().valueOf() < goTime.valueOf() ){
				waiter.scheduleNext(goTime,waitForShowsTimeout);
			} else {
				waiter.reloadWhenShowsAppear(waitForShowsTimeout);
			}
		}

		unsafeWindow.cmd = {waiter,showService,myConfig,snooper,logger,initial,formatSeconds};
		unsafeWindow.snooper = snooper;

	};
	initPageAsync();

	queueMicrotask (console.debug.bind (console, '%cSNL Standby - loaded','background-color:#DFD;')); // Last line of file

})();