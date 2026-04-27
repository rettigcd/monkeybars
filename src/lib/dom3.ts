type ChildLike =
	| Node
	| string
	| number
	| boolean
	| null
	| undefined
	| ElementBuilder<HTMLElement>;

type SafePropKey<T extends HTMLElement> = Exclude<keyof T, "data">;

export class ElementBuilder<T extends HTMLElement> {
	public constructor(public readonly el: T) {}

	css(style: Partial<CSSStyleDeclaration>): this {
		Object.assign(this.el.style, style);
		return this;
	}

	txt(): string | null;
	txt(value: string | null | undefined): this;
	txt(value?: string | null | undefined): this | string | null {
		if (arguments.length === 0) return this.el.textContent;
		this.el.textContent = value ?? "";
		return this;
	}

	html(): string;
	html(value: string | null | undefined): this;
	html(value?: string | null | undefined): this | string {
		if (arguments.length === 0)
			return this.el.innerHTML;
		this.el.innerHTML = value ?? "";
		return this;
	}

	prop<K extends SafePropKey<T>>(name: K): T[K];
	prop<K extends SafePropKey<T>>(name: K, value: T[K]): this;
	prop<K extends SafePropKey<T>>(name: K, value?: T[K]): this | T[K] {
		if (arguments.length === 1)
			return this.el[name];
		this.el[name] = value as T[K];
		return this;
	}

	attr(name: string): string | null;
	attr(name: string, value: string | null | undefined): this;
	attr(name: string, value?: string | null | undefined): this | string | null {
		if (arguments.length === 1)
			return this.el.getAttribute(name);
		this.el.setAttribute(name, value ?? "");
		return this;
	}

	cls(...names: string[]): this {
		this.el.classList.add(...names);
		return this;
	}

	addClass(name: string): this {
		this.el.classList.add(name);
		return this;
	}

	removeClass(name: string): this {
		this.el.classList.remove(name);
		return this;
	}

	toggleClass(name: string, force?: boolean): this {
		this.el.classList.toggle(name, force);
		return this;
	}

	data(key: string): string | undefined;
	data(key: string, value: string | null | undefined): this;
	data(key: string, value?: string | null | undefined): this | string | undefined {
		if (arguments.length === 1)
			return this.el.dataset[key];
		this.el.dataset[key] = value ?? "";
		return this;
	}

	on(
		eventName: string,
		handler: EventListenerOrEventListenerObject,
		options?: boolean | AddEventListenerOptions,
	): this {
		this.el.addEventListener(eventName, handler, options);
		return this;
	}

	off(
		eventName: string,
		handler: EventListenerOrEventListenerObject,
		options?: boolean | EventListenerOptions,
	): this {
		this.el.removeEventListener(eventName, handler, options);
		return this;
	}

	appendTo(host: Node): this {
		host.appendChild(this.el);
		return this;
	}

	withChildren(...children: ChildLike[]): this {
		this.el.append(
			...children
				.filter(x => x != null)
				.map(x => x instanceof ElementBuilder ? x.el : x instanceof Node ? x : String(x))
		);
		return this;
	}

	do(action: (element: T) => void): this {
		action(this.el);
		return this;
	}
}

// sig1:   const div = $('div');
// sig2:   const wrapped = $(document.createElement("input"));
export function $<K extends keyof HTMLElementTagNameMap>(tagName: K): ElementBuilder<HTMLElementTagNameMap[K]>;
export function $<T extends HTMLElement>(element: T): ElementBuilder<T>;
export function $(value: keyof HTMLElementTagNameMap | HTMLElement) {
	return new ElementBuilder(typeof value === "string" ? document.createElement(value) : value);
}

export function $q<T extends Element = HTMLElement>(css: string): T | null {
	return document.querySelector<T>(css);
}

export function $qAll<T extends Element = HTMLElement>(css: string): T[] {
	return [...document.querySelectorAll<T>(css)];
}

// Promise that waits for element to become available, then returns it.
export function $qAsync<T extends Element = HTMLElement>(cssSelector: string, timeout = 10000): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const step = 500;
		const timerId = window.setInterval(() => {
			const el = document.querySelector<T>(cssSelector);
			timeout -= step;
			if (el != null)
				resolve(el);
			else if ( timeout<= 0)
				reject(new Error(`timeout searching for ${cssSelector}`));
			else
				return;
			clearInterval(timerId);
		}, step);
	});
}
