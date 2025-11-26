
// adds .listen() to the host
class Observable {
	constructor(host){
		this.host = host;
		this.listeners = {}
		const {listeners} = this;
		host.listen = function (prop,callback){
			if(prop in listeners) 
				listeners[prop].push(callback);
			else
				listeners[prop] = [callback];
		}
	}
	// defines observable properties on the host that trigger the .listen handlers
	define(prop,initialValue){
		const field = "_"+prop;
		const {host,listeners} = this;
		host[field] = initialValue;
		Object.defineProperty(host, prop, { 
			"get": () => host[field], 
			"set": (newValue) => {
				const oldValue = host[field];
				if(oldValue===newValue) return;
				host[field] = newValue;
				if(!(prop in listeners)) return;
				const params = {prop,host,oldValue,newValue};
				if(!(prop in params)) params[prop] = newValue; // also store new value under its name, unless it is already used: prop,host,oldValue,newvalue
				for(const listener of listeners[prop])
					listener(params);
			}
		});
		return this;
	}
}

// Enables events by adding to the host:
// 		.on(eventName,handler) 
// 		.trigger(eventname) 
// to the host
// Example:
// host.on('click',(v)=>alert(v));
// host.trigger('click','hello');
class HasEvents{
	constructor(host){
		let dict={};
		host.on = function(key,handler){
			if(handler===undefined) throw new Error("Handler is undefined for event "+key);
			if(key in dict) dict[key].push(handler); 
			else dict[key]=[handler];
			return this;
		}
		host.trigger = function(key,arg){
			if(key in dict)
				dict[key].forEach(h=>h(arg));
		}
	}
}

queueMicrotask (console.log.bind (console, '%cobservable.js loaded','background-color:#DFD'));