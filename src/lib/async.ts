export function delayAsync(ms: number, signal?: AbortSignal): Promise<void> {
	if (signal?.aborted) return Promise.resolve();

	return new Promise((resolve) => {
		const timeoutId = setTimeout(resolve, ms);
		signal?.addEventListener( "abort", () => { 
			clearTimeout(timeoutId); 
			resolve(); }, 
			{ once: true }
		);
	});
}
