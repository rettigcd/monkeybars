
export type WaitStatus = {
	attempt: number;
	count: number | "?";
};

export type ShowAppearWaitResult = {
	reason: string;     // reason for the result
	attempts?: number;   // # of attempts to find the show
	showCount?: number; // # of shows found
	duration?: number;  // How long it took.
};

// Watches for shows to appear
export interface ShowWatcher {
	watch(signal:AbortSignal): Promise<{ reason: string}>;
}

// Orchestrates N ShowWatchers
export class ShowAppearWaiter {

	private readonly watchers: ShowWatcher[];

	public constructor( watchers: ShowWatcher[]) {
		this.watchers = watchers;
	}

	public async waitForShowsToAppearAsync(): Promise<ShowAppearWaitResult> {

		const startedAt = Date.now();
		const controller = new AbortController();
		const { signal } = controller;

		const result = await Promise.race( 
			this.watchers.map( watcher => watcher.watch(signal) ) 
		);

		controller.abort(result.reason);

		// !!! just return whatever the race result was
		return {
			reason: result.reason,
			attempts: 0,
			showCount: 0,
			duration: Date.now() - startedAt,
		};
	}

}
