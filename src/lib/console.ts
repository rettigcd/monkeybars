// Extends the conosle

export type PrintConsole = Console & {
	print(...args: Parameters<Console["log"]>): void;
};

export type ExtendedConsole = PrintConsole & {
	image(url: string, height?: number): void;
};

// called automatically on globalThis.console
export function addPrint( con: Console ) : PrintConsole {
	// strips the line numbers
	(con as PrintConsole).print = function(...args: Parameters<Console["log"]>): void {
		queueMicrotask(console.log.bind(console, ...args));
	};
	return con as PrintConsole;
}

export function extendConsole( con: Console ): ExtendedConsole {
	const extended = con as ExtendedConsole;
	addPrint(con);
	extended.image = function(url: string, height = 100): void {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = function(): void {
			const canvas = document.createElement("canvas");
			const ctx = canvas.getContext("2d");
			if (ctx == null)
				throw new Error("2D canvas context is unavailable");

			canvas.height = height || image.naturalHeight;
			canvas.width = canvas.height * image.naturalWidth / image.naturalHeight;
			ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

			const dataUrl = canvas.toDataURL();
			const style = [
				"font-size: 1px;",
				`padding: ${canvas.height}px ${canvas.width}px;`,
				`background: url(${dataUrl}) no-repeat;`,
				"background-size: contain;"
			].join(" ");

			extended.log("%c ", style);
		};
		image.src = url;
	};

	return extended;
}

type LogLevel = "log" | "info" | "warn" | "error" | "debug";
type ConsoleLogEntry = { level: LogLevel; args: unknown[]; };

export type HasConsole = { console: Console; }

export type SilentConsole = Console & {
	logEntries: ConsoleLogEntry[];
	originalConsole: Console;
};

// other console properties: 
//	Core logging:		log(...), info(...), warn(...), error(...), debug(...)
//	Inspection/format:	dir(...), dirxml(...), table(...)
//	Assertions:			assert(condition, ...data)
//	Timing:				time(label?), timeLog(label?, ...data), timeEnd(label?)
//	Counting:			count(label?), countReset(label?),
//	Grouping:			group(...data), grouCollapsed(...data); 
// 	Stacktracing		trace(...data) 
//	Misc:				clear() 

// Silences (.log .info .debug) sent to the console by the normal application.
// usage:   silenceConsole(unsafeWindow)
export function silenceConsole(win: HasConsole): void {
	const c = win.console;
	win.console = Object.assign(Object.create(c), {
		originalConsole: c,
		logEntries: [] as SilentConsole["logEntries"],
		log(...args: unknown[]) { this.logEntries.push({ level: "log", args }); },
		info(...args: unknown[]) { this.logEntries.push({ level: "info", args }); },
		debug(...args: unknown[]) { this.logEntries.push({ level: "debug", args }); },
	}) as SilentConsole;
}

// Restores the original console.
export function restoreConsole(win: typeof globalThis): void {
	const c = win.console as Partial<SilentConsole>;
	if (c.originalConsole) {
		win.console = c.originalConsole;
	}
}

// ! Use this for printing with no line numbersfor con.print(...)
export const con = addPrint( console );