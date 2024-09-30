// -----------------------------------
// ---- Snooping on HTTP Requests ----
// -----------------------------------


class SnoopRequest{
	constructor({method,url,body,responseText,func}){
		const readonly = {url,responseText,body,method,func,id:uuidv4()};
		for(let prop in readonly)
			Object.defineProperty(this,prop,{value:readonly[prop]});
	}
	toJSON(){
		const {url,responseText,body} = this;
		const result = {url:url.toString(),responseText};
		if(body) result.body=body;
		return result;
	}
	get data(){ return JSON.parse( this.responseText ); }
}

// Generates GUID-IDs for HTTP requests above
function uuidv4() {
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

// Snooping on fetch
function makeNewFetch(origFetch,loadHandlers){
	return function(url,options){
		const promise = origFetch(url,options);
		const {method,body} = options || {};
		const urlObj = new URL(url,unsafeWindow.location);
		loadHandlers.forEach(function(callback){
			promise
				.then( response => response.clone().text() )
				.then( responseText => callback(new SnoopRequest({method,url:urlObj,body,responseText,func:'fetch'})) );
		});

		return promise;
	}
}

// Snooping on XMLHttpRequest
function makeNewXMLHttpRequest(origConstructor,loadHandlers){

	return function(){ // replacement constructor that captures results
		let xhr = new origConstructor(); // create the real/original one

		const origOpen = xhr.open; // capture so we can replace it and then call it.
		xhr.open = function(){ // XMLHttpRequest.open(method, url[, async[, user[, password]]])
			xhr._openArgs = arguments;
			return origOpen.apply(xhr,arguments);
		};

		const origSend = xhr.send; // capture so we can replace it and then call it.
		xhr.send = function(body){ // XMLHttpRequest.open(method, url[, async[, user[, password]]])
			xhr._sendBody = body;
			return origSend.call(xhr,body);
		};

		xhr.addEventListener('load', ()=>{
			const {responseText,_openArgs:[method,url,sync,user,pw],_sendBody:body} = xhr;
			const refUrl = new URL(unsafeWindow.location.href);
			const urlObj = new URL(url,refUrl);
			const record = new SnoopRequest({method,url:urlObj,body,responseText,func:'XMLHttpRequest'});
			loadHandlers.forEach(function(callback){
				callback( record );
			});
		});

		return xhr;
	}

}

class RequestSnooper{
	constructor(){
		unsafeWindow.XMLHttpRequest = makeNewXMLHttpRequest(unsafeWindow.XMLHttpRequest,this._loadHandlers);
		unsafeWindow.fetch = makeNewFetch(unsafeWindow.fetch,this._loadHandlers);
	}
	addHandler(method,runOld=true){
		if(runOld)
			this._runHandlerOnOldRequests(method);
		this._loadHandlers.push(method);
		return this;
	}
	enableLogging({ignoreUrls}){
		ignoreUrls = ignoreUrls || [];
		this._loadHandlers.push((x)=>{
			if(ignoreUrls.includes(x.url.toString()) ) return;
			Object.defineProperty(x,'idx',{value:this._loadLog.length});
			Object.defineProperty(x,'timestamp',{value:new Date()});
			this._loadLog.push(x);
		});
		return this; // chaining
	}
	_runHandlerOnOldRequests(method){
		for(const ex of this._loadLog) 
			method(ex);
	}
	_loadHandlers =[]; // array of: function({method,url,body,responseText}) => {/* doStuff(); */}
	_loadLog = []; // records every SnoopRequest made.
}

queueMicrotask (console.log.bind (console, '%csnoop.js loaded','background-color:#DFD')); // Last line of file