export function log(scope: string, message: string, ...details: unknown[]): void {
	console.log(`[${scope}] ${message}`, ...details);
}
