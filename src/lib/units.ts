const mS = 1; // Native to Javascript. Ticks are ms.
const SECONDS = 1000 * mS;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAYS = 24 * HOURS;
const [WEEKS, MONTHS, YEARS] = [7 * DAYS, 30 * DAYS, 365 * DAYS] as const;

export { DAYS, HOURS, MINUTES, MONTHS, mS, SECONDS, WEEKS, YEARS };

