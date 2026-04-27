type DictUpdater<T> = (dict: Record<string, T>) => void;
type ValueUpdater<T> = (value: T) => void;
type NewValueGenerator<T> = () => T;

function print(...args: unknown[]): void {
	queueMicrotask(() => console.log(...args));
}

function hasOwn(obj: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(obj, key);
}

export class SyncedPersistentDict<T> {
	private dict: Record<string, T> | null = null;
	private readonly updaters: DictUpdater<T>[] = [];
	private readonly storageKey: string;
	private readonly newValueGenerator: NewValueGenerator<T>;

	public constructor(
		storageKey: string,
		newValueGenerator: NewValueGenerator<T> = () => ({}) as T,
	) {
		this.storageKey = storageKey;
		this.newValueGenerator = newValueGenerator;

		setInterval(() => this.sync(), 30_000);
		window.addEventListener("beforeunload", () => this.sync(), false);
	}

	public keys(): string[] { return Object.keys(this.loadedDict); }

	public values(): T[] { return Object.values(this.loadedDict); }

	public entries(): Array<[string, T]> { return Object.entries(this.loadedDict); }

	public containsKey(key: string): boolean { return hasOwn(this.loadedDict, key); }

	public get(key: string): T {
		const dict = this.loadedDict;
		return hasOwn(dict, key) ? dict[key] : this.newValueGenerator();
	}

	public rename(oldKey: string, newKey: string): void {
		this.updateDict(d => {
			if (hasOwn(d, oldKey)) {
				d[newKey] = d[oldKey];
				delete d[oldKey];
				print(`Renamed [${oldKey}] to [${newKey}]`);
			} else
				print(`[${oldKey}] not found.`);
		});
	}

	public remove(key: string): void {
		this.updateDict(d => {
			delete d[key];
		});
	}

	public update(key: string, updater: ValueUpdater<T>): void {
		this.updateDict(d => {
			if (!hasOwn(d, key))
				d[key] = this.newValueGenerator();
			updater(d[key]);
		});
	}

	public sync(): void {
		this.dict = null;

		if (this.updaters.length === 0) return;

		const dict = this.loadedDict;
		for (const updater of this.updaters)
			updater(dict);

		print(`${this.updaters.length} updates saved to ${this.storageKey}`);
		this.updaters.length = 0;
		this.save();
	}

	private load(): void {
		if (this.dict !== null)
			return;
		const raw = localStorage[this.storageKey] ?? "{}";
		this.dict = JSON.parse(raw) as Record<string, T>;
	}

	private get loadedDict(): Record<string, T> {
		this.load();
		return this.dict!;
	}

	private updateDict(dictUpdater: DictUpdater<T>): void {
		dictUpdater(this.loadedDict);
		this.updaters.push(dictUpdater);
	}

	private save(): void {
		localStorage[this.storageKey] = this.serialize(this.loadedDict);
	}

	private serialize(dict: Record<string, T>): string {
		return "{\r\n"
			+ Object.entries(dict)
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
				.join(",\r\n")
			+ "\r\n}";
	}
}

export class CachedPersistentArray {
	private items: string[];
	private readonly key: string;
	private readonly glue: string;

	public constructor(key: string, glue = "\r\n") {
		this.key = key;
		this.glue = glue;

		const init = localStorage[this.key];
		this.items = init ? init.split(this.glue) : [];
	}

	public remove(item: string): void {
		this.items = this.items.filter(x => x !== item);
		this.save();
	}

	public includes(needle: string): boolean {
		return this.items.includes(needle);
	}

	public add(item: string): void {
		if (!this.items.includes(item)) {
			this.items.push(item);
			this.items.sort();
			this.save();
		}
	}
	private save(): void {
		localStorage[this.key] = this.items.join(this.glue);
	}

}
