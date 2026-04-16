const mS = 1;
const SECONDS = 1000 * mS;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAYS = 24 * HOURS;
const [WEEKS, MONTHS, YEARS] = [7 * DAYS, 30 * DAYS, 365 * DAYS] as const;

export {
	mS, SECONDS, MINUTES, HOURS, DAYS, WEEKS, MONTHS, YEARS,
};
