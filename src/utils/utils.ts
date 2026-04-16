type Projection<T, TValue> = (item: T) => TValue;

type CompareFunction<T> = ((a: T, b: T) => number) & {
	thenBy<TValue>(proj: Projection<T, TValue>): CompareFunction<T>;
	thenByDesc<TValue>(proj: Projection<T, TValue>): CompareFunction<T>;
};

type ConsoleWithImage = Console & {
	image(url: string, height?: number): void;
	print(...args: unknown[]): void;
};

type JsonWithFormat = JSON & {
	format(s: string): string;
};

declare const unsafeWindow: Window & typeof globalThis;

function throwExp(msg: unknown): never {
	console.trace();
	throw msg;
}

// Example usage: myArray.sort(byDesc(item => item.h).thenBy(item => item.w))
function makeCompareFunction<T>(): CompareFunction<T> {
	const subCompareFuncs: Array<(a: T, b: T) => number> = [];

	const f = ((a: T, b: T) => {
		let result = 0;
		for (const comp of subCompareFuncs)
			if ((result = comp(a, b)) !== 0)
				break;
		return result;
	}) as CompareFunction<T>;

	function appendSubCompareFunc<TValue>(proj: Projection<T, TValue>, rtn: number): CompareFunction<T> {
		subCompareFuncs.push((a, b) => {
			const av = proj(a);
			const bv = proj(b);
			return av < bv ? -rtn : av === bv ? 0 : rtn;
		});
		return f;
	}

	f.thenBy = function <TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
		return appendSubCompareFunc(proj, 1);
	};

	f.thenByDesc = function <TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
		return appendSubCompareFunc(proj, -1);
	};

	return f;
}

function by<T, TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
	return makeCompareFunction<T>().thenBy(proj);
}

function byDesc<T, TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
	return makeCompareFunction<T>().thenByDesc(proj);
}

const unsafeConsole = unsafeWindow.console as ConsoleWithImage;
const formattedJson = unsafeWindow.JSON as JsonWithFormat;
const localConsole = console as ConsoleWithImage;

unsafeConsole.image = function(url: string, height = 100): void {
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

		unsafeConsole.log("%c ", style);
	};
	image.src = url;
};

declare global {
	interface Console {
		print(...args: unknown[]): void;
	}
}

localConsole.print = function(...args: unknown[]): void {
	queueMicrotask(() => console.log(...args));
};

formattedJson.format = function(s: string): string {
	return JSON.stringify(JSON.parse(s), null, "\t");
};

export {
	by, byDesc, throwExp
};

	export type {
		CompareFunction,
		ConsoleWithImage,
		JsonWithFormat, Projection
	};
