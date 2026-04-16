// dom2.ts

// TODO: if these extensions are only used to build the UI using el()
// then return a wrapper type instead of extending the native prototypes

// Note: these extensions are not for building, but for use in the UI code. 
// If I just need create code, maybe we should use a create function with options instead.

// Option 1 - extend native prototypes (like jQuery)
// Option 2 - create with options
// Option 3 - create returns a wrapper with extended types
// Option 4 - create with options + wrapper with extended types

type Action<T> = (value: T) => void;

export type ChildLike =
	| Node
	| string
	| number
	| boolean
	| null
	| undefined
	| ChildLike[];

declare global {
// 	interface HTMLElement {
// 		css(style: Partial<CSSStyleDeclaration>): this;

// 		txt(): string | null;
// 		txt(value: string | null | undefined): this;

// 		html(): string;
// 		html(value: string): this;

// 		prop<K extends keyof this>(name: K): this[K];
// 		prop<K extends keyof this>(name: K, value: this[K]): this;

// 		attr(name: string): string | null;
// 		attr(name: string, value: string): this;

// 		cls(...names: string[]): this;
// 		addClass(name: string): this;
// 		removeClass(name: string): this;
// 		toggleClass(name: string, force?: boolean): this;

// 		data(key: string): string | undefined;
// 		data(key: string, value: string): this;

// 		on<K extends keyof HTMLElementEventMap>(
// 			eventName: K,
// 			handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
// 			options?: boolean | AddEventListenerOptions,
// 		): this;
// 		on(
// 			eventName: string,
// 			handler: EventListenerOrEventListenerObject,
// 			options?: boolean | AddEventListenerOptions,
// 		): this;

// 		off<K extends keyof HTMLElementEventMap>(
// 			eventName: K,
// 			handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => unknown,
// 			options?: boolean | EventListenerOptions,
// 		): this;
// 		off(
// 			eventName: string,
// 			handler: EventListenerOrEventListenerObject,
// 			options?: boolean | EventListenerOptions,
// 		): this;

// 		appendTo(host: Node): this;
// 		withChildren(...children: (Node|string)[]): this;
// 		do(action: Action<this>): this;
// 	}

// 	interface HTMLSelectElement {
// 		addOptions(
// 			items: Array<string | { text: string; value: string }>
// 		): this;

// 		addOption(text: string, value?: string): this;

// 		removeOptionByValue(value: string): this;
// 	}
}

function isNode(value: unknown): value is Node {
	return value instanceof Node;
}

function extend<T extends object>(
	proto: T,
	methods: Record<string, unknown>,
	name = (proto as { constructor?: { name?: string } }).constructor?.name ?? "prototype",
): void {
	for (const [prop, fn] of Object.entries(methods)) {
		if (prop in proto)
			throw new Error(`${name} already contains ${prop}`);

		Object.defineProperty(proto, prop, {
			value: fn,
			writable: true,
			configurable: true,
			enumerable: false,
		});
	}
}

let installed = false;

function installDomHelpers(): void {
	if (installed)
		return;

	installed = true;

	extendHtmlElement();
	extendSelect();
}

function extendHtmlElement(): void {
	extend(HTMLElement.prototype, {
		css(this: HTMLElement, style: Partial<CSSStyleDeclaration>) {
			Object.assign(this.style, style);
			return this;
		},

		txt(this: HTMLElement, value?: string | null) {
			if (arguments.length === 0)
				return this.textContent;
			this.textContent = value ?? "";
			return this;
		},

		html(this: HTMLElement, value?: string) {
			if (arguments.length === 0)
				return this.innerHTML;
			this.innerHTML = value ?? "";
			return this;
		},

		prop(this: HTMLElement, name: keyof HTMLElement, value?: unknown) {
			if (arguments.length === 1)
				return this[name];
			(this as unknown as Record<PropertyKey, unknown>)[name] = value;
			return this;
		},

		attr(this: HTMLElement, name: string, value?: string) {
			if (arguments.length === 1)
				return this.getAttribute(name);
			this.setAttribute(name, value ?? "");
			return this;
		},

		cls(this: HTMLElement, ...names: string[]) {
			this.classList.add(...names);
			return this;
		},

		// NOT for building
		addClass(this: HTMLElement, name: string) { this.classList.add(name); return this; },
		removeClass(this: HTMLElement, name: string) { this.classList.remove(name); return this; },
		toggleClass(this: HTMLElement, name: string, force?: boolean) { this.classList.toggle(name, force); return this; },

		data(this: HTMLElement, key: string, value?: string) {
			if (arguments.length === 1)
				return this.dataset[key];
			this.dataset[key] = value ?? "";
			return this;
		},

		on(
			this: HTMLElement,
			eventName: string,
			handler: EventListenerOrEventListenerObject,
			options?: boolean | AddEventListenerOptions,
		) {
			this.addEventListener(eventName, handler, options);
			return this;
		},

		off(
			this: HTMLElement,
			eventName: string,
			handler: EventListenerOrEventListenerObject,
			options?: boolean | EventListenerOptions,
		) {
			this.removeEventListener(eventName, handler, options);
			return this;
		},

		appendTo(this: HTMLElement, host: Node) {
			host.appendChild(this);
			return this;
		},

		withChildren(this: HTMLElement, ...children: (Node|string)[]) {
			this.append(...children.flat().filter(x => x != null));
			return this;
		},

		do<TElement extends HTMLElement>(this: TElement, action: Action<TElement>) {
			action(this);
			return this;
		},
	});

}

function extendSelect() : void {
	extend(HTMLSelectElement.prototype, {
		addOptions(
			this: HTMLSelectElement,
			items: Array<string | { text: string; value: string }>
		) {
			for (const item of items) {
				const option =
					typeof item === "string"
						? new Option(item, item)
						: new Option(item.text, item.value);

				this.add(option);
			}
			return this;
		},

		addOption(this: HTMLSelectElement, text: string, value = text) {
			this.add(new Option(text, value));
			return this;
		},

		removeOptionByValue(this: HTMLSelectElement, value: string) {
			for (let i = 0; i < this.options.length; i++) {
				if (this.options[i].value === value) {
					this.remove(i);
					break;
				}
			}
			return this;
		},
	});	
}

function el<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] {
	return document.createElement(tagName);
}

function input(type = "text"): HTMLInputElement {
	return el("input").attr("type", type);
}

function sel(): HTMLSelectElement {
	return el("select");
}

function opt(text: string, value = text): HTMLOptionElement {
	return new Option(text, value);
}

function addStyleSheet(cssText: string): HTMLStyleElement {
	return el("style").attr("type", "text/css").txt(cssText).appendTo(document.head);
}

function $q<T extends Element = Element>(css: string): T | null {
	return document.querySelector<T>(css);
}

function $qAll<T extends Element = Element>(css: string): T[] {
	return [...document.querySelectorAll<T>(css)];
}

export {
	installDomHelpers,
	el,
	input,
	$q,
	$qAll
}