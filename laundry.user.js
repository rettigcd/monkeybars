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

(function() {
    'use strict';

    // Javascript stores time in milliseconds (since Jan 1, 1970)
    // but we want to use Unix time which is seconds (since Jan 1, 1970)
    const SECONDS = 1, MINUTES = 60 * SECONDS, HOURS = 60 * MINUTES, DAYS = 24 * HOURS;
    const codeCss = 'color:red;font-family: monospace;';

    // console.print - same as console.log but without line #s
    console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

    // ======================
    // Sends all 'XMLHttpRequest' requests to the requestHandlers[] functions
    // This bit is generic and can be used on any web page to snoop on requests.
    // ======================
    const requestHandlers = [];
    unsafeWindow.XMLHttpRequest = function(origConstructor){

        return function(){ // replacement constructor that captures results
            let xhr = new origConstructor(); // create the real/original one

            // Give xhr a new .open() method that logs the input parameters
            const origOpen = xhr.open; // capture the real open method so we can replace it and then call it.
            xhr.open = function(){
                xhr._openArgs = arguments; // capture the calling arguments
                return origOpen.apply(xhr,arguments); // call the original open.Method
            };

            // Give xhr a new .send() method that logs the input parameters
            const origSend = xhr.send; // capture so we can replace it and then call it.
            xhr.send = function(body){ // XMLHttpRequest.open(method, url[, async[, user[, password]]])
                xhr._sendBody = body;  // capture the body arguments
                return origSend.call(xhr,body); // call original
            };

            // When the request is loaded, package up the: method, url, body, and responseText
            // and send it to the snooping methods stored in _loadHandlers[]
            xhr.addEventListener('load', ()=>{
                const {responseText,_openArgs:[method,url,sync,user,pw],_sendBody:body} = xhr;
                const refUrl = new URL(unsafeWindow.location.href);
                const urlObj = new URL(url,refUrl);
                requestHandlers.forEach(function(callback){
                    const record = {method,url:urlObj,body,responseText,func:'XMLHttpRequest'};
                    callback( record );
                });
            });

            return xhr;
        }

    }(unsafeWindow.XMLHttpRequest);

    // Monitors data coming back from server, finds machines, and saves them to the repository.
    // (the main work horse)
    class MachineSnooper {

        constructor({repository,saveTotals}){
            this.repo = repository;
            this.saveTotals = saveTotals || false;
        }

        start(interval = 15 * MINUTES){ // 15 minutes is the default if user doesn't enter any interval
            this.interval = interval;

            // add this class's main snooping method to the requestHandlers
            requestHandlers.push( (x)=>this.snoop(x) ); // start logging
        }

        snoop({url,responseText}){
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

        getMachinesFromObjs(objects){
            const machines = [];

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

        saveMachines(machines){
            const savedData = this.repo.load();
            // console.print('Retrieving saved data', savedData);

            // Check the time interval
            if(this.isTimeToSaveAnotherRow(savedData)){

                // Add new row to array
                const now = Ts.now();
                const row = {ts:now, machines}; // 'ts' stands for timestamp.
                if( this.saveTotals )
                    row.totals = Machine.calcTotals(machines);
                savedData.push(row);

                // save it for later
                this.repo.save( savedData );

                console.print(`%cStatus for ${machines.length} machines saved at ${new Date().toLocaleString()}`,'color:green;font-weight:bold;font-size:16px;');
            }
        }

        isTimeToSaveAnotherRow(savedData){
            if(savedData.length == 0) return true; // no items, go ahead and save first item

            const now = Ts.now();
            const previousTimestamp = savedData[savedData.length-1].ts;
            const earliestTimeWeCanLogNext = previousTimestamp + this.interval;
            if( earliestTimeWeCanLogNext <= now ) return true; // time is after the earliest we can save

            // console.print('Now is too early. Don\'t log anything.', now, earliestTimeWeCanLogNext );
            return false;
        }

    } // end of class MachineSnooper

    // A 'repository' is where items are saved and loaded from.
    // LocalStorage is where we are saving these items.
    class LocalStorageRepository{
        constructor(key){ this.key = key; }
        load(){ return JSON.parse(this.raw() || '[]'); }
        save(rows){ localStorage[this.key] = '[\r\n' + rows.map(JSON.stringify).join(",\r\n") + '\r\n]'; }
        clear(){
            if(prompt("Type the word 'clear' to clear all history.")=='clear')
                this.save([]);
            else
                console.log('Clear History - canceled.');
        }
        // this is not really a repository-like method
        copy(){ GM_setClipboard(this.raw(), "text", () => console.log("History saved to clipboard!")); }
        raw(){ return localStorage[this.key]; }
        help(){
            console.group('Repository');
            console.log( 'to view, type: %crepo.load()', codeCss );
            console.log( 'to clear, type: %crepo.clear()', codeCss );
            console.log( 'to copy to clipboard, type: %crepo.copy()', codeCss);
            console.groupEnd();
        }
    }

    class Machine{
        // 3 different format options.  Use the 1 you like best.

        // shows true for available, and false otherwise
        static format1({name,status,type}){ return `${name}(${type}):${status=='Available' }`; }

        // shows 'A' for available and '-' otherwise
        static format2({name,status,type}){ return `${name}(${type}):${status=='Available' ? "A" : "-" }`; }

        // just shows the status (I like this one)
        static format3({name,status,type}){ return `${name}(${type}):${status}`; }

        static calcTotals(machines){
            function calcTypeTotals(desiredType){
                const machOfType = machines.filter(({type})=>type==desiredType);
                const available = machOfType.filter(x=>x.status=='Available').length;
                const idle      = machOfType.filter(x=>x.status=="Idle").length;
                const oos       = machOfType.filter(x=>x.status=="Out of service").length;
                const inUse     = machOfType.length - available - idle - oos;
                return {available,idle,inUse, oos};
            }
            return {
                'D':calcTypeTotals('D'),
                'W':calcTypeTotals('W')
            };
        }
    }

    // Timestamp helper methods for timestamps stored in Unix time
    class Ts{
        static format(ts){ return new Date(ts*1000).toLocaleString(); }
        // returns Unix time which is seconds since Epoch (Jan 1, 1970)
        static now(){
            const msSinceEpoch = new Date().valueOf(); // Javascript uses milliSeconds since Epoch
            return Math.floor(msSinceEpoch/1000); // convert to seconds - this is Unix time.
        }
    }

    // generates machine reports by pulling rows out of the repository.
    class Reporter{
        constructor(repository){
            this.repo = repository;
        }
        // shows history for all machines
        machines(){
            const rows = this.repo.load();
            this._format_internal( rows );
        }
        available(){ this.totals("available"); }
        inUse(){     this.totals("inUse"); }
        idle(){      this.totals("idle"); }
        totals(status){
            const rows = this._getRowsWithTotals().map(function({ts,totals}){
                if(status != null){
                    const {D,W} = totals;
                    totals = {D:D[status],W:W[status]};
                }
                return Ts.format(ts) + " => " + JSON.stringify(totals);
            });
            console.print( rows.join("\r\n") );
        }
        _getRowsWithTotals(){
            return this.repo.load().map(function({ts,machines,totals}){
                return {ts,machines,totals:totals || Machine.calcTotals(machines)};
            });
        }
        // shows all time stamps
        timestamps(){
            const history = this.repo.load();
            const timestampStrings = history.map( ({ts}) => Ts.format(ts) );
            console.print( timestampStrings.join("\r\n") );
        }
        last(){
            const rows = this.repo.load();
            if(rows.length == 0){ console.log('no history'); return; }
            const {ts,machines} = rows[rows.length-1];
            console.print( Ts.format(ts) + " => \r\n" + machines.map(Machine.format3).join("\r\n") );
        }
        // shows history for a single machine
        machine(machineName){
            const history = this.repo.load();
            const rows = history.map( function({ts,machines}){
                machines = machines.filter(({name}) => name==machineName);
                return {ts,machines};
            } );
            this._format_internal( rows );
        }
        // used internally for showing history for 1 or all machines
        _format_internal(originalRows){
            const rows = originalRows.map( function({ts,machines}){
                return Ts.format(ts)+' => '+machines.map(Machine.format3).join(", ");
            });
            console.print( rows.join("\r\n") )
        }
        help(){
            console.group('Reports');
            console.log( 'all machines, type: %creports.machines()', codeCss );
            console.log( 'single machine (#3), type: %creports.machine(3)', codeCss );
            console.log( 'timestamps, type: %creports.timestamps()', codeCss );
            console.log( 'totals, type: %creports.totals()', codeCss );
            console.log( 'available, type: %creports.available()', codeCss );
            console.log( 'in use, type: %creports.inUse()', codeCss );
            console.log( 'last row, type: %creports.last()', codeCss );
            console.groupEnd();
        }
    }

    class Location {
        constructor(){
            const regEx = /laundryview.com\/home\/(\d+)\/(\d+)\/([^\/]+)\/([^\/]+)/;
            const [,propertyId,roomId,propertyName,roomName] = document.location.href.match(regEx);
            Object.assign(this,{ propertyId, roomId, propertyName, roomName });
        }
        toString(){ return `the ${loc.roomName}(${loc.roomId}) room at ${loc.propertyName}(${loc.propertyId})`; }
    }

    // Set everything up.
    const loc = new Location();
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