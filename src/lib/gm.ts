import type { LTProgress, LTProgressHandler } from "./progress-types";
export type { LTProgress, LTProgressHandler };


// ============
// Clip board
// ============
declare function GM_setClipboard( data: string, info?: string | GMSetClipboardDetails, callback?: () => void ): void;

export type GMSetClipboardDetails = {
	type?: "text" | "html";
	mimetype?: string;
};

export function setClipboard( data: string, info?: string | GMSetClipboardDetails, callback?: () => void ):void {
	if(typeof GM_download === "function")
		GM_setClipboard(data, info, callback);
	else 
		navigator.clipboard.writeText(data).then(()=>callback?.()); // ! fallback doesn't use param: info
}

// =================
// Download
// =================
declare function GM_download(details: GMDownloadArgs): void;

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

function browserDownloadViaLink(details: GMDownloadArgs): void {
	const { url, name, onload } = details;
	console.debug('Saving image',{url,name});
	const link = document.createElement("a");
	Object.assign(link,{href:url,download:name,target:"_blank",rel:"noopener noreferrer"});
	link.style.display="none";
	document.body.appendChild(link);
	link.click();
	link.remove();
	onload?.();
}

// Prefer this one
export const download: (args:GMDownloadArgs)=>void = (typeof GM_download === "function")
	? GM_download
	: browserDownloadViaLink;

// Downloads a file using default download() with optional progress tracking.
// Used as a wrapper to standardize async download handling.
// onprogress -> only updates during the download, not before, not after
// errors/timeout -> throw exception 
export interface DownloadAsyncArgs { url: string; name: string; timeout?: number; onprogress?: LTProgressHandler; }
export async function downloadAsync({ url, name, timeout = 5000, onprogress }: DownloadAsyncArgs) {
	console.debug("GM.download:", { url, name });
	await new Promise<void>((resolve, reject) => {
		const onload = () => resolve();
		const onerror = (error: unknown) => reject(new DownloadError("Download failed", error));
		const ontimeout = () => reject(new DownloadTimeoutError());
		download({url,name,timeout,onload,onerror,onprogress,ontimeout});
	});
}

// Error / Timeout Exceptions
export class DownloadError extends Error {
	constructor( message: string, public readonly details?: unknown ){
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

// ====================
// Open in tab
// ====================
declare function GM_openInTab(url: string): void;

export const openInTab: (url:string)=>void = (typeof GM_openInTab === "function")
	? GM_openInTab
	: open;

// ====================
// Not used stuff 
// ====================

// fetch version
// exported so warning goes away.  I just can't bring myself to delete it.
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
