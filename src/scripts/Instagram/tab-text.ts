import { dom } from "./services/dom";

export function scheduleSetTabTitle(): void {
	Promise.all([
		getGoodTitleAsync(4000),
		getImageCountAsync( 2000 ),
	]).then(([title, count]) => {
		let runs = 7;
		function updateTitle(){
			document.title = `${getImageCountGroup(count)} ${title}`;
			if(--runs === 0) clearInterval(id);
		}
		updateTitle();
		const id = setInterval(updateTitle, 10000);
	});
}

// Resolves a "good" page title, retrying until one is found or timeout occurs.
// Used to avoid placeholder titles like "Instagram" during initial load.
function getGoodTitleAsync(timeoutAfter = 10000): Promise<string> {
	return new Promise<string>((resolve) => {
		function logAndResolve(val: string): void {
			console.debug("page title: " + val);
			resolve(val);
			window.clearInterval(intervalId);
		}

		const timeoutAt = Date.now() + timeoutAfter;
		const titleLog: string[] = [];

		const intervalId = window.setInterval(() => {
			const title = document.title;
			titleLog.push(title);

			if (title !== "" && title !== "Instagram")
				logAndResolve(title);
			else if (timeoutAt <= Date.now()){
				console.debug({titleLog});
				logAndResolve(dom.pageOwner);
			}

		}, 200);
	});
}

// Retrieves the number of images from the DOM, waiting until available or timeout.
// Used to extract gallery size information after page load.
function getImageCountAsync( timeoutAfter = 2000 ): Promise<number|undefined> {
	return new Promise<number|undefined>((resolve) => {
		const timeoutAt = Date.now() + timeoutAfter;

		const intervalId = window.setInterval(() => {
			const imageCountSpan = dom.imageCountSpan;
			if (imageCountSpan != null){
				resolve(Number(imageCountSpan.innerText));
				window.clearInterval(intervalId);
				return;
			}

			if (timeoutAt <= Date.now()){
				resolve(undefined);
				window.clearInterval(intervalId);
			}
		}, 500);
	});
}

// Buckets an image count into predefined size groups.
// Used for categorizing galleries by size ranges.
export function getImageCountGroup(count: number|undefined): string {
	if(count === undefined) return '?';
	const thresholds = [20, 50, 100, 200, 400, 1000];
	let i = 0;

	for (; i < thresholds.length; ++i)
		if (count < thresholds[i])
			break;

	return String(i);
}
