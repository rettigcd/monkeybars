export type ConvertNum = (value: number) => number;

export class EpochTime {
	private readonly _convertNum: ConvertNum;

	public readonly SECONDS: number;
	public readonly MINUTES: number;
	public readonly HOURS: number;
	public readonly DAYS: number;
	public readonly WEEKS: number;
	public readonly YEARS: number;
	public readonly MONTHS: number;

	public constructor(countsInOneSecond: number, convertNum: ConvertNum) {
		this._convertNum = convertNum;
		this.SECONDS = countsInOneSecond;
		this.MINUTES = 60 * this.SECONDS;
		this.HOURS = 60 * this.MINUTES;
		this.DAYS = 24 * this.HOURS;
		this.WEEKS = 7 * this.DAYS;
		this.YEARS = 365 * this.DAYS;
		this.MONTHS = 30 * this.DAYS;
	}

	public now(): number { return this.toNum(new Date()); }

	// Converts s, ms or Date to number
	public toNum(value: number | Date): number {
		return this._convertNum(value instanceof Date ? value.valueOf() : value);
	}

	// Converts s or ms to Date(...)
	public toDate(num: number): Date {
		return new Date(EpochTime.isSeconds(num) ? num * 1000 : num);
	}

	public static isSeconds(num: number): boolean { return num < EpochTime.maxSeconds; }

	public static readonly maxSeconds: number = (1 << 16) * (1 << 16);

	public static get JavascriptTime(): EpochTime {
		return new EpochTime(1000, num => EpochTime.isSeconds(num) ? num * 1000 : num);
	}

	public static get UnixTime(): EpochTime {
		return new EpochTime(1, num => EpochTime.isSeconds(num) ? num : Math.floor(num / 1000));
	}
}
