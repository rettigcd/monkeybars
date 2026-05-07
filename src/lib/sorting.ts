export type Projection<T, TValue> = (item: T) => TValue;

export type CompareFunction<T> = ((a: T, b: T) => number) & {
	thenBy<TValue>(proj: Projection<T, TValue>): CompareFunction<T>;
	thenByDesc<TValue>(proj: Projection<T, TValue>): CompareFunction<T>;
};

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

export function by<T, TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
	return makeCompareFunction<T>().thenBy(proj);
}

export function byDesc<T, TValue>(proj: Projection<T, TValue>): CompareFunction<T> {
	return makeCompareFunction<T>().thenByDesc(proj);
}


// Uses the keyFinder to group the items
export function groupBy<T, K extends PropertyKey>(
	items: Iterable<T>,
	keyFinder: (item: T) => K,
): Record<K, T[]> {
	const groups = {} as Record<K, T[]>;
	for (const item of items) {
		const key = keyFinder(item);
		if (!(key in groups))
			groups[key] = [];
		groups[key].push(item);
	}
	return groups;
}

// =====================================

export function onlyUnique<T>(value:T, index:number, self:T[]): boolean { return self.indexOf(value) === index; } // use with [..].fiter(onlyUnique);
