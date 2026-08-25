export async function setSquiggleFavicon(input: string): Promise<string> {
	// SHA-256 the input so even a tiny input change produces
	// dramatically different SVG parameters.
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	const bytes = Array.from(new Uint8Array(digest));

	// Convert byte to a coordinate with some padding from the edges.
	const coord = (b: number): number => 3 + (b / 255) * 26;

	// Generate a vivid HSL color.
	const color = (index: number, saturation = 80, lightness = 55): string => {
		const hue = Math.round((bytes[index] / 255) * 360);
		return `hsl(${hue} ${saturation}% ${lightness}%)`;
	};

	const background = color(0, 70, 35);

	// Make each curve travel from roughly left to right,
	// while the hash controls all the vertical movement
	// and control points.
	function makeCurve(offset: number): string {
		const startY = coord(bytes[offset]);
		const cp1X   = coord(bytes[offset + 1]);
		const cp1Y   = coord(bytes[offset + 2]);
		const cp2X   = coord(bytes[offset + 3]);
		const cp2Y   = coord(bytes[offset + 4]);
		const endY   = coord(bytes[offset + 5]);

		return `
			M 1 ${startY}
			C ${cp1X} ${cp1Y},
			  ${cp2X} ${cp2Y},
			  31 ${endY}
		`;
	}

	const svg = `
		<svg xmlns="http://www.w3.org/2000/svg"
			 viewBox="0 0 32 32">

			<rect
				width="32"
				height="32"
				rx="6"
				fill="${background}"
			/>

			<path
				d="${makeCurve(1)}"
				fill="none"
				stroke="${color(20, 95, 65)}"
				stroke-width="3"
				stroke-linecap="round"
			/>

			<path
				d="${makeCurve(7)}"
				fill="none"
				stroke="${color(21, 90, 70)}"
				stroke-width="2.5"
				stroke-linecap="round"
			/>

			<path
				d="${makeCurve(13)}"
				fill="none"
				stroke="${color(22, 85, 75)}"
				stroke-width="2"
				stroke-linecap="round"
			/>

		</svg>
	`;

	const faviconUrl =
		"data:image/svg+xml," + encodeURIComponent(svg);

	// Remove existing favicon declarations.
	document
		.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]')
		.forEach(link => link.remove());

	// Install our favicon.
	const link = document.createElement("link");
	link.rel = "icon";
	link.type = "image/svg+xml";
	link.href = faviconUrl;

	document.head.appendChild(link);

	// Return SVG in case you want to inspect/use it elsewhere.
	return svg;
}