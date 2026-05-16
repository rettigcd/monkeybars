// ==UserScript==
// @name         Laundry Tracker
// @namespace    http://tampermonkey.net/
// @version      2024-09-10
// @description  Record what driers/washers are available and when
// @author       Dean Rettig
// @run-at       document-start
// @match        https://www.laundryview.com/home/*/*/*/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=laundryview.com
// @require      file://C:/[monkeybarsFolder]/laundry.user.js
// @grant        GM_setClipboard
// @grant        unsafeWindow
// ==/UserScript==

import { con } from "~/lib/console";
import { makeNewXMLHttpRequest, type SnoopedWindow, type SnoopHandler, SnoopRequest } from "~/lib/snoop";
import { LocalStorageRepository } from "./local-storage";
import { MyLocation } from "./location";
import { Machine } from "./machine";
import { Reporter } from "./reporter";
import { Ts } from "./timestamp";
import type { Mach, Row, StackedMachines } from "./types";

declare const unsafeWindow: SnoopedWindow 
	& {
		repo?: LocalStorageRepository;
		reports?: Reporter;
		// cmd?: unknown;
		// snooper?: unknown;
	}


(function() {
	'use strict';

	// Javascript stores time in milliseconds (since Jan 1, 1970)
	// but we want to use Unix time which is seconds (since Jan 1, 1970)
	const SECONDS = 1, MINUTES = 60 * SECONDS;

	// ======================
	// Sends all 'XMLHttpRequest' requests to the requestHandlers[] functions
	// This bit is generic and can be used on any web page to snoop on requests.
	// ======================
	const requestHandlers: SnoopHandler[] = [];
	makeNewXMLHttpRequest(unsafeWindow as SnoopedWindow, requestHandlers);

	// Monitors data coming back from server, finds machines, and saves them to the repository.
	// (the main work horse)
	class MachineSnooper {

		private readonly repo: LocalStorageRepository;
		private readonly saveTotals: boolean;
		private interval: number = 60 * MINUTES;

		constructor({repository,saveTotals}:{repository:LocalStorageRepository,saveTotals:boolean|undefined}){
			this.repo = repository;
			this.saveTotals = saveTotals || false;
		}

		start(interval:number = 15 * MINUTES){ // 15 minutes is the default if user doesn't enter any interval
			this.interval = interval;

			// add this class's main snooping method to the requestHandlers
			requestHandlers.push( (x)=>this.snoop(x) ); // start logging
		}

		snoop({url,responseText}:SnoopRequest){
			try{
				let data = JSON.parse(responseText);

				const {objects} = data; // extract list of objects
				if(objects === undefined){ return; } // no machines/objects in this request

				const status = this.getMachinesFromObjs(objects);
				// console.log(status);
				this.saveMachines(status);
			}
			catch(err){
				console.error('error showing machine availability',err,url,responseText);
			}
		}

		getMachinesFromObjs(objects:StackedMachines[]): Mach[] {
			const machines: Mach[] = [];

			for(let machine of objects){
				const {stacked,appliance_type,
					   appliance_desc,time_left_lite, // appliance 1 fields
					   appliance_desc2,time_left_lite2 // appliance 2 fields
					  } = machine;
				if(stacked === undefined) continue; // not a washer or dryer

				machines.push( {type:appliance_type, name:appliance_desc, status:time_left_lite}); // app 1

				if( stacked )
					machines.push( {type:appliance_type, name:appliance_desc2, status:time_left_lite2}); // app 2
			}

			return machines
				.sort((a,b)=>a.name<b.name?-1:1); // sorted by name
		}

		saveMachines(machines:Mach[]){
			const savedData: Row[] = this.repo.load();
			// con.print('Retrieving saved data', savedData);

			// Check the time interval
			if(this.isTimeToSaveAnotherRow(savedData)){

				// Add new row to array
				const now = Ts.now();
				const row: Row = {ts:now, machines}; // 'ts' stands for timestamp.
				if( this.saveTotals )
					row.totals = Machine.calcTotals(machines);
				savedData.push(row);

				// save it for later
				this.repo.save( savedData );

				con.print(`%cStatus for ${machines.length} machines saved at ${new Date().toLocaleString()}`,'color:green;font-weight:bold;font-size:16px;');
			}
		}

		isTimeToSaveAnotherRow(savedData: Row[]){
			if(savedData.length == 0) return true; // no items, go ahead and save first item

			const now = Ts.now();
			const previousTimestamp = savedData[savedData.length-1].ts;
			const earliestTimeWeCanLogNext = previousTimestamp + this.interval;
			if( earliestTimeWeCanLogNext <= now ) return true; // time is after the earliest we can save

			// con.print('Now is too early. Don\'t log anything.', now, earliestTimeWeCanLogNext );
			return false;
		}

	} // end of class MachineSnooper

	// Set everything up.
	const loc = new MyLocation();
	console.log(`%cWelcome to ${loc.toString()}.`,'color:green');
	const repository = new LocalStorageRepository(loc.roomId);
	const snooper = new MachineSnooper({repository,saveTotals:false});
	const reports = new Reporter(repository);
	snooper.start( 10 * MINUTES );

	// make reports and repo accessible in the console window
	unsafeWindow.repo = repository;
	unsafeWindow.reports = reports;

	// Tell the user how to invoke the repo and reports.
	repository.help();
	reports.help();

})();