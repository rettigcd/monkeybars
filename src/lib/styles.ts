export function injectStyle(css: string): HTMLStyleElement {
	const style = document.createElement("style");
	style.textContent = css;
	document.head.appendChild(style);
	return style;
}
