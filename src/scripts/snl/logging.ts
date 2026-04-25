import { con } from "~/utils/console";

type LoggerEntry = {
	timestamp: number;
	msg: unknown;
};

const LOG_STYLE = "font-style:italic;color:black;font-size:14px;font-weight:bold;text-shadow:1px 1px 2px #55f;";

// Adds a 
export class TimeStampConsoleLogger {
	public readonly entries: LoggerEntry[] = [];

	public log(msg: unknown): void {
		const consoleMsg = typeof msg === "object"
			? JSON.stringify(msg, null, "\t")
			: String(msg);
		con.print?.(`%c${consoleMsg}`, LOG_STYLE);
		this.entries.push({ timestamp: Date.now(), msg });
	}
}