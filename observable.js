
// adds .listen() to the host
class Observable {
	constructor(host){
		this.host = host;
		this.listeners = Object.create(null);
		const {listeners} = this;
		host.listen = function (prop,callback){
			(listeners[prop] ??= []).push(callback);
			return () => listeners[prop] = listeners[prop].filter(x => x !== callback); // returns an un-listen function
		}
	}
	// defines observable properties on the host that trigger the .listen handlers
	define(prop,initialValue){
		const field = "_"+prop;
		const {host,listeners} = this;
		host[field] = initialValue;
		// TODO: don't store the raw value on the object, store it in a Map() or make it private
		Object.defineProperty(host, prop, { configurable: true, enumerable: true,
			"get": () => host[field], 
			"set": (newValue) => {
				const oldValue = host[field];
				if(oldValue===newValue) return;
				host[field] = newValue;
				if(!(prop in listeners)) return;
				const params = {prop,host,oldValue,newValue};
				if(!(prop in params)) params[prop] = newValue; // also store new value under its name, unless it is already used: prop,host,oldValue,newValue
				for(const listener of listeners[prop])
					listener(params);
			}
		});
		return this;
	}
}

//	Possible replacement for Observable.
//	const observablePerson = makeObservable( { name: "Bob" });
//	observablePerson.listen("name", ({ oldValue, newValue }) => { console.log(oldValue, "->", newValue); });
//	observablePerson.name = "Sue";
function makeObservable(target = {}) {
	const listeners = new Map();

	const proxy = new Proxy(target, {
		set(obj, prop, newValue) {
			const oldValue = obj[prop];
			if (Object.is(oldValue, newValue)) return true;

			obj[prop] = value;

			for (const listener of listeners.get(prop) ?? [])
				listener({ prop, host: proxy, oldValue, newValue, [prop]: newValue });

			return true;
		}
	});

	proxy.listen = (prop, callback) => {
		const list = listeners.get(prop) ?? [];
		list.push(callback);
		listeners.set(prop, list);
		return () => {
			const next = (listeners.get(prop) ?? []).filter(x => x !== callback);
			if (next.length) listeners.set(prop, next);
			else listeners.delete(prop);
		};
	};

	return proxy;
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
		let dict=Object.create(null); // no inheritied props from prototype
		host.on = function(key,handler){
			if(handler===undefined) throw new Error("Handler is undefined for event "+key);
			if(key in dict) dict[key].push(handler); 
			else dict[key]=[handler];
			return this;
		}
		host.trigger = function(key,...args){
			if(key in dict)
				dict[key].forEach(h=>h(...args));
		}
	}
}

queueMicrotask (console.log.bind (console, '%cobservable.js loaded','background-color:#DFD'));