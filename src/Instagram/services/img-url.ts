export function sanitizeImgUrl(url: string): string {
	const len = url.indexOf("?");
	return len < 0 ? url : url.substring(0, len);
}
