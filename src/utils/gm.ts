declare function GM_download(details: {
	url: string;
	name: string;
	onload?: () => void;
	onerror?: (error: unknown) => void;
	onprogress?: (event: { loaded: number; total: number }) => void;
	ontimeout?: (event: unknown) => void;
}): void;

declare function GM_openInTab(url: string): void;

export type GMProgressHandler = (event: ProgressEvent<EventTarget>) => void;

export interface GMDownloadAsyncArgs {
	url: string;
	name: string;
	onprogress?: GMProgressHandler;
}

export interface GMApi {

	// Native
	download(details: {
		url: string;
		name: string;
		onload?: () => void;
		onerror?: (error: unknown) => void;
		onprogress?: GMProgressHandler;
		ontimeout?: (event: unknown) => void;
	}): void;

	openInTab(url: string): void;

	// New! - Convenience
	downloadAsync(args: GMDownloadAsyncArgs): Promise<void>;	
}

export const GM: GMApi = {
	download: GM_download,
	openInTab: GM_openInTab,

	// Downloads a file using GM.download with optional progress tracking.
	// Used as a wrapper to standardize async download handling.
	async downloadAsync({ url, name, onprogress }: {url:string,name:string, onprogress?:GMProgressHandler}) {
		console.debug("GM.download:", { url, name });
		await new Promise<void>((resolve, reject) => {
			const onload = () => resolve();
			const onerror = (error: unknown) => reject(error);
			const ontimeout = (_event: unknown) => reject({ error: "timeout" });
			GM.download({ url, name: name, onload, onerror, onprogress, ontimeout });
		});
	}

};
