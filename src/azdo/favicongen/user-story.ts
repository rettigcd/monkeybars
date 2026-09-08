const userStorySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -352 448 384"><path fill="#0078D4" d="M320 32Q301 32 279 28Q254 23 240 15V328Q253 339 278 346Q300 352 320 352H384V32ZM128 0H32V320H0V-32H208L205 -27Q200 -21 192 -16Q182 -9 168 -5Q150 0 128 0ZM64 352V32H128Q147 32 169 28Q194 23 208 15V328Q195 339 170 346Q148 352 128 352ZM416 320V0H320Q298 0 281 -5Q267 -9 256 -16Q249 -21 244 -27L240 -32H448V320Z" transform="scale(1,-1)"/></svg>`;

export function setUserStoryFavicon(): string {
	document
		.querySelectorAll(
			'link[rel="icon"], link[rel="shortcut icon"]'
		)
		.forEach(link => link.remove());

	const link = document.createElement("link");
	link.rel = "icon";
	link.type = "image/svg+xml";
	link.href = "data:image/svg+xml," + encodeURIComponent(userStorySvg);

	document.head.appendChild(link);

	return userStorySvg;
}
