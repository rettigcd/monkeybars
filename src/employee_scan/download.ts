// Non GM_ way doe download an image
// 1) fetches image as a blob
// 2) converts to object URL
// 3) create temporary download link & clicks it
export async function downloadImageAsync( source: string | HTMLImageElement, filename?: string | null ): Promise<void> {
	// get URL
	const url = typeof source === "string" ? source
		: source instanceof HTMLImageElement ? source.currentSrc || source.src
		: (() => { throw new Error("Unsupported image source."); })();

	const blob = await fetchBlobAsync(url);

	const objectUrl = URL.createObjectURL(blob);

	downloadObjectURL( objectUrl, filename || pickFilenameFromUrl(url) || "image");

	URL.revokeObjectURL(objectUrl);
}

async function fetchBlobAsync(url:string) : Promise<Blob> {
	const response = await fetch(url);
	if (!response.ok) throw new Error("Failed to fetch image");
	return await response.blob();
}

function pickFilenameFromUrl(url:string){
	try {
		return new URL(url).pathname.split("/").pop() || null;
	} catch {
		return null;
	}
}

function downloadObjectURL( objectUrl:string, filename:string ){
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();

	// Cleanup
	document.body.removeChild(a);
}
