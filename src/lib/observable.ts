
export type ObservableChangeParams<
	THost extends object,
	K extends keyof THost & string,
> = {
	prop: K;
	host: ObservableHost<THost>;
	oldValue: THost[K];
	newValue: THost[K];
};

type ObservableKey<T extends object> = Exclude<keyof T, "listen"> & string;

export type ObservableListener<
	THost extends object,
	K extends ObservableKey<THost>,
> = (params: ObservableChangeParams<THost, K>) => void;

export type ListenFn<T extends object> = <K extends ObservableKey<T>>(
	prop: K,
	callback: ObservableListener<T, K>,
) => () => void;

export type ObservableHost<T extends object> = T & { listen: ListenFn<T>; };

type ListenerMap<T extends object> = {
	[K in ObservableKey<T>]?: Array<ObservableListener<T, K>>;
};

export function makeObservable<T extends object>(
	host: T,
): ObservableHost<T> {

	const observableHost = host as ObservableHost<T>;
	const listeners: ListenerMap<T> = Object.create(null);
	const definedProps = new Set<ObservableKey<T>>();

	observableHost.listen = function <K extends ObservableKey<T>>(
		prop: K,
		callback: ObservableListener<T, K>,
	): () => void {
		if (!definedProps.has(prop)) {
			defineObservableProperty(prop);
			definedProps.add(prop);
		}
		const callbacks = (listeners[prop] ??= []);
		callbacks.push(callback);

		return () => {
			const currentCallbacks = listeners[prop];
			if (!currentCallbacks) return;

			const remaining = currentCallbacks.filter(x => x !== callback);
			if (remaining.length > 0)
				listeners[prop] = remaining;
			else
				delete listeners[prop];
		};
	};

	// Extracted function
	function defineObservableProperty<K extends ObservableKey<T>>(prop: K) {
		if (!Object.prototype.hasOwnProperty.call(host, prop))
			throw new Error(`Cannot observe missing property: ${String(prop)}`);
	
		let value = host[prop];

		Object.defineProperty(observableHost, prop, {
			configurable: true,
			enumerable: true,
			get() { return value; },
			set(newValue: T[K]) {
				const oldValue = value;
				if (Object.is(oldValue, newValue)) return;

				value = newValue;

				const callbacks = listeners[prop];
				if (!callbacks?.length) return;

				const params: ObservableChangeParams<T, K> = {
					prop,
					host: observableHost,
					oldValue,
					newValue,
				};

				for (const callback of callbacks)
					callback(params);
			},
		});
	}

	return observableHost;
}

// Usage:
//	class User extends ObservableBase<User> {
//		public name = "";
//	}
export abstract class ObservableBase<T extends object> {
	private readonly listeners: ListenerMap<T> = Object.create(null);
	private readonly definedProps = new Set<ObservableKey<T>>();

	public listen<K extends ObservableKey<T>>(
		prop: K,
		callback: ObservableListener<T, K>,
	): () => void {
		const { definedProps, listeners } = this;

		if (!definedProps.has(prop)) {
			this.defineObservableProperty(prop);
			definedProps.add(prop);
		}

		const callbacks = (listeners[prop] ??= []);
		callbacks.push(callback);

		return () => {
			const currentCallbacks = listeners[prop];
			if (!currentCallbacks) return;

			const remaining = currentCallbacks.filter(x => x !== callback);
			if (remaining.length > 0)
				listeners[prop] = remaining;
			else
				delete listeners[prop];
		};
	}

	private defineObservableProperty<K extends ObservableKey<T>>(prop: K): void {
		const host = this as unknown as T;
		const listeners = this.listeners;

		if (!Object.prototype.hasOwnProperty.call(host, prop))
			throw new Error(`Cannot observe missing property: ${String(prop)}`);

		let value: T[K] = host[prop];

		Object.defineProperty(host, prop, {
			configurable: true,
			enumerable: true,
			get() { return value; },
			set: (newValue: T[K]) => {
				const oldValue = value;
				if (Object.is(oldValue, newValue)) return;

				value = newValue;

				const callbacks = listeners[prop];
				if (!callbacks?.length) return;

				const params: ObservableChangeParams<T, K> = {
					prop,
					host: host as ObservableHost<T>,
					oldValue,
					newValue,
				};

				for (const callback of callbacks)
					callback(params);
			},
		});
	}
}


// ==============================
// ==============================

export type EventHandler<TArgs extends unknown[] = unknown[]> = (
	...args: TArgs
) => void;

export type OnFn<TEvents extends Record<string, unknown[]>> = <
	K extends keyof TEvents & string
>(
	eventName: K,
	handler: EventHandler<TEvents[K]>,
) => EventHost<TEvents>;

export type TriggerFn<TEvents extends Record<string, unknown[]>> = <
	K extends keyof TEvents & string
>(
	eventName: K,
	...args: TEvents[K]
) => void;

export type EventHost<TEvents extends Record<string, unknown[]>> = {
	on: OnFn<TEvents>;
	trigger: TriggerFn<TEvents>;
};

type EventHandlerMap<TEvents extends Record<string, unknown[]>> = {
	[K in keyof TEvents & string]?: Array<EventHandler<TEvents[K]>>;
};

// makeEventHost mix-in
export function makeEventHost<
	THost extends object,
	TEvents extends Record<string, unknown[]>,
>(
	host: THost,
): THost & EventHost<TEvents> {
	const eventHost = host as THost & EventHost<TEvents>;
	const handlers: EventHandlerMap<TEvents> = Object.create(null);

	eventHost.on = function <K extends keyof TEvents & string>(
		eventName: K,
		handler: EventHandler<TEvents[K]>,
	): THost & EventHost<TEvents> {
		if (handler === undefined) {
			throw new Error(`Handler is undefined for event ${String(eventName)}`);
		}

		const list = (handlers[eventName] ??= []);
		list.push(handler);

		return this;
	};

	eventHost.trigger = function <K extends keyof TEvents & string>(
		eventName: K,
		...args: TEvents[K]
	): void {
		const list = handlers[eventName];
		if (!list?.length) {
			return;
		}

		for (const handler of list) {
			handler(...args);
		}
	};

	return eventHost;
}

/* Example:

	type UserEvents = {
		yawned: [param1: string, param2: number]; // event args
	};

	export class User implements EventHost<UserEvents> {
		name?: string;
		public on!: OnFn<UserEvents>;
		public trigger!: TriggerFn<UserEvents>;
		constructor() {
			makeEventHost<User,UserEvents>(this);
		}
	}

*/

export abstract class EventHostBase< TEvents extends Record<string, unknown[]>> implements EventHost<TEvents> {
	private readonly handlers: EventHandlerMap<TEvents> = Object.create(null);

	public on<K extends keyof TEvents & string>( eventName: K, handler: EventHandler<TEvents[K]> ): this {
		if (handler === undefined)
			throw new Error(`Handler is undefined for event ${String(eventName)}`);

		const list = (this.handlers[eventName] ??= []);
		list.push(handler);

		return this;
	}

	public trigger<K extends keyof TEvents & string>( eventName: K, ...args: TEvents[K] ): void {
		const list = this.handlers[eventName];
		if (!list?.length)
			return;

		for (const handler of list)
			handler(...args);
	}
}

/*  Usage
type UserEvents = {
	yawned: [message: string, count: number];
};

class User extends EventHostBase<UserEvents> {
	public name?: string;
	public doYawn() {
		this.trigger("yawned", "so sleepy", 1);
	}
}

const user = new User();

user.on("yawned", (message, count) => {
	console.log(message, count);
});

user.doYawn();
*/