(function(){

	const extend = (proto, methods, name = proto.constructor.name) => {
		for (const [prop, fn] of Object.entries(methods)) {
			if (prop in proto) throw new Error(`${name} already contains ${prop}`);
			Object.defineProperty(proto, prop, { value: fn, writable: true, configurable: true });
		}
	};
	
	extend(HTMLElement.prototype, {
		css(style) { Object.assign(this.style, style); return this; },
		txt(value) { if(arguments.length === 0) return this.textContent; this.textContent = value; return this; },
		html(value) { if(arguments.length === 0) return this.innerHTML; this.innerHTML = value; return this; },
		prop(name, value) { if(arguments.length === 1) return this[name]; this[name] = value; return this; },
		attr(name, value) { if(arguments.length === 1) return this.getAttribute(name); this.setAttribute(name, value); return this; },
		cls(...names) { this.classList.add(...names); return this; },
		addClass(name) { this.classList.add(name); return this; },
		removeClass(name) { this.classList.remove(name); return this; },
		toggleClass(name, force) { this.classList.toggle(name, force); return this; },
		data(key, value) { if(arguments.length === 1) return this.dataset[key]; this.dataset[key] = value; return this; },
		on(eventName, handler, options) { this.addEventListener(eventName, handler, options); return this; },
		off(eventName, handler, options) { this.removeEventListener(eventName, handler, options); return this; },
		appendTo(host) { host.appendChild(this); return this; },
		withChildren(...children) { this.append(...children.filter(x => x != null)); return this; },
		do(action) { action(this); return this; },
	});

	// What uses this?
	// extend(HTMLSelectElement.prototype, {
	// 	addOptions(items) {
	// 		for (const item of items)
	// 			this.add(typeof item === "string" ? new Option(item, item) : new Option(item.text, item.value));
	// 		return this;
	// 	},
	// 	addOption(text, value = text) { this.add(new Option(text, value)); return this; },
	// 	removeOptionByValue(value) {
	// 		for (let i = 0; i < this.options.length; i++)
	// 			if (this.options[i].value === value) { this.remove(i); break; }
	// 		return this;
	// 	},
	// });

	// What uses this?
	// extend(HTMLInputElement.prototype, {
	// 	bindValue(host, prop) {
	// 		this.value = host[prop] ?? "";
	// 		this.addEventListener("input", () => { host[prop] = this.value; });
	// 		host.listen(prop, ({ newValue }) => {
	// 			if (this.value !== newValue) this.value = newValue ?? "";
	// 		});
	// 		return this;
	// 	},

	// 	bindChecked(host, prop) {
	// 		this.checked = !!host[prop];
	// 		this.addEventListener("change", () => { host[prop] = this.checked; });
	// 		host.listen(prop, ({ newValue }) => {
	// 			const next = !!newValue;
	// 			if (this.checked !== next) this.checked = next;
	// 		});
	// 		return this;
	// 	},
	// });

})();

const el = (x) => document.createElement(x);
const input = (type = "text") => el("input").attr("type", type);
const sel = () => el("select");
const opt = (text, value = text) => new Option(text, value);
const addStyleSheet = (cssText) => el("style").attr("type", "text/css").txt(cssText).appendTo(document.head);

const $q = (css) => document.querySelector(css);
const $qAll = (css) => [...document.querySelectorAll(css)];

queueMicrotask(() => console.log("%cdom.js loaded", "background-color:#DFD"));
