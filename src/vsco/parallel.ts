export type ParallelProgress = {
	loaded: number; // complete
	total: number; // total
}

export type ParallelProgressCallback = (progress:ParallelProgress) => void;

export function executePromisesInParallelAsync(
	asyncActions: (() => Promise<void>)[],
	parallelCount: number=8,
	progressCallback:ParallelProgressCallback=function(_:ParallelProgress){}
){
	const status = {loaded:0,total:asyncActions.length};
	progressCallback(status);

	asyncActions = asyncActions.slice(); // make copy so we can modify

	// this method will run all Promises until array is empty
	async function processAsync(){
		let action = asyncActions.shift();
		while(action !== undefined){
			try{
				await action();
			} catch (error) { console.log(error); }
			++status.loaded;
			progressCallback(status);
			action = asyncActions.shift(); // next
		}
	}

	const parallelExecutions = Array.from({length:parallelCount},()=>processAsync());
	return Promise.all( parallelExecutions );
}
