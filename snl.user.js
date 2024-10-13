// ==UserScript==
// @name         SNL Standby Line
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Snag SNL Standby Line tickes.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[folder]/observable.js
// @require      file://C:/[folder]/snoop.js
// @require      file://C:/[folder]/storage.js
// @require      file://C:/[folder]/snl.user.js
// @match        https://bookings-us.qudini.com/booking-widget/events/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nbc.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/choose (NBC / SNL)

// Find test case by googling "https://bookings-us.qudini.com/booking-widget/events" with the quotes
// https://bookings-us.qudini.com/booking-widget/events/Y283RE67JM8#/event/choose
// https://bookings-us.qudini.com/booking-widget/events/DBY5E5JLLXG#/event/choose

(function(){

	const SECONDS = 1000; // mS
	const MINUTES = 60*SECONDS;
	const HOURS = 60*MINUTES;	
	const DAYS = 24*HOURS;

	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	const css = {
		topBar: {position:'fixed',top:'0px',right:'0px',backgroundColor:'#ddf',zIndex:1000},
		subBar: {margin:0},
		status: {border:'thin solid black',padding:'2px 4px',"font-size":"12px"},
		success: {color:"white", backgroundColor:'green'},
		fail: {color:"white", backgroundColor:'red'},
		input: {width:"100px"}
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

	const snooper = new RequestSnooper().enableLogging({});
	unsafeWindow.snooper = snooper;

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
			obs.define('name','')
			this.listen('name',(x)=>this._nameChanged(x));
			// default
			obs.define('isDefault');
		}
		addUser(){
			const newLabel = prompt('Enter name for new config');
			if(!newLabel) return;
			this.configOptions = [...this.configOptions,newLabel];
			this.name = newLabel;
			this.saveUser();
		}
		removeName(){
			const {name} = this;
			if(!name) return;
			if(prompt(`Please confirm deleting '${name}' by typing the word 'delete'`) != 'delete') return;
			
			const index = this.configOptions.indexOf(name);
			if (index !== -1)
				this.configOptions = this.configOptions.filter((el,i)=>i != index);
			this.repo.remove(name);
			console.log('removed',name);
		}
		saveUser(){
			const {firstName,lastName,phone,email,groupSize,show} = this;
			this.repo.update(this.name,x=>Object.assign(x,{firstName,lastName,phone,email,groupSize,show}));
			if(this.isDefaut)
				localStorage.curConfig = this.name;
			console.log('user saved');
		}
		toJSON(){
			const {firstName,lastName,phone,email,show} = this;
			return {firstName,lastName,phone,email,show};
		}
		_nameChanged({newValue}){
			const x = this.repo.get(newValue);
			Object.assign(this,x);
			this.isDefault = (localStorage.curConfig == newValue);
		}
	}

	class El {
		constructor(x){ this.el = typeof x == "string" ? document.createElement(x) : x; }
		css(style){ Object.assign(this.el.style,style); return this; }
		text(text){ this.el.innerText = text; return this; }
		appendTo(host){ host.appendChild(this.el); return this; }
		attr(name,val){ this.el.setAttribute(name,val); return this; }
		on(eventName,handler){ this.el.addEventListener(eventName,handler); return this;}
	}
	class OptionEl extends El { constructor(text){ super('option'); this.text(text); } }
	class InputEl extends El { 
		constructor(type='text'){ 
			super('input'); 
			this.attr('type',type);
		}
		bind(host,prop){
			const input = this.el;
			input.value = host[prop];
			this.on('input',()=> host[prop]=input.value );
			host.listen(prop,({newValue})=>{ if(input.value != newValue) input.value = newValue; });
			return this;
		}
	}
	class CheckboxEl extends InputEl {
		constructor(){super('checkbox');}
		bind(host,prop){
			const cb = this.el;
			cb.checked = host[prop];
			this.on('click',()=> host[prop]=cb.checked );
			host.listen(prop,({newValue})=>{ if(cb.checked != newValue) cb.checked = newValue; });
			return this;
		}
	}
	class SelectEl extends El { 
		constructor(){ super('select'); this._options={};}
		addTextOption(optText){ const o = new OptionEl(optText).el; this._options[optText]=o; this.el.add(o); return this; }
		addTextOptions(optTextArr){ optTextArr.forEach( text=>this.addTextOption(text) ); return this; }
		removeTextOption(optText){ const o = this._options[optText]; this.el.remove(o.index); delete this._options[optText]; return this; }
		bind(host,prop){
			const select = this.el;
			select.value = host[prop];
			this.on('change',()=>host[prop]=select.value );
			host.listen(prop,({newValue})=>{ 
				if(select.value != newValue) select.value = newValue; 
			});
			return this;
		}
		bindOptions(host,prop){
			// assuming it is empty, we don't have to pre-remove anything
			this.addTextOptions(host[prop]);
			host.listen(prop,({oldValue,newValue})=>{
				console.log(111,oldValue,newValue);
				for(let o of oldValue) if(!newValue.includes(o)) this.removeTextOption(o);
				for(let n of newValue) if(!oldValue.includes(n)) this.addTextOption(n);
			});
			return this;
		}
	}

	function showConfig(config,topBar){
		const inputBar = new El('p').css(css.subBar).css({background:"#aaf"}).text('Config: ').appendTo(topBar).el;
		new SelectEl().css({}).bindOptions(config,'configOptions').bind(config,'name').appendTo(inputBar);
		new El('button').appendTo(inputBar).text('➕').on('click',()=>config.addAddUser());
		new El('button').appendTo(inputBar).text('➖').on('click',()=>config.removeName());
		new InputEl().css(css.input).attr('placeholder','first').bind(config,'firstName').appendTo(inputBar);
		new InputEl().css(css.input).attr('placeholder','last').bind(config,'lastName').appendTo(inputBar);
		new InputEl().css(css.input).attr('placeholder','phone').bind(config,'phone').appendTo(inputBar);
		new InputEl().css({width:"200px"}).attr('placeholder','email').bind(config,'email').appendTo(inputBar);
		new InputEl().css({width:"50px"}).attr('placeholder','1-4').bind(config,'groupSize').appendTo(inputBar);
		new SelectEl().css({}).appendTo(inputBar).bindOptions(config,'showOptions').bind(config,'show');
		new CheckboxEl('checkbox').css({height:"18px",width:"18px",'vertical-align':'top'}).bind(config,'isDefault').appendTo(inputBar).el;
		new El('button').appendTo(inputBar).text('💾').on('click',()=>config.saveUser());
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
	// ::Refresh
	//==================
	class RefreshStrategy {
		constructor(target,statusBar){
			this.target = target;
			this.pre = [60*MINUTES,45*MINUTES,30*MINUTES,15*MINUTES,5*MINUTES,2*MINUTES,1*MINUTES,20*SECONDS,5*SECONDS,0];

			this.postInterval = 2*SECONDS;
			this.postRetryPeriod = 2*MINUTES;
			this.timerStatus = new El('span').css(css.status).css({color:'black',backgroundColor:'white'}).appendTo(statusBar).el;
			if(this.pre[this.pre.length-1] != 0) this.pre.push(0);
			// pre must be in descending order, and should end with 0

		}
		scheduleNext(){
			console.print(`Go time: %c${this.target.toDateString()} ${this.target.toLocaleString()}`,'background-color:#AAF;')
			const delay = this.getDelay();
			if(delay != null){
				const targetRefreshTime = new Date( new Date().valueOf() + delay );
				console.print(`Scheduling page refresh for %c${targetRefreshTime.toLocaleTimeString()}`,'background-color:#dfd');
				setTimeout( ()=> location.reload(true), delay );
			}
			setInterval( this.showRemainingTime.bind(this), 100 )
		}

		showRemainingTime(){
			const refreshSec = this.formatSeconds( this.getDelay() );
			const targetSec = this.formatSeconds( -this.getOffsetFromTarget() );
			const time = new Date().toLocaleTimeString();
			this.timerStatus.innerHTML=`Time:${time} Target: ${targetSec} Refresh: ${refreshSec}`;
		}
		formatSeconds(mS){
			const allRemainingTenths = Math.floor(mS * 10 / SECONDS);
			const tenths = allRemainingTenths % 10;
			const totalSeconds = (allRemainingTenths-tenths) / 10;
			let seconds = totalSeconds %60;
			const minutes = (totalSeconds-seconds)/60;
			if(seconds < 10) seconds = '0'+seconds;
			return `${minutes}:${seconds}.${tenths}`;
		}

		getDelay(){
			const offset = this.getOffsetFromTarget();

			if(offset < 0){
				const nextRefresh = this.pre.find(s=>offset+s<0); // find 1st that is still before target
				return (-offset) - nextRefresh // (now-target) - (refreshTime-target)
			}

			if( offset < this.postRetryPeriod ){
				return this.postInterval;
			}

			// Exceeded try period
			const secondsAfterRetry = (offset - this.postRetryPeriod)/1000;
			console.print(`${secondsAfterRetry} sec after retry period. not scheduling reload`);
			return null;
		}

		// + is after, - is before
		getOffsetFromTarget(){ return new Date().valueOf() - this.target.valueOf(); }
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
				const span = new El('span').css(css.status).appendTo(statusBar).el;
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
					this.status.show = Status.pass(`Show selected.`);
					return true;
				}
			}

			this.status.show = Status.fail(`'${this.config.show}' not found.`);

			// After N second reload the page.
			const now = new Date().valueOf();
			if( this.startMonitorTime + 2000 * SECONDS < now )
				location.reload(true);
		}

		// Fills in the Form Text + triggers 
		// Triggers validatio nvia events
		setTextValue(sub,value){
			try{
				const matches = this.inputs.filter(i=>elementIs(i,sub) );

				if(matches.length != 1){
					this.status[sub] = Status.fail(`'${sub}': (${matches.length})`);
					return false;
				}
				const match = matches[0];
				match.value = value;
				match.dispatchEvent(new Event('change'));
				match.dispatchEvent(new Event('blur'));

				this.status[sub] = Status.pass(`${sub} set.`)
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
					this.status.groupSize = Status.pass("Grp-Size Set")
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
			this.status.bookEvent = Status.pass('Book-Event clicked');
			return true;
		}

		checkPrivacyAgreement(){
			try{
				const checkBox = document.querySelector('#privacy-agreement');
				if(checkBox == null){
					this.status.cb = Status.fail('privacy-agreement not found.');
					// status.fail('privacy-agreement not found.');
					return false;
				}
				checkBox.checked = true;
				checkBox.dispatchEvent(new Event('change'));
				checkBox.dispatchEvent(new Event('click'));
				this.status.cb = Status.pass('checked privacy-agreement');
				// status.pass('checked privacy-agreement');
				return true;
			}
			catch(ex){
				console.error('checkPrivacyAgreement',ex);
				// status.fail('CB exception.');
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
			this.status.submit = Status.pass(`submitting... at ${now}`);
			console.print(`submitting at ${now}`,nowStamp(),goStamp());
			submitButton.click();
			return true;
		}
		_findSubmitButton(){ return document.querySelector('button.btn-complete'); }
	}

	function elementIs(el,type){
		const combined = (el.name||'') + (el.id||'');
		const result = combined.toLowerCase().includes(type.toLowerCase());
		if(result)
			console.log('elIs',type,el.name,el.id);
		return result;
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
			function stop(reason,val){ 
				resolve(val); 
				clearInterval(timerId); 
				clearTimeout(timeoutId);
				console.log('Initial show counts:',val,reason,nowStamp(),goStamp());
			}
		})
		// OR
		// UI widgets to appear
		// OR TIMEOUT
	}

	class Waiter {
		constructor(orgId){this.orgId=orgId;}

		reloadWhenShowsAppear(timeout=3*SECONDS){
			const waiter = this;
			console.print(`Waiting ${timeout}ms for shows to appear`);
			const intervalId = setInterval(async function() {
				try{
					const shows = await waiter.fetchShowsAsync();
					console.log(`${shows.length} shows`);
					if(shows.length) done();
				} catch (err){ }
			},250);
			const timeoutId = setTimeout(done, timeout);
			function done(){ clearTimeout(timeoutId); clearInterval(intervalId); waiter.reload(); }
		}

		async fetchShowsAsync(){
			const response = await fetch(`https://bookings-us.qudini.com/booking-widget/event/events/${this.orgId}`);
			if(!response.ok) throw "bad response";
			return await response.json();
		}
		reload(){ location.reload(); }
	}

	// ===============
	// ::Init
	// ===============
	async function initPageAsync(){

		const liveShow = "LIVE SHOW"; // LIVE SHOW STANDBY - Saturday Night Live
		const dressRehearsal = "DRESS REHEARSAL"; // DRESS REHEARSAL STANDBY - Saturday Night Live
		const snlOrgId = "B9KIOO7ZIQF";
		const [,orgId,eventId] = document.location.href.match(/events\/([^#]+)#\/event\/(.*)/);
		const isSnl = orgId == snlOrgId;
		const configRepo = new SyncedPersistentDict(orgId);
		const myConfig = new MyConfig( configRepo );
		const waiter = new Waiter(orgId);
	
		myConfig.showOptions = ["[none]",liveShow,dressRehearsal];
		myConfig.configOptions = configRepo.keys();
		myConfig.name = localStorage.curConfig;
	
		console.print(`Using Config: %c[${myConfig.name}] for [${myConfig.show}]`,'background-color:#AAF;font-size:16px;')
		console.print(JSON.stringify(myConfig,null,'\t'))

		// wait for shows to load
		const hasShows = await showCountAsync();

		// UI
		const topBar = new El('div').css(css.topBar).appendTo( document.body ).el;
		const statusBar = new El('p').css(css.subBar).appendTo(topBar).el;
		showConfig(myConfig,topBar);

		if(hasShows){
			const submitter = new Submitter(myConfig).showInStatusBar(statusBar);
			if(!isSnl)
				submitter._findSubmitButton = function(){
					return { 
						get disabled(){ const btn = document.querySelector('button.btn-complete'); return btn==null || btn.disabled; },
						click:function(){ console.log("!!! SUBMITTED !!!"); }
					};
				}
			submitter.monitor();
		} else if( new Date().valueOf() < goTime.valueOf() )
			new RefreshStrategy( goTime, statusBar ).scheduleNext();
		else
			waiter.reloadWhenShowsAppear(3*SECONDS);

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
					const start = new Date();
					let fetchCounts = 0;
					const waiter = new Waiter(orgId);
					waiter.fetchShowsAsync = () => { fetchCounts++; return Promise.resolve([]) };
					waiter.reload = function(){ this.done=new Date(); console.log('RELOAD', fetchCounts, this.done.valueOf()-start.valueOf()); };
					waiter.reloadWhenShowsAppear(3*SECONDS);
				},
				findsShows: function(){ // after 1.5 seconds
					const start = new Date();
					let fetchCounts = 0;
					const waiter = new Waiter(orgId);
					const findShowsAfter = new Date().valueOf() + 1500;
					waiter.fetchShowsAsync = () => { 
						fetchCounts++;
						const delta = new Date().valueOf() - findShowsAfter, shows = 0<delta ? ["show"] : [];
						return Promise.resolve( shows );
					};
					waiter.reload = function(){ this.done=new Date(); console.log('RELOAD', fetchCounts, this.done.valueOf()-start.valueOf()); };
					waiter.reloadWhenShowsAppear(3*SECONDS);
				}
			}
		}

	};
	initPageAsync();

	queueMicrotask (console.debug.bind (console, '%cSNL Standby - loaded','background-color:#DFD;')); // Last line of file

})();
// TODO: 
//	Test Target Time
//	Consider not reloading at target time but just enable Waiter