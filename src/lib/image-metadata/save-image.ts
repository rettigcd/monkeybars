import { saveBytesToFile } from "../download";
import { isJpeg, jpegSize, type KeiblerMetadata, writeJpegMetadata } from "./keibler-metadata";

export type ImageSize = { w: number; h: number };

// Fetches an image, embeds Keibler metadata and saves it via the browser.
// buildMetadata receives the pixel size (when known) so callers can compute tag rects.
// Returns false (nothing saved) if the image isn't a JPEG, so callers can fall back to a plain download.
// Throws on fetch/embed failure.
export async function saveImageWithMetadataAsync(
	url: string,
	filename: string,
	buildMetadata: KeiblerMetadata | ((size: ImageSize | undefined) => KeiblerMetadata),
): Promise<boolean> {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(`fetch ${response.status} ${response.statusText}`);
	const jpeg = new Uint8Array(await response.arrayBuffer());
	if (!isJpeg(jpeg))
		return false;
	const meta = typeof buildMetadata === "function" ? buildMetadata(jpegSize(jpeg)) : buildMetadata;
	saveBytesToFile(writeJpegMetadata(jpeg, meta), filename, "image/jpeg");
	return true;
}
