// === Snooping on HTTP Requests ===

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

// Generates GUID-IDs for HTTP requests above
function uuidv4() {
	return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
		(c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
	);
}

// Snooping on fetch
function makeNewFetch(origFetch,loadHandlers,interceptor){
	return function(url,options){
		// !!! 1st parameter can be any of these: string, URL, Request
		const fakeResponse = interceptor(url,options);
		if(fakeResponse!==undefined) return fakeResponse;
		const timestamp = new Date().valueOf();
		const promise = origFetch(url,options);
		if(loadHandlers.length)
			promise
				.then( response => response.clone().text() )
				.then( responseText => {
					const {method,body,headers} = options || {};
					const record = new SnoopRequest({method,url:new URL(url,unsafeWindow.location),body,headers,responseText,timestamp,func:'fetch'})
					loadHandlers.forEach(function(callback){
						try{ callback( record ); } catch( err ){ console.error(err); }
					});
				} );
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
			const refUrl = new URL(unsafeWindow.location.href);
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


class RequestSnooper{
	constructor(config){
		const {fetchInterceptor} = config||{};
		unsafeWindow.XMLHttpRequest = makeNewXMLHttpRequest(unsafeWindow.XMLHttpRequest,this._loadHandlers);
		unsafeWindow.fetch = makeNewFetch(unsafeWindow.fetch,this._loadHandlers,fetchInterceptor || (()=>undefined) );
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
