// ==UserScript==
// @name         SNL Standby Line
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @require      file://C:/Users/rettigcd/src/monkeybars/snl.user.js
// @match        https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nbc.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/choose

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18875
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18876

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18932
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18933


(function(){

	const SEC = 1000; // mS
	const MIN = 60*SEC;
	const HOUR = 60*MIN;
	const DAYS = 24*HOUR;

	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	//==================
	// ::Status Bar
	//==================
	const status = document.body.appendChild(document.createElement('p'));
	Object.assign(status.style,{position:'fixed',top:'0px',right:'0px',backgroundColor:'#ddf',zIndex:1000});
	function create(){
		const span = status.appendChild(document.createElement('span'));
		Object.assign(span.style,{border:'thin solid black',padding:'5px'});
		span.pass = function(text){ this.innerHTML=text; this.style.backgroundColor='green'; }
		span.fail = function(text){ this.innerHTML=text; this.style.backgroundColor='red'; }
		return span;
	}

	// Buttons
	const buttons = document.body.appendChild(document.createElement('p'));
	Object.assign(buttons.style,{position:'fixed',top:'25px',right:'0px',backgroundColor:'#ddf',zIndex:1000});

	// ==================================
	// Create a button to fill LATER DATA
	// ==================================
//	const fill = buttons.appendChild(document.createElement('button'));
//	Object.assign(fill.style,{fontSize:'24px',padding:'5px'});
//	fill.innerHTML = '* Fill Other Person *';
//	fill.addEventListener("click", function(){
//		let inputs = [...document.querySelectorAll('input')]
//			.filter(function(i){
//				const type = (i.getAttribute('type')||'').toLowerCase();
//				return i.value == '' 
//					&& (type =='text')
//					&& i.getAttribute('aria-Label') != 'Search venue'
//					&& !i.id.includes('datepicker');
//			});
//		if(inputs.length == 0)
//			inputs = [...document.querySelectorAll('input')]
//				.filter(function(i){
//					const type = (i.getAttribute('type')||'').toLowerCase();
//					return i.value == '' 
//						&& (type == '' || type =='text')
//						&& i.getAttribute('aria-Label') != 'Search venue'
//						&& !i.id.includes('datepicker');
//				});
//
//		console.debug(`Found ${inputs.length} inputs`,inputs)
//		if(inputs.length == 1)
//			inputs[0].value = 'Karen Gardinsky'
//		else if(2<=inputs.length){
//			const first = inputs.filter(i=>elementIs(i,'first') ) || inputs[0];
//			const last = inputs.filter(i=>elementIs(i,'last') ) || inputs[1];
//			first.value = 'Karen';
//			last.value = 'Gardinsky';
//		}
//	});


	//==================
	// ::Refresh
	//==================
	class RefreshStrategy {
		constructor({pre,target,postInterval,postRetryPeriod}){
			this.target = target;
			this.pre = pre; // in Milliseconds
			this.postInterval = postInterval || 2;
			this.postRetryPeriod = postRetryPeriod || 2*MIN;
			this.timerStatus = create();
			Object.assign(this.timerStatus.style,{color:'black',backgroundColor:'white'});
			if(pre[pre.length-1] != 0) pre.push(0);
			// pre must be in descending order, and should end with 0

		}
		scheduleNext(){
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
			const allRemainingTenths = Math.floor(mS * 10 / SEC);
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
	class SubmitPage {

		constructor( {formValues,show} ){

			this.startMonitorTime = new Date().valueOf(); // record when start monitoring

			const {firstName,lastName,email,phone,groupSize} = formValues;

			status.innerHTML = '';
			this.attemptStatus = create();
			this.showStatus = create();

			// Phase 1
			this.grpSizeStatus = create(); // group Size
			this.beStatus = create();

			// Phase 2
			this.firstStatus = create();
			this.lastStatus = create();
			this.phoneStatus = create();
			this.emailStatus = create();
			this.cbStatus = create();
			this.submitStatus = create();
			this.show = show;

			this.foundShow = false;
			this.submittedForm = false;
			this.finders = {
				// Phase 1
				groupSize: () => this.setGroupSize(groupSize,this.grpSizeStatus),
				groupSize2: () => this.validateGroupSize(groupSize,this.grpSizeStatus),
				bookEvent: () => this.bookEvent(this.beStatus),
				// Phase 2
				first: ()=> this.setTextValue('first',firstName,this.firstStatus),
				last: ()=> this.setTextValue('last',lastName,this.lastStatus),
				phone: ()=> this.setTextValue('mail',email,this.emailStatus),
				email: ()=> this.setTextValue('mobile',phone,this.phoneStatus), // "mobileNumber"
				privacyAgreement: () => this.checkPrivacyAgreement(this.cbStatus)
			};

			// stop button
			const stop = this.attemptStatus;// buttons.appendChild(document.createElement('button'));
			Object.assign(stop.style,{cursor:'pointer'});
			stop.innerHTML = '* STOP *';
			stop.addEventListener("click", this.stop.bind(this))
		}

		monitor(){
			console.debug('Monitoring... %cSUBMIT','background-color:#0F0');
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
			if( Object.keys(this.finders) == 0 && this.submittedForm==false){
				this.submittedForm = this.submitForm();
				if(this.submittedForm) this.stop();
			}

			if(++this.attempt == 500){
				this.stop();
				this.attemptStatus.innerHTML = 'Stopped';
				this.attemptStatus.style.color='red';
			} else {
				this.attemptStatus.style.color='green';
				this.attemptStatus.style.backgroundColor = 'white';
				this.attemptStatus.innerHTML = `Attempt ${this.attempt}`;
			}
		}

		stop(){ clearInterval(this.intervalId); }

		selectShow(){ // return null if unsuccessful
			const divs = [...document.querySelectorAll('div[aria-label]')];
			const div = divs.find(div=>(div.getAttribute('aria-label')||'').includes(this.show));
			if(div == undefined){
				const ariaLabels = divs.map(d=>d.getAttribute('aria-label')).join(',')
				// console.debug(`No match in ${divs.length} div[aria-label]s: [${ariaLabels}] for show [${this.show}]`);
				this.showStatus.fail(`No div[aria-label] match in ${divs.length} divs`);

				// After N second reload the page.
				const now = new Date().valueOf();
				if( this.startMonitorTime + 2 * SEC < now )
					location.reload(true);
				return;
			}

			try{ div.click(); }catch(err){}
			this.showStatus.pass(`Show selected.`);
			return true;
		}

		// Fills in the Form Text + triggers 
		// Triggers validatio nvia events
		setTextValue(sub,value,status){
			try{
				const matches = this.inputs.filter(i=>elementIs(i,sub) );
				if(matches.length != 1){
					status.fail(`'${sub}': ${matches.length} matches`);
					return false;
				}
				const match = matches[0];
				match.value = value;
				match.dispatchEvent(new Event('change'));
				match.dispatchEvent(new Event('blur'));

				status.pass(`${sub} set.`);
				return true;
			}
			catch(ex){
				console.error('setTextValue',ex);
			}
		}

		// GroupSize - Part 1
		// Open Group-Size dropdown and clicks groups size
		// once it thinks it has succeeded, it stops trying - gives user the ability to intercede
		setGroupSize(size,status){
			try{
				const groupSizeDiv = this.getGroupSizeDiv(status);
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
				const index = size-1; // assuming size=1 is in index=0
				if(!(index < options.length)){
					status.fail(`Too few Grp-Size Options: ${options.length}`);
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
		validateGroupSize(size,status){
			try{
				const groupSizeDiv = this.getGroupSizeDiv(status);
				if(groupSizeDiv == null) return false;

				// check if it was set
				const btns = [...groupSizeDiv.querySelectorAll('button')];
				const changed = btns.length==2 && btns[0].innerHTML == size;
				if(changed)
					status.pass("Grp-Size Set");
				else 
					status.fail("Grp-Size NOT Set");
				return changed;
			}
			catch(er){
				console.error('setGroupSize',er);
			}

		}

		getGroupSizeDiv(status){
			const groupSizeDiv = document.querySelector('div.group-size div.group-size-dropdown');
			if(groupSizeDiv ==null)
				status.fail('group-size-dropdown not found.');
			return groupSizeDiv;
		}

		bookEvent(status){
			// const btn = document.querySelector('button.btn-book-event'); // old
			const btn = document.querySelector('button.btn-complete'); // new
			if(btn == null){
				status.fail('Book-Event btn not found');
				return false;
			}
			if(btn.click) btn.click();
			if(btn.triggerHandler) btn.triggerHandler('click');
			status.pass('Book-Event clicked');
			return true;
		}

		checkPrivacyAgreement(status){
			try{
				const checkBox = document.querySelector('#privacy-agreement');
				if(checkBox == null){
					status.fail('privacy-agreement cb not found.');
					return false;
				}
				checkBox.checked = true;
				checkBox.dispatchEvent(new Event('change'));
				checkBox.dispatchEvent(new Event('click'));
				status.pass('checked privacy-agreement');
				return true;
			}
			catch(ex){
				console.error('checkPrivacyAgreement',ex);
				status.fail('CB exception.');
			}
			return false;
		}

		submitForm(){

			const submitButton = document.querySelector('div.details button.btn-book-event');
			if(submitButton == null){
				this.submitStatus.fail('no submit found');
				return;
			}
			if( submitButton.disabled ){
				this.submitStatus.fail('submit is disabled');
				return false;
			}

			const now = new Date().toString();
			console.print(`submitting at ${now}`);
			this.submitStatus.pass(`submitting... at ${now}`);
			submitButton.click();
			return true;
		}
	}

	function elementIs(el,type){
		const combined = (el.name||'') + (el.id||'');
		return combined.toLowerCase().includes(type);
	}

	function getNextThursday10Am(){
		const date = new Date();
		const daysFromNow = ((7+4)-date.getDay())%7;
		const targetDate = new Date(date.valueOf() + daysFromNow * DAYS);
		const yyyy = targetDate.getFullYear(), mm = targetDate.getMonth(), dd = targetDate.getDate();
		return new Date(yyyy,mm,dd,10,0,2,0); // 2 second delay, 1 second was too fast (my clock is ahead by 582ms per https://time.gov)
	}
	const nextThursdayGoTime = getNextThursday10Am();

	const liveShow = "LIVE SHOW"; // LIVE SHOW STANDBY - Saturday Night Live
	const dressRehearsal = "DRESS REHEARSAL"; // DRESS REHEARSAL STANDBY - Saturday Night Live

	// =================
	// :: CONFIGS
	// =================

	const refreshStrategy = new RefreshStrategy({
		pre: [60*MIN,45*MIN,30*MIN,15*MIN,5*MIN,2*MIN,1*MIN,20*SEC,5*SEC,0],
		target: nextThursdayGoTime,
		postInterval: 2*SEC,
		postRetryPeriod: 2*MIN
	});

	const kevinConfig = { refreshStrategy,
		show:liveShow,
		formValues: {
			firstName:'Kevin',
			lastName:'Rettig',
			email:'krettig@gmail.com',
			phone:'9372419474',
			groupSize: 3
		}
	};

	const karenConfig = { refreshStrategy,
		show:liveShow, // liveShow  dressRehearsal
		formValues: {
			firstName:'Karen',
			lastName:'Gardinsky',
			email:'kgardinsky@gmail.com',
			phone:'740-255-0887',
			groupSize: 3
		}
	};

	const chrisConfig = { refreshStrategy,
		show:liveShow, // liveShow  dressRehearsal
		formValues: {
			firstName:'Christopher',
			lastName:'Rettig',
			email:'rettigcd@gmail.com',
			phone:'513-470-0774',
			groupSize: 2
		}
	};

	const deanConfig = { refreshStrategy,
		show:dressRehearsal, // liveShow  dressRehearsal
		formValues: {
			firstName:'Dean',
			lastName:'Rettig',
			email:'dean.rettig@infernored.com',
			phone:'513-338-7390',
			groupSize: 2
		}
	};

	const testConfig = { 
		// for testing, use a new Refresh strategy with custom target
		refreshStrategy: new RefreshStrategy({
			pre: [60*MIN,45*MIN,30*MIN,15*MIN,5*MIN,2*MIN,1*MIN,20*SEC,5*SEC,0],
			target: nextThursdayGoTime.valueOf() + 3*MIN < new Date().valueOf()  // if(after go-time)
				? new Date(new Date().valueOf() + 1 * MIN )  // add 1 minute
				: nextThursdayGoTime, // go-time
			postInterval: 2*SEC,
			postRetryPeriod: 2*MIN
		}),
		show:dressRehearsal, 
		formValues: {
			firstName:'Christopher',
			lastName:'Rettig',
			email:'rettigcd@gmail.com',
			phone:'513-470-0774',
			groupSize: 2
		}
	};

	const configs = {
		test : testConfig,
		dean : deanConfig,
		kevin : kevinConfig,
		karen : karenConfig,
		chris : chrisConfig
	};

	const configKey = localStorage.curConfig || 'test';

	const config = configs[configKey];
	console.print(`Using Config: %c[${configKey}] for [${config.show}]`,'background-color:#AAF;font-size:16px;')
	console.print(JSON.stringify(config.formValues,null,'\t'))
	console.print(`Go time: %c${config.refreshStrategy.target.toDateString()} ${config.refreshStrategy.target.toLocaleString()}`,'background-color:#AAF;')

	if( new Date().valueOf() < config.refreshStrategy.target.valueOf() ){
		config.refreshStrategy.scheduleNext();
	} else {
		const page = new SubmitPage( config );
		page.monitor();
	}

	queueMicrotask (console.debug.bind (console, '%cSNL Standby - loaded','background-color:#DFD;')); // Last line of file

})();

/*

===  TODO / TOFIX  ===

* Display Form Fields in top
* Make it easier to change configurations. // Drop down?
* Don't click Book-Event unless the GroupSize is correct.
* if checkbox btn not found, console.log( all checboxes.outerHTML )

===  Example html  ===

<button 
	class="btn btn-info btn-book-event pull-right btn-focus" 
	ng-click="$ctrl.onBookEvent(attendee)" 
	ng-disabled="attendee.groupSize > $ctrl.booking.event.slotsAvailable" 
	ng-show="$ctrl.booking.event.slotsAvailable > 0" 
	analytics-on="click" 
	tabindex="1" 
	analytics-event="Book Event Button Event Details" 
	analytics-label="Event Booking: book event button" 
	role="button" 
	aria-labelledby="book-event-label">
	<span translate="" id="book-event-label"><span class="ng-scope">Book Standby Reservation</span></span>
</button>
<input id="privacy-agreement" type="checkbox" ng-click="$ctrl.togglePrivacy()" ng-model="$ctrl.privacyAgreed" aria-checked="$ctrl.privacyAgreed" aria-required="true" aria-label="I confirm and acknowledge. " required="" name="I confirm and acknowledge. " role="button" class="ng-dirty ng-valid-parse ng-not-empty ng-valid ng-valid-required ng-touched">

NOTES
	tried 1 second after, didn't work, wait 2 seconds
	If we should find forms but can't (all read) for 2 seconds, reload
	Took me some time to relize page didn't load.

	Log the entire DOCUMENT when the submit button isn't found so we can figure out why.

	Record video at bottom of screen so we can see "Done" or "Submit" button

*/