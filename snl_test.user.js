// ==UserScript==
// @name         SNL Standby Line - TEST
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @require      file://C:/Users/rettigcd/Sync/Documents/grease monkey/snl.user.js
// @match        https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF*
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/choose
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18875
// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18876

(function(){

	unsafeWindow.t1 = function(){
		var divEl = document.createElement('div');
		document.body.appendChild(divEl);
		divEl.innerHTML = "<div ng-class=\"{ \'active\': active }\" ng-repeat=\"slide in $ctrl.slides\" ng-transclude=\"\" class=\"item text-center ng-scope ng-isolate-scope active\" uib-slide=\"\" index=\"slide.id\" style=\"padding-left: 15%; padding-right: 15%; width: 130%; margin-left: -15%;\">\r\n\r\n    <!-- ngRepeat: item in slide.events -->\r\n    <div class=\"col-xs-12 col-sm-6 col-md-4 col-lg-3 ng-scope\" ng-repeat=\"item in slide.events\" ng-click=\"$ctrl.onSelectEvent(item)\" tabindex=\"0\" ng-keypress=\"$event.keyCode == 13 ? $ctrl.onSelectEvent(item) : undefined\" analytics-on=\"click\" analytics-event=\"Select Event Thumbnail\" analytics-label=\"Event Booking: click\/select thumbnail event\" \r\n      role=\"button\" \r\n        aria-label=\"DRESS REHEARSAL STANDBY - Saturday Night Live\">\r\n\r\n      <div class=\"event-item\" analytics-on=\"click\" analytics-event=\"Select Item Event Thumbnail\" \r\n        analytics-label=\"Event Booking: event selected (DRESS REHEARSAL STANDBY - Saturday Night Live)\"\r\n        >\r\n\r\n        <!-- ngIf: item.imageURL -->\r\n          <img ng-if=\"item.imageURL\" ng-src=\"https:\/\/us.qudini.com\/api\/events\/event\/18875\/image.png\" alt=\"Event cover image\" class=\"ng-scope\" src=\"https:\/\/us.qudini.com\/api\/events\/event\/18875\/image.png\">\r\n        <!-- end ngIf: item.imageURL -->\r\n\r\n        <div class=\"slots-availability ng-binding ng-hide\" ng-show=\"item.showNumberOfSlots &amp;&amp; item.slotsAvailable > 0\">\r\n          0 <span translate=\"\"><span class=\"ng-scope\">Slots<\/span><\/span>\r\n          <span class=\"txt-available\" translate=\"\"><span class=\"ng-scope\">Available<\/span><\/span>\r\n        <\/div>\r\n        <div class=\"slots-availability\" ng-show=\"item.showNumberOfSlots &amp;&amp; item.slotsAvailable === 0\">\r\n          <span translate=\"\"><span class=\"ng-scope\">Fully booked<\/span><\/span>\r\n        <\/div>\r\n        <div class=\"details\">\r\n          <h3 class=\"name ellipsis ng-binding\" title=\"DRESS REHEARSAL STANDBY - Saturday Night Live\">DRESS REHEARSAL STANDBY - Saturday Night Live<\/h3>\r\n          <div class=\"event-date ellipsis\">\r\n            <p class=\"border-bottom ng-binding\">Friday, February 23, 2024 <\/p>\r\n          <\/div>\r\n          <div class=\"ellipsis\" ng-hide=\"item.isWebinar\">\r\n            <span ng-show=\"item.locationName\" class=\"ng-binding ng-hide\"> - 30 Rockefeller Plaza<\/span>\r\n            <span ng-show=\"!item.locationName\" class=\"ng-binding\">30 Rockefeller Plaza<\/span>\r\n          <\/div>\r\n          <div class=\"ellipsis ng-hide\" ng-show=\"item.isWebinar\">\r\n            <span style=\"text-transform: capitalize\" translate=\"\"><span class=\"ng-scope\">Webinar<\/span><\/span>\r\n          <\/div>\r\n          <p class=\"startTime\">\r\n            <span class=\"ng-binding\">6:00 PM<\/span>\r\n          <\/p>\r\n        <\/div>\r\n      <\/div>\r\n    <\/div>\r\n    <!-- end ngRepeat: item in slide.events -->\r\n\r\n    <div class=\"col-xs-12 col-sm-6 col-md-4 col-lg-3 ng-scope\" ng-repeat=\"item in slide.events\" ng-click=\"$ctrl.onSelectEvent(item)\" tabindex=\"0\" ng-keypress=\"$event.keyCode == 13 ? $ctrl.onSelectEvent(item) : undefined\" analytics-on=\"click\" analytics-event=\"Select Event Thumbnail\" analytics-label=\"Event Booking: click\/select thumbnail event\" \r\n      role=\"button\" aria-label=\"LIVE SHOW STANDBY - Saturday Night Live\">\r\n\r\n      <div class=\"event-item\" analytics-on=\"click\" analytics-event=\"Select Item Event Thumbnail\" analytics-label=\"Event Booking: event selected (LIVE SHOW STANDBY - Saturday Night Live)\">\r\n        <!-- ngIf: item.imageURL -->\r\n          <img ng-if=\"item.imageURL\" ng-src=\"https:\/\/us.qudini.com\/api\/events\/event\/18876\/image.png\" alt=\"Event cover image\" class=\"ng-scope\" src=\"https:\/\/us.qudini.com\/api\/events\/event\/18876\/image.png\">\r\n        <!-- end ngIf: item.imageURL -->\r\n        <div class=\"slots-availability ng-binding ng-hide\" ng-show=\"item.showNumberOfSlots &amp;&amp; item.slotsAvailable > 0\">\r\n          0 <span translate=\"\"><span class=\"ng-scope\">Slots<\/span><\/span>\r\n          <span class=\"txt-available\" translate=\"\"><span class=\"ng-scope\">Available<\/span><\/span>\r\n        <\/div>\r\n        <div class=\"slots-availability\" ng-show=\"item.showNumberOfSlots &amp;&amp; item.slotsAvailable === 0\">\r\n          <span translate=\"\"><span class=\"ng-scope\">Fully booked<\/span><\/span>\r\n        <\/div>\r\n        <div class=\"details\">\r\n          <h3 class=\"name ellipsis ng-binding\" title=\"LIVE SHOW STANDBY - Saturday Night Live\">LIVE SHOW STANDBY - Saturday Night Live<\/h3>\r\n          <div class=\"event-date ellipsis\">\r\n            <p class=\"border-bottom ng-binding\">Friday, February 23, 2024 <\/p>\r\n          <\/div>\r\n          <div class=\"ellipsis\" ng-hide=\"item.isWebinar\">\r\n            <span ng-show=\"item.locationName\" class=\"ng-binding ng-hide\"> - 30 Rockefeller Plaza<\/span>\r\n            <span ng-show=\"!item.locationName\" class=\"ng-binding\">30 Rockefeller Plaza<\/span>\r\n          <\/div>\r\n          <div class=\"ellipsis ng-hide\" ng-show=\"item.isWebinar\">\r\n            <span style=\"text-transform: capitalize\" translate=\"\"><span class=\"ng-scope\">Webinar<\/span><\/span>\r\n          <\/div>\r\n          <p class=\"startTime\">\r\n            <span class=\"ng-binding\">6:00 PM<\/span>\r\n          <\/p>\r\n        <\/div>\r\n      <\/div>\r\n    <\/div><!-- end ngRepeat: item in slide.events -->\r\n    \r\n  <\/div>";
	}

	unsafeWindow.t2 = function(){
		var divEl = document.createElement('div');
		document.body.appendChild(divEl);
		divEl.innerHTML = `
		
'<div class="group-size">
	<div class="group-size-dropdown">
		<button id="GGG">1</button>
		<button>na</button>

		<div class="group-size-dropdown">
			<ul class="dropdown-menu">
				<li><a href='#' onclick='document.getElementById("GGG").innerHTML="1";return false;'>1</a></li>
				<li><a href='#' onclick='document.getElementById("GGG").innerHTML="2";return false;'>2</a></li>
				<li><a href='#' onclick='document.getElementById("GGG").innerHTML="3";return false;'>3</a></li>
			</ul>
		</div>
	</div>

	<div class="details">
		<input class="sn-form-control" id="sn-formFirstName">
		<input class="sn-form-control" id="sn-formLastName">
		<input class="sn-form-control" id="sn-mobileNumber" >
		<input class="sn-form-control" id="sn-formEmail">
		<input id="sn-formMarketing" type="checkbox" checked="">
		<input type="checkbox" />
		<button id="submitme" class="btn-book-event" disabled="true" >dude!</button>
	</div>

</div>
`;
		const ids = "sn-formFirstName,sn-formLastName,sn-mobileNumber,sn-formEmail".split(',');
		const validated = {};
		for(const id of ids){
			document.getElementById(id).addEventListener("change", function(xx){
				validated[id] = true;
				// console.debug(`change detected for ${id}`, xx );
				document.getElementById('submitme').disabled = Object.keys(validated).length<ids.length;
			});
		}
	}

	console.debug('%cSNL Standby - TESTER','background-color:#DFD'); // Last line of file

})();




//==================
//    Choose
//==================

	class ChoosePage {
		constructor({refreshStrategy,show,targetPrefix}){
			this.pageRefresh = refreshStrategy;
			this.show = show;
			this.targetPrefix = targetPrefix;
			this.attemptStatus = create(); this.attemptStatus.style.backgroundColor='white';
			this.normStatus = create();
		}
		monitor(){
			console.debug('Monitoring: %cCHOOSE PAGE','background-color:#FF0');
			this.attempt = 0;
			this.intervalId = setInterval(this.onTick.bind(this),200);
		}

		onTick(){
			const url = this.findUrl();
			if(url != null){
				// stop scanning and Go THERE!
				clearInterval(this.intervalId);
				if(location.href != url)
					location.replace(url);
				else
					new SubmitPage( config ).monitor();
				return;
			}
			if( ++this.attempt == 5 )
				// keep scanning but schedule page refresh
				this.pageRefresh.scheduleNext();

			if( this.attempt == 50 )
				clearInterval(this.intervalId);

			this.attemptStatus.innerHTML = `Attempt ${this.attempt}`;
		}

		findUrl(){ // return null if unsuccessful
			return this.findNormal()
				|| this.findInShadowDom()
				|| this.findInIFrame();
		}

		findNormal(){
			// Scan normal
			const divs = [...document.querySelectorAll('div[aria-label]')];
			const div = divs.find(div=>(div.getAttribute('aria-label')||'').includes(this.show));
			if(div == undefined){
				const ariaLabels = divs.map(d=>d.getAttribute('aria-label')).join(',')
				// console.debug(`No match in ${divs.length} div[aria-label]s: [${ariaLabels}] for show [${this.show}]`);
				this.normStatus.innerHTML = `No div[aria-label] match in ${divs.length} divs`;
				this.normStatus.style.backgroundColor = 'red';
				return;
			}

			try{
				div.click();
			}catch(err){}

			div.style.backgroundColor = '#FF0'; // highlight it
			const imgs = [...div.querySelectorAll('img')];
			const img = imgs.find(img=>img.src.includes('/event/'));
			if(img == undefined){
				const srcs = imgs.map(i=>i.src).join(',')
				// console.log(`No match in ${src.length} imgs.src: [${srcs}] for /event/`);
				this.normStatus.innerHTML = `No match in ${src.length} imgs.src: [${srcs}] for /event/`;
				this.normStatus.style.backgroundColor = 'red';
				return;
			}
			const eventId = img.src.match(/(?<=\/event\/)\d+/);
			this.normStatus.innerHTML = `Found Event ${eventId}`;
			this.normStatus.style.backgroundColor = 'green';
			const url = this.targetPrefix + eventId;
			console.log(url)
			// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18876
			// https://bookings-us.qudini.com/booking-widget/events/B9KIOO7ZIQF#/event/18875
			return url;
		}

		findInShadowDom(){
		}

		findInIFrame(){
		}

	}
