export async function setMosaicFavicon(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	const b = Array.from(new Uint8Array(digest));

	const palette = [
		"#E53935",
		"#D81B60",
		"#8E24AA",
		"#5E35B1",
		"#3949AB",
		"#1E88E5",
		"#039BE5",
		"#00897B",
		"#43A047",
		"#7CB342",
		"#F9A825",
		"#FB8C00",
		"#F4511E",
		"#6D4C41",
		"#546E7A",
		"#263238"
	];

	const pick = <T>(byte: number, array: T[]): T => array[byte % array.length];

	// Pick four distinct colors.
	const colors: string[] = [];

	for (let i = 0; i < b.length && colors.length < 4; i++) {
		const color = pick(b[i], palette);

		if (!colors.includes(color)) {
			colors.push(color);
		}
	}

	// Safety fallback, though SHA-256 should give us plenty of variation.
	while (colors.length < 4) {
		colors.push(palette[colors.length]);
	}

	/*
		Generate two hash-controlled intersection points.

		This keeps the mosaic visually bold and readable at favicon size,
		while still allowing the hash to substantially alter the layout.
	*/

	const centerX = 10 + (b[8] % 13);   // 10..22
	const centerY = 10 + (b[9] % 13);   // 10..22

	const topX    = 4 + (b[10] % 25);   // 4..28
	const bottomX = 4 + (b[12] % 25);
	const leftY   = 4 + (b[13] % 25);

	const svg = `
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32">

			<rect
				width="32"
				height="32"
				rx="6"
				fill="${colors[0]}"
			/>

			<!-- Top region -->
			<polygon
				points="
					0,0
					32,0
					${topX},${centerY}
					${centerX},${centerY}
					0,${leftY}
				"
				fill="${colors[1]}"
			/>

			<!-- Right region -->
			<polygon
				points="
					32,0
					32,32
					${bottomX},${centerY}
					${centerX},${centerY}
					${topX},${centerY}
				"
				fill="${colors[2]}"
			/>

			<!-- Bottom-left region -->
			<polygon
				points="
					0,${leftY}
					${centerX},${centerY}
					${bottomX},${centerY}
					32,32
					0,32
				"
				fill="${colors[3]}"
			/>

			<!-- Hash-controlled diagonal shard -->
			<polygon
				points="
					${b[14] % 12},0
					${12 + (b[15] % 12)},0
					${32},${20 + (b[16] % 12)}
					${32},${28 + (b[17] % 4)}
				"
				fill="${colors[b[18] % colors.length]}"
				opacity="0.8"
			/>

		</svg>
	`;

	const faviconUrl =
		"data:image/svg+xml," + encodeURIComponent(svg);

	document
		.querySelectorAll(
			'link[rel="icon"], link[rel="shortcut icon"]'
		)
		.forEach(link => link.remove());

	const link = document.createElement("link");

	link.rel = "icon";
	link.type = "image/svg+xml";
	link.href = faviconUrl;

	document.head.appendChild(link);

	return svg;
}