// Synchronizes dictionary to localStorage at regular interval
// Makes updates immediately, then periodically flushes updates by: loading, reapplies updates, saving
class SyncedPersistentDict{
	constructor(storageKey,newValueGenerator=()=>({})){
		let dict = null;
		const updaters=[];
		function load(){ if(dict==null) dict = JSON.parse(localStorage[storageKey]||"{}"); }
		function updateDict(dictUpdater){ load(); dictUpdater(dict); updaters.push(dictUpdater); }
		function save(){ localStorage[storageKey] = '{\r\n'+Object.entries(dict).sort((a,b)=>a[0]<b[0]?-1:1).map(a=>a.map(JSON.stringify).join(':')).join(',\r\n')+'\r\n}'; }
		function sync(){ dict=null; if(updaters.length>0) { load(); updaters.forEach(u=>u(dict)); console.print(updaters.length+' updates saved to '+storageKey); updaters.length=0; save(); } }
		setInterval( sync, 30000); window.addEventListener('beforeunload', sync, false);
		// read function
		this.keys = function(){ load(); return Object.keys(dict); }
		this.values = function(){ load(); return Object.values(dict); }
		this.entries = function(){ load(); return Object.entries(dict); }
		this.containsKey = function(key) { load(); return dict.hasOwnProperty(key); }
		this.get = function(key) { load(); return dict.hasOwnProperty(key) ? dict[key] : newValueGenerator(); }
		// Update functions
		this.rename = function(oldKey,newKey){ updateDict( d=>{ if(oldKey in d) { d[newKey]=d[oldKey]; delete d[oldKey]; console.log(`Renamed [${oldKey}] to [${newKey}]`) }  else console.log(`${oldKey} not found.`); } ); }
		this.remove = function(key){ updateDict(d=>delete d[key]); }
		this.update = function(key,updater){ updateDict( d => {if(!d[key]) d[key]=newValueGenerator(); updater(d[key]); } ) }
		this.sync = sync;
	}
}


function CachedPersistentArray(key,glue){
	glue = glue || '\r\n';
	let init = localStorage[key], items = init && init.split(glue) || [];
	function save(){ localStorage[key] = items.join(glue); }
	this.remove = function(item){ items = items.filter(x=>x!=item); save(); }
	this.includes = (needle)=>items.includes(needle);
	this.add = function(item){ if(!items.includes(item)) { items.push(item); items.sort(); save(); } }
}

queueMicrotask (console.log.bind (console, '%cstorage.js loaded','background-color:#DFD')); // Last line of file