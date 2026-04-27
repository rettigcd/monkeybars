
// Removes all properties of the haystack object tree that does not include the needle text
// Modifies the original object
// Helper function for drilling down into large objects to find the relevant data, by removing all irrelevant data
export function pruneHay(haystack: Record<string, unknown>, needle: string) {
	const hayOnly: string[] = [];
	for (const hay in haystack) {
		const smallerHaystack = haystack[hay];
		if (!JSON.stringify(smallerHaystack).includes(needle))
			hayOnly.push(hay);
		else if (isRecord(smallerHaystack))
			pruneHay(smallerHaystack, needle);
	}
	hayOnly.forEach((hay) => delete haystack[hay]);
}


// Searches object tree for a property that matches the needle and returns that prop's value.
export function findProp<T = unknown>(
	host: unknown,
	needle: string,
): T | undefined {
	if (!isRecord(host)) return undefined;
	for (const prop in host) {
		const value = host[prop];
		if (prop === needle) return value as T;
		const found = findProp<T>(value, needle);
		if (found !== undefined) return found;
	}

	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}


// Traverses a JSON blob to find a path to a value containing a target string.
// Used for debugging API responses and locating image references.
export function detectPath(blob:string, needle:string): string[] {
	const path: string[] = [];
	let item: unknown = JSON.parse(blob);

	while (true) {
		if(!isRecord(item)) break;
		const record = item; // help typescript know this has been narrowed.
		const keys = Object.keys(record);
		if (keys.length == 0) break;

		const match = keys.find((key) => JSON.stringify(record[key]).includes(needle));
		if(match === undefined) break;
		path.push(match);
		item = item[match];
	}

	return path;
}
