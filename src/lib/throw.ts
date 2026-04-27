
export function throwExp(msg: unknown): never {
	console.trace();
	throw msg;
}
