export type GMProgressHandler = (event: ProgressEvent<EventTarget>) => void;

export type GMDownloadArgs = {
	url: string;
	name: string;
	timeout?: number;
	onload?: () => void;
	onerror?: (error: unknown) => void;
	onprogress?: GMProgressHandler;
	ontimeout?: (event: unknown) => void;
};

export interface GMDownloadAsyncArgs { url: string; name: string; timeout?: number; onprogress?: GMProgressHandler; }

export interface GMApi {

	// Native
	download(details: GMDownloadArgs): void;
	openInTab(url: string): void;

	// New! - Convenience
	downloadAsync(args: GMDownloadAsyncArgs): Promise<void>;	
}

// Declare the GM_ download functions
declare global {
	function GM_download(details: GMDownloadArgs): void;
	function GM_openInTab(url: string): void;
}

function hasGMDownload(): boolean { return typeof globalThis.GM_download === "function"; }
function hasGMOpenInTab(): boolean { return typeof globalThis.GM_openInTab === "function"; }

function browserDownloadViaLink(details: GMDownloadArgs): void {

	const { url, name, onload } = details;
	console.debug('Saving image',{url,name});
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.target = "_blank";
	link.rel = "noopener noreferrer";	
	link.style.display = "none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	onload?.();
}

export function browserDownloadViaFetch(details: GMDownloadArgs): void {
	const { url, name, onload, onerror } = details;

	void (async () => {
		try {
			const response = await fetch(url);

			if (!response.ok)
				throw new Error(`HTTP ${response.status}`);

			const blob = await response.blob();
			const blobUrl = URL.createObjectURL(blob);

			try {
				const link = document.createElement("a");
				link.href = blobUrl;
				link.download = name;
				link.style.display = "none";

				document.body.appendChild(link);
				link.click();
				link.remove();

				onload?.();
			}
			finally {
				URL.revokeObjectURL(blobUrl);
			}
		}
		catch (error) {
			onerror?.(error);
		}
	})();
}


function download(details: GMDownloadArgs): void {
	if (hasGMDownload())
		globalThis.GM_download(details);
	else
		browserDownloadViaLink(details);
}

function openInTab(url: string): void {
	if (hasGMOpenInTab())
		globalThis.GM_openInTab(url);
	else
		globalThis.open(url, "_blank");
}

export class DownloadError extends Error {
	constructor(
		message: string,
		public readonly details?: unknown
	){
		super(message);
		this.name = "DownloadError";
		Object.setPrototypeOf(this, DownloadError.prototype);
	}
}

export class DownloadTimeoutError extends DownloadError {
	constructor(){
		super("Download timed out");
		this.name = "DownloadTimeoutError";
		Object.setPrototypeOf(this, DownloadTimeoutError.prototype);
	}
}

export const GM: GMApi = {
	download,
	openInTab,

	// Downloads a file using GM.download with optional progress tracking.
	// Used as a wrapper to standardize async download handling.
	async downloadAsync({ url, name, timeout = 5000, onprogress }: GMDownloadAsyncArgs) {
		console.debug("GM.download:", { url, name });
		await new Promise<void>((resolve, reject) => {
			const onload = () => resolve();
			const onerror = (error: unknown) => reject(new DownloadError("Download failed", error));
			const ontimeout = () => reject(new DownloadTimeoutError());
			download({url,name,timeout,onload,onerror,onprogress,ontimeout});
		});
	},
};
