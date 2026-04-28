
export type WaitStatus = {
	attempt: number;
	count: number | "?";
};

export type ShowAppearWaitResult = {
	reason: string;
	attempt: number;
	count: number | "?";
	duration: number;
};

export interface ShowWatcher {
	watch(signal:AbortSignal): Promise<{ reason: string}>;
}

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
			attempt: 0,
			count: 0,
			duration: Date.now() - startedAt,
		};
	}

}
