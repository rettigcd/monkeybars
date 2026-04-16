import { SyncedPersistentDict } from "~/utils/storage";

type TimeStampInfo = { timeStamp?: number };

// Tracks the last time each extractor successfully parsed a response, by touching the extractor's name on each successful parse. This is used to determine which extractors are active and working, and can be used for debugging and performance monitoring.
const apiTimes = new SyncedPersistentDict<TimeStampInfo>("apiTimes");


export function apiTimesTouch (key:string) {
	const ts = new Date().valueOf();
	apiTimes.update(key, (x) => x.timeStamp = ts);
};
