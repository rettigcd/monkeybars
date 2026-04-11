// === Snooping on HTTP Requests ===

// Created at the time a (snooped-on) response comes back.
// Encapsulates: (a) the request & (b) the response.
class SnoopRequest{
	constructor({method,url,body,responseText,headers,timestamp,func}){
		const readonly = {url,responseText,body,method,func,headers,timestamp,duration:new Date().valueOf()-timestamp};
		for(let prop in readonly)
			Object.defineProperty(this,prop,{value:readonly[prop]});
	}
	toJSON(){
		const {url,responseText,method,timestamp,duration,headers,body} = this;
		const result = {timestamp,method,url:url.toString(),responseText,duration};
		if(headers) result.headers=headers;
		if(body) result.body=body;
		return result;
	}
	get data(){ return JSON.parse( this.responseText ); }
}

// Replaces fetch with one that sends SnoopRequests to the loadHandlers
function makeNewFetch(myWindow,loadHandlers,interceptor){
	const origFetch = myWindow.fetch;
	myWindow.fetch = function(...args){
		const [p0,options] = args;
		const url = p0 instanceof Request ? p0.url : p0;

		// !!! 1st parameter can be any of these: string, URL, Request
		const fakeResponse = interceptor(url,options);
		if(fakeResponse!==undefined) return fakeResponse;
		const timestamp = new Date().valueOf();
		const promise = origFetch(...args);
		if(loadHandlers.length)
			promise
				.then( response => response.clone().text() )
				.then( responseText => {
					const {method,body,headers} = options || {};
					const record = new SnoopRequest({method,url:new URL(url,myWindow.location),body,headers,responseText,timestamp,func:'fetch'})
					loadHandlers.forEach(function(callback){
						try{ callback( record ); } catch( err ){ console.error(err); }
					});
				} );
		return promise;
	}
}

// Replaces XMLHttpRequest with one that sends Snoop results to the loadHandlers
function makeNewXMLHttpRequest(myWindow,loadHandlers){
	const origConstructor = myWindow.XMLHttpRequest;
	myWindow.XMLHttpRequest = function(){ // replacement constructor that captures results
		let xhr = new origConstructor(); // create the real/original one

		const origOpen = xhr.open; // capture so we can replace it and then call it.
		xhr.open = function(){ // XMLHttpRequest.open(method, url[, async[, user[, password]]])
			xhr._openArgs = arguments;
			xhr._timestamp = new Date().valueOf();
				return origOpen.apply(xhr,arguments);
		};

		const origSend = xhr.send; // capture so we can replace it and then call it.
		xhr.send = function(body){ // XMLHttpRequest.open(method, url[, async[, user[, password]]])
			xhr._sendBody = body;
				return origSend.call(xhr,body);
		};

		// xhr.setRequestHeader('Authorization', 'Bearer your_api_key');
		const origSetHeader = xhr.setRequestHeader;
		xhr.setRequestHeader = function(key,value){
			(origSetHeader.bind(xhr))(key, value);
			if(!('_headers' in xhr)) xhr._headers = {}
			xhr._headers[key] = value;
		}

		xhr.addEventListener('load', ()=>{
			const {responseType,_openArgs:[method,url,sync,user,pw],_sendBody:body,_headers:headers,_timestamp:timestamp} = xhr;
			const responseText = (responseType=='' || responseType=='text') ? xhr.responseText : `[responseType:${responseType}]`;
			const refUrl = new URL(myWindow.location.href);
			const urlObj = new URL(url,refUrl);
			const record = new SnoopRequest({method,url:urlObj,body,responseText,headers,timestamp,func:'XMLHttpRequest'});
			loadHandlers.forEach(function(callback){
				try{ callback( record ); } catch( err ){ console.error(err); }
			});
		});

		return xhr;
	}

}

// Snooping on Websocket
function makeNewWebSocket(origConstructor,loadHandlers){
	return function(){ // replacement constructor that captures results
		let socket = new origConstructor(...arguments); // create the real/original one

		// onopen onmessage send(body)
		const handler = {
			get(target, prop, receiver) {
				console.log('socket-get',prop);
				if (typeof target[prop] === 'function') {
					return function(...args) {
					  console.log(`Intercepted method call: ${prop}(${args.join(', ')})`);
					  return target[prop].apply(this, args);
					};
				  }
				  return Reflect.get(target, prop, receiver);
			},
			set(obj, prop, value) {
				const knownProps = ['binaryType'];
				if(!knownProps.includes(prop))
					console.log('socket-set',prop,value);
				return Reflect.set(...arguments);
			}
		};

		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
		return new Proxy(socket,handler);
		
	}
}

// Hub that manages snoopers and their handlers.
class RequestSnooper{
	constructor(myWindow,config){
		const {fetchInterceptor} = config||{};
		makeNewXMLHttpRequest(myWindow,this._loadHandlers);
		makeNewFetch(myWindow,this._loadHandlers,fetchInterceptor || (()=>undefined) );
	}
	addHandler(method,runOld=true){
		if(runOld)
			this._runHandlerOnOldRequests(method);
		this._loadHandlers.push(method);
		return this;
	}
	logRequests(predicate=()=>true){
		this._loadHandlers.push((x)=>{
			if(!predicate(x)) return;
			Object.defineProperty(x,'idx',{value:this._loadLog.length});
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
