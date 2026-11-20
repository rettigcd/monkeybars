// Trophy glyph in Azure DevOps' Feature purple, transparent background.
const featureSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" shape-rendering="geometricPrecision"><g fill="#773B93"><path d="M6 3h12v6.5a6 6 0 0 1-12 0z"/><path d="M6 5H2.5v1.5A4.5 4.5 0 0 0 6.6 11l.4-1.6a3 3 0 0 1-2.9-2.9V6.6H6zM18 5h3.5v1.5A4.5 4.5 0 0 1 17.4 11L17 9.4a3 3 0 0 0 2.9-2.9V6.6H18z"/><path d="M10.5 15h3v3.5h-3z"/><path d="M7 18.5h10V21H7z"/></g></svg>`;

export function setFeatureFavicon(): string {
	document
		.querySelectorAll(
			'link[rel="icon"], link[rel="shortcut icon"]'
		)
		.forEach(link => link.remove());

	const link = document.createElement("link");
	link.rel = "icon";
	link.type = "image/svg+xml";
	link.href = "data:image/svg+xml," + encodeURIComponent(featureSvg);

	document.head.appendChild(link);

	return featureSvg;
}
