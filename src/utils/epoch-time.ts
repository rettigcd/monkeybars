type NormalizeNum = (value: number) => number;

export class EpochTime {
	private readonly normalize: NormalizeNum;

	public readonly SECONDS: number;
	public readonly MINUTES: number;
	public readonly HOURS: number;
	public readonly DAYS: number;
	public readonly WEEKS: number;
	public readonly YEARS: number;
	public readonly MONTHS: number;

	public constructor(countsInOneSecond: number, normalize: NormalizeNum) {
		this.normalize = normalize;
		this.SECONDS = countsInOneSecond;
		this.MINUTES = 60 * this.SECONDS;
		this.HOURS = 60 * this.MINUTES;
		this.DAYS = 24 * this.HOURS;
		this.WEEKS = 7 * this.DAYS;
		this.YEARS = 365 * this.DAYS;
		this.MONTHS = 30 * this.DAYS;
	}

	public now(): number { return this.toNum(new Date()); }

	// if date => Converts date to number
	// if number => normalizes number
	public toNum(value: number | Date): number {
		return this.normalize(value instanceof Date ? value.valueOf() : value);
	}

	// Converts minutes / seconds / ms to Date(...)
	public toDate(num: number): Date {
		const t = getNumType(num);
		return new Date( t === "minutes" ? num * 60_000 : t === "seconds" ? num * 1000 : num );
	}
}

// milliSeconds since Epoch 
export function useJavascriptTime(): EpochTime {
	return new EpochTime(1000, num => {
		const t = getNumType(num);
		return t === "seconds" ? num * 1000 : t === "minutes" ? num * 60_000 : num;
	});
}

// seconds since Epoch 
export function useUnixTime(): EpochTime {
	// if num is seconds, returns it, otherwise assumes it is mS
	return new EpochTime(1, num => {
		const t = getNumType(num);
		return t === "seconds" ? num : t === "minutes" ? num * 60 : Math.floor(num / 1000); 
	});
}

// minutes since Epoch
export function useMinuteTime(): EpochTime {
	return new EpochTime(1/60, num => {
		const t = getNumType(num);
		return t === "minutes" ? num : t === "seconds" ? Math.floor(num / 60) : Math.floor(num / 60_000);
	});
}	

// Minutes takes      8 bytes to store
// Seconds takes  9..10 bytes to store
// mS      takes 12..13 bytes to store
function getNumType(ts: number): "minutes" | "seconds" | "milliseconds" {
	// Jan 1, 1990 minutes               10_519_200
	// Jan 1, 2100 minutes               68_374_080
	// 1e8   ----------------           100_000_000
	// Jan 1, 1990 seconds              631_152_000
	// Jan 1, 2100 seconds            4_102_444_800
	// 1e11  ----------------       100_000_000_000
	// Jan 1, 1990 milli-seconds    631_152_000_000
	// Jan 1, 2100 milli-seconds  4_102_444_800_000
	return (ts < 1e8) ? "minutes"
		:  (ts < 1e11) ? "seconds"
		:  "milliseconds";
}
