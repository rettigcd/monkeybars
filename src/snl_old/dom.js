function newEl(x){ 
	return Object.assign(typeof x == "string" ? document.createElement(x) : x,{
		chain: function(action){ action(this); return this; },
		css: function(style){ Object.assign(this.style,style); return this; },
		setText: function(text){ this.innerText = text; return this; },
		appendTo: function(host){ host.appendChild(this); return this; },
		attr: function(name,val){ this.setAttribute(name,val); return this; },
		addClass: function(className){ this.classList.add(className); return this; },
		on: function(eventName,handler){ this.addEventListener(eventName,handler); return this;},
	});
}

function newInput(type='text'){ return newEl('input').attr('type',type); }

function newOption(text,value){ return Object.assign( document.createElement('option'), {text,value:value!==undefined?value:text}); }

function newSelect(x="select"){
	return Object.assign(newEl(x),{
		addOption: function(o){ this.add(o); return this; },
		removeOption: function(o){ this.remove(o); return this; },
	});
}

function addStyleSheet(css){
	newEl('style').attr('type','text/css').chain(x=>x.appendChild(document.createTextNode(css))).appendTo(document.getElementsByTagName('head')[0]);
}

queueMicrotask (console.log.bind (console, '%cdom.js loaded','background-color:#DFD'));

/*
class El {
	constructor(x){ this.el = typeof x == "string" ? document.createElement(x) : x; }
	css(style){ Object.assign(this.el.style,style); return this; }
	text(text){ this.el.innerText = text; return this; }
	appendTo(host){ host.appendChild(this.el); return this; }
	attr(name,val){ this.el.setAttribute(name,val); return this; }
	addClass(className){ this.el.classList.add(className); return this; }
	on(eventName,handler){ this.el.addEventListener(eventName,handler); return this;}
}

class OptionEl extends El { constructor(text){ super('option'); this.txt(text); } }

class InputEl extends El { 
	constructor(type='text'){ 
		super('input'); 
		this.attr('type',type);
	}
	bind(host,prop){
		const input = this.el;
		input.value = host[prop];
		this.on('input',()=> host[prop]=input.value );
		host.listen(prop,({newValue})=>{ if(input.value != newValue) input.value = newValue; });
		return this;
	}
}

class CheckboxEl extends InputEl {
	constructor(){super('checkbox');}
	bind(host,prop){
		const cb = this.el;
		cb.checked = host[prop];
		this.on('click',()=> host[prop]=cb.checked );
		host.listen(prop,({newValue})=>{ if(cb.checked != newValue) cb.checked = newValue; });
		return this;
	}
}

class SelectEl extends El { 
	constructor(){ super('select'); this._options={};}
	addTextOption(optText){ const o = new OptionEl(optText).el; this._options[optText]=o; this.el.add(o); return this; }
	addTextOptions(optTextArr){ optTextArr.forEach( text=>this.addTextOption(text) ); return this; }
	removeTextOption(optText){ const o = this._options[optText]; this.el.remove(o.index); delete this._options[optText]; return this; }

	// Binds the options to an Observable property containing array of strings
	bindOptions(host,prop){
		// assuming it is empty, we don't have to pre-remove anything
		this.addTextOptions(host[prop]);
		host.listen(prop,({oldValue,newValue})=>{
			for(let o of oldValue) if(!newValue.includes(o)) this.removeTextOption(o);
			for(let n of newValue) if(!oldValue.includes(n)) this.addTextOption(n);
		});
		return this;
	}

	bind(host,prop){
		const select = this.el;
		select.value = host[prop];
		this.on('change',()=>host[prop]=select.value );
		host.listen(prop,({newValue})=>{ 
			if(select.value != newValue) select.value = newValue; 
		});
		return this;
	}
}
*/