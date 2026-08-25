export async function setRuneFavicon(input) {
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

	const background = palette[b[0] % palette.length];
	const stroke = b[1] % 2 === 0 ? "#FFFFFF" : "#111111";

	// A deliberately small grid gives the glyph a strong,
	// logo-like structure instead of looking like random noise.
	const grid = [
		[5, 5],  [16, 5],  [27, 5],
		[5, 16], [16, 16], [27, 16],
		[5, 27], [16, 27], [27, 27]
	];

	const point = (byte) => grid[byte % grid.length];

	// Choose a series of anchor points.
	const p1 = point(b[2]);
	const p2 = point(b[3]);
	const p3 = point(b[4]);
	const p4 = point(b[5]);
	const p5 = point(b[6]);

	// A second stroke gives the rune more personality.
	const q1 = point(b[7]);
	const q2 = point(b[8]);
	const q3 = point(b[9]);

	const mainPath = `
		M ${p1[0]} ${p1[1]}
		L ${p2[0]} ${p2[1]}
		L ${p3[0]} ${p3[1]}
		L ${p4[0]} ${p4[1]}
		L ${p5[0]} ${p5[1]}
	`;

	const secondaryPath = `
		M ${q1[0]} ${q1[1]}
		L ${q2[0]} ${q2[1]}
		L ${q3[0]} ${q3[1]}
	`;

	const svg = `
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32">

			<rect
				width="32"
				height="32"
				rx="6"
				fill="${background}"
			/>

			<path
				d="${mainPath}"
				fill="none"
				stroke="${stroke}"
				stroke-width="4"
				stroke-linecap="round"
				stroke-linejoin="round"
			/>

			<path
				d="${secondaryPath}"
				fill="none"
				stroke="${stroke}"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.85"
			/>

			${
				b[10] % 2 === 0
					? `
					<circle
						cx="${grid[b[11] % grid.length][0]}"
						cy="${grid[b[11] % grid.length][1]}"
						r="2.5"
						fill="${stroke}"
					/>
					`
					: ""
			}

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