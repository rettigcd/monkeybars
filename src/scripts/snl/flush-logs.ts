import { con } from "~/utils/console";
import { RequestSnooper } from "~/utils/snoop";
import { TimeStampConsoleLogger } from "./logging";

type LogType = {timestamp:number};

// Get current log items
function dateTimeStr(d=new Date()){ 
	function pad(x:number){ return (x<10?'0':'')+x;} 
	return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds());
}

const logPrefix = "savedLog:";

export function downloadLogsOnUnload(prefix:string,snooper:RequestSnooper,logger:TimeStampConsoleLogger): void {


	function getCurrentLogItems() : LogType[] {
		return snooper._loadLog.map(x=>x.toJSON() as LogType)
			.concat(logger.entries as LogType[])
	}

	function saveToLocalStorage(text: string): void {
		const key = `${logPrefix}${prefix}:${Date.now()}`;
		localStorage.setItem(key, text);
	}

	function clearCurrentLogs(){
		snooper._loadLog.length=0;
		logger.entries.length=0;
	}

	// flushes the Snooper and TimeStamp logs.
	// stores them in localStorage.
	function transferLogsToLocalStorage(){

		// Combine items
		const items = getCurrentLogItems();
		if(!items.length){ con.print('No log items to transfer to localStorage.'); return;}

		saveToLocalStorage(JSON.stringify(items));
		clearCurrentLogs();

		// clear localstorage
		con.print(`Saved ${items.length} log items to localStorage at ${new Date().toLocaleTimeString()}.`);

	}

	setInterval(transferLogsToLocalStorage, 30_000);

	// Copy to LocalStorage
	document.addEventListener('visibilitychange', () => {
		if(document.visibilityState === "hidden") 
			transferLogsToLocalStorage(); 
		}
	);

	function flushLocalStorageLogsToFile(prefix: string): void {
		const allLogs: LogType[] = [];
		for (const key of Object.keys(localStorage)) {
			if (!key.startsWith(logPrefix)) continue;

			const text = localStorage.getItem(key);
			if (text == null) continue;

			try{
				const items = JSON.parse(text) as LogType[];
				allLogs.push(...items);
				localStorage.removeItem(key);
			} catch (err) {
				console.error("Failed to parse saved log" , key, err);
			}
		}

		if (!allLogs.length)
			return;

		const prettyLogs = allLogs
			.sort((a,b)=>a.timestamp-b.timestamp)
			.map(x => ({time:new Date(x.timestamp).toLocaleTimeString(),...x}));
		const text = JSON.stringify(prettyLogs, null, '\t');

		if (text.length > 1_000_000)
			console.warn(` Writing large log chunk. (${text.length} bytes)`);

		saveTextToFile({ 
			text, 
			filename: `${prefix} ${dateTimeStr()}.txt`
		});
	}

	function saveTextToFile({text,filename} : {text:string,filename:string}){
		const url = URL.createObjectURL(new Blob([text])); // old way that doesn't handle '#' a.href = "data:text,"+text;
		const a = document.createElement("a");
		a.href = url
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Don't try to do this while the we are trying to fill out the form.
	setTimeout(() => { flushLocalStorageLogsToFile(prefix); }, 16_000);

}
