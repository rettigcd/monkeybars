export type SnoopFunc = "fetch" | "XMLHttpRequest";

type SnoopRequestInit = {
	method?: string;
	url: URL;
	body?: BodyInit | Document | XMLHttpRequestBodyInit | null | unknown;
	responseText: string;
	headers?: Record<string, string> | HeadersInit | unknown;
	timestamp: number;
	func: SnoopFunc;
};

export type SnoopHandler = (request: SnoopRequest) => void;

export type FetchInterceptor = (
	url: string | URL,
	options?: RequestInit,
) => Promise<Response> | undefined;

export type RequestSnooperConfig = {
	fetchInterceptor?: FetchInterceptor;
};

export type SnoopedWindow = {
	fetch: typeof fetch;
	XMLHttpRequest: typeof XMLHttpRequest;
	location: Location;
};

export type SnoopedXMLHttpRequest = XMLHttpRequest & {
	_openArgs?: IArguments;
	_sendBody?: unknown;
	_headers?: Record<string, string>;
	_timestamp?: number;
};

export class SnoopRequest {
	public readonly url: URL;
	public readonly responseText: string;
	public readonly body?: string;
	public readonly method?: string;
	public readonly func: SnoopFunc;
	public readonly headers?: Record<string, string> | HeadersInit | unknown;
	public readonly timestamp: number;
	public readonly duration: number;

	public constructor({ method, url, body, responseText, headers, timestamp, func }: SnoopRequestInit) {
		this.url = url;
		this.responseText = responseText;
		if(body != null)
			this.body = this.bodyToString(body);
		this.method = method;
		this.func = func;
		this.headers = headers;
		this.timestamp = timestamp;
		this.duration = Date.now() - timestamp;
	}

	bodyToString(body: any ): string{      // BodyInit | Document | XMLHttpRequestBodyInit
		if(typeof body === "string") return body;

		// URLSearchParams (e.g. form posts)
		if (body instanceof URLSearchParams) 
			return body.toString();


		// FormData
		if (body instanceof FormData) {
			const parts: string[] = [];
			for (const [key, value] of Object.entries(body)) {
				if (typeof value === "string")
					parts.push(`${key}=${value}`);
				else
					parts.push(`${key}=[Blob:${value.type || "unknown"}]`);
			}
			return parts.join("&");
		}

		// Blob / File
		if (body instanceof Blob)
			return `[Blob type=${body.type} size=${body.size}]`;

		// ArrayBuffer
		if (body instanceof ArrayBuffer)
			return `[ArrayBuffer byteLength=${body.byteLength}]`;

		// Typed arrays (Uint8Array, etc.)
		if (ArrayBuffer.isView(body))
			return `[TypedArray byteLength=${body.byteLength}]`;

		// Document (XML / HTML)
		if (body instanceof Document)
			try {
				return new XMLSerializer().serializeToString(body);
			} catch {
				return "[Document]";
			}

		// Plain object (rare but happens in your own code paths)
		if (typeof body === "object") {
			try {
				return JSON.stringify(body);
			} catch {
				return "[Object]";
			}
		}

		return `unknown body of type [${typeof body}]`;
	}

	// Helper: called by JSON.stringify to pre-format values that will be serialized into a JSON string.
	public toJSON(): {
		timestamp: number;
		method?: string;
		url: string;
		responseText: string;
		duration: number;
		headers?: Record<string, string> | HeadersInit | unknown;
		body?: string;
	} {
		const { url, responseText, method, timestamp, duration, headers, body } = this;
		const result: {
			timestamp: number;
			method?: string;
			url: string;
			responseText: string;
			duration: number;
			headers?: Record<string, string> | HeadersInit | unknown;
			body?: string;
		} = { timestamp, method, url: url.toString(), responseText, duration };

		if (headers !== undefined)
			result.headers = headers;
		if (body !== undefined)
			result.body = body;

		return result;
	}

	// returns JSON object
	public get json(): unknown {
		return JSON.parse(this.responseText);
	}
}

export function makeNewFetch(
	myWindow: SnoopedWindow,
	loadHandlers: SnoopHandler[],
	interceptor: FetchInterceptor,
): void {
	const origFetch = myWindow.fetch.bind(myWindow);

	myWindow.fetch = function(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
		const [p0, options] = args;
		const url = p0 instanceof Request ? p0.url : p0;

		const fakeResponse = interceptor(url, options);
		if (fakeResponse !== undefined)
			return fakeResponse;

		const timestamp = Date.now();
		const promise = origFetch(...args);

		if (loadHandlers.length)
			promise
				.then(response => response.clone().text())
				.then(responseText => {
					const { method, body, headers } = options || {};
					const record = new SnoopRequest({
						method,
						url: new URL(String(url), myWindow.location.href),
						body,
						headers,
						responseText,
						timestamp,
						func: "fetch",
					});

					loadHandlers.forEach(callback => {
						try {
							callback(record);
						} catch (err) {
							console.error(err);
						}
					});
				});

		return promise;
	};
}

type XhrOpen = {
	(method: string, url: string | URL): void;
	(
		method: string,
		url: string | URL,
		async: boolean,
		username?: string | null,
		password?: string | null,
	): void;
};

