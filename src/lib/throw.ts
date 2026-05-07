
export function throwExp(msg: unknown): never {
	console.trace();
	throw msg;
}

export function throwNever(value: never): never {
	console.trace();
	throw new Error(`Unexpected value: ${String(value)}`);
}