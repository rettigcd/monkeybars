class EpochTime{
	constructor(countsInOneSeconds,convertNum){
		this._convertNum = convertNum;
		this.SECONDS = countsInOneSeconds;
		this.MINUTES = 60 * this.SECONDS;
		this.HOURS = 60 * this.MINUTES;
		this.DAYS = 24 * this.HOURS;
		this.WEEKS = 7 * this.DAYS;
		this.YEARS = 365 * this.DAYS;
		this.MONTHS = 30 * this.DAYS;
	}
	SECONDS; MINUTES; HOURS; DAYS;
	now(){ return this.toNum(new Date()); }
	// Converts s, mS or date to number
	toNum(value){ return this._convertNum(value instanceof Date ? value.valueOf() : value); }
	// Converts s or mS to Date(...)
	toDate(num){ return new Date(EpochTime.isSeconds(num) ? num*1000 : num); }
	static isSeconds(num){ return num<EpochTime.maxSeconds; }
	static maxSeconds = (1<<16)*(1<<16);
	static get JavascriptTime(){ return new EpochTime( 1000, num => EpochTime.isSeconds(num) ? num*1000 : num ); }
	static get UnixTime(){ return new EpochTime( 1, num => EpochTime.isSeconds(num) ? num : Math.floor(num / 1000) ); }
}

queueMicrotask (console.debug.bind (console, '%cepoch_time.js loaded','background-color:#DFD')); // Last line of file