export function makeNewXMLHttpRequest(
	myWindow: SnoopedWindow,
	loadHandlers: SnoopHandler[],
): void {
	const OrigXMLHttpRequest = myWindow.XMLHttpRequest;

	function ReplacementXMLHttpRequest(this: XMLHttpRequest): XMLHttpRequest {
		const xhr = new OrigXMLHttpRequest();

		const state: {
			openArgs: [method?: unknown, url?: unknown, ...rest: unknown[]] | null;
			sendBody?: unknown;
			headers?: Record<string, string>;
			timestamp?: number;
		} = {
			openArgs: null,
			sendBody: undefined,
			headers: undefined,
			timestamp: undefined,
		};

		const origOpen = xhr.open.bind(xhr) as XhrOpen;
		const origSend = xhr.send.bind(xhr);
		const origSetRequestHeader = xhr.setRequestHeader.bind(xhr);		
		// const origSend = xhr.send;
		// const origSetRequestHeader = xhr.setRequestHeader;

		xhr.open = function (
			method: string,
			url: string | URL,
			async?: boolean,
			username?: string | null,
			password?: string | null,
		): void {
			state.openArgs = [method, url, async, username, password];
			state.timestamp = Date.now();

			if (async === undefined)
				return origOpen(method, url);

			return origOpen(method, url, async, username, password);
		};

		xhr.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
			state.sendBody = body;
			return origSend(body);
		};

		xhr.setRequestHeader = function (name: string, value: string): void {
			(state.headers ??= {})[name] = value;
			return origSetRequestHeader(name, value);
		};

		xhr.addEventListener("load", () => {
			const [method, origUrl] = state.openArgs || [];
			if (!origUrl)
				return;

			const url = new URL(String(origUrl), myWindow.location.href);
			const { sendBody: body, headers, timestamp } = state;

			let responseText: string;
			try {
				responseText =
					xhr.responseType === "" || xhr.responseType === "text"
						? xhr.responseText
						: `[responseType:${xhr.responseType}]`;
			} catch {
				responseText = `[responseType:${xhr.responseType}]`;
			}

			const record = new SnoopRequest({
				method: typeof method === "string" ? method : undefined,
				url,
				body,
				responseText,
				headers,
				timestamp: timestamp ?? Date.now(),
				func: "XMLHttpRequest",
			});

			for (const callback of loadHandlers) {
				try {
					callback(record);
				} catch (err) {
					console.error(err);
				}
			}
		});

		return xhr;
	}

	ReplacementXMLHttpRequest.prototype = OrigXMLHttpRequest.prototype;
	Object.setPrototypeOf(ReplacementXMLHttpRequest, OrigXMLHttpRequest); // just being careful
	myWindow.XMLHttpRequest = ReplacementXMLHttpRequest as unknown as typeof XMLHttpRequest;
}

export function makeNewWebSocket(
	origConstructor: typeof WebSocket,
	loadHandlers: SnoopHandler[],
): typeof WebSocket {
	void loadHandlers;

	return function(this: WebSocket, ...args: ConstructorParameters<typeof WebSocket>): WebSocket {
		const socket = new origConstructor(...args);

		const handler: ProxyHandler<WebSocket> = {
			get(target, prop, receiver) {
				console.log("socket-get", prop);

				const member = Reflect.get(target, prop, receiver);
				if (typeof member === "function")
					return function(...innerArgs: unknown[]) {
						console.log(`Intercepted method call: ${String(prop)}(${innerArgs.join(", ")})`);
						return Reflect.apply(member, target, innerArgs);
					};

				return member;
			},
			set(obj, prop, value, receiver) {
				const knownProps = ["binaryType"];
				if (!knownProps.includes(String(prop)))
					console.log("socket-set", prop, value);
				return Reflect.set(obj, prop, value, receiver);
			},
		};

		return new Proxy(socket, handler);
	} as unknown as typeof WebSocket;
}


// Calls makeNewXXXX to add snooping hooks to the window 
export class RequestSnooper {
	private readonly _loadHandlers: SnoopHandler[];
	public readonly _loadLog: SnoopRequest[];

	public constructor(myWindow: SnoopedWindow, config?: RequestSnooperConfig) {
		this._loadHandlers = [];
		this._loadLog = [];

		const { fetchInterceptor } = config || {};
		makeNewXMLHttpRequest(myWindow, this._loadHandlers);
		makeNewFetch(myWindow, this._loadHandlers, fetchInterceptor || (() => undefined));
	}

	public addHandler(method: SnoopHandler, runOld = true): this {
		if (runOld)
			this._runHandlerOnOldRequests(method);
		this._loadHandlers.push(method);
		return this;
	}

	public logRequests(predicate: (request: SnoopRequest) => boolean = () => true): this {
		this._loadHandlers.push(x => {
			if (!predicate(x))
				return;
			Object.defineProperty(x, "idx", { value: this._loadLog.length });
			this._loadLog.push(x);
		});
		return this;
	}

	private _runHandlerOnOldRequests(method: SnoopHandler): void {
		for (const ex of this._loadLog)
			method(ex);
	}
}