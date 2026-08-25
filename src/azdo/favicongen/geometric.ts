export async function setGeometricFavicon(input: string): Promise<string> {
	// Hash the input so tiny input changes produce very different results.
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest("SHA-256", data);
	const b = Array.from(new Uint8Array(digest));

	// Use a deliberately limited palette so colors stay visually distinct.
	const palette = [
		"#E53935", // red
		"#D81B60", // pink
		"#8E24AA", // purple
		"#5E35B1", // deep purple
		"#3949AB", // indigo
		"#1E88E5", // blue
		"#039BE5", // light blue
		"#00897B", // teal
		"#43A047", // green
		"#7CB342", // lime green
		"#F9A825", // yellow
		"#FB8C00", // orange
		"#F4511E", // deep orange
		"#6D4C41", // brown
		"#546E7A", // blue gray
		"#263238"  // dark gray
	];

	const pick = <T>(byte: number, array: T[]): T => array[byte % array.length];

	const background = pick(b[0], palette);

	// Pick foreground colors different from the background.
	const foregroundPalette = palette.filter(c => c !== background);

	const color1 = pick(b[1], foregroundPalette);
	const color2 = pick(b[2], foregroundPalette);

	// High contrast accent.
	const accent = b[3] % 2 === 0 ? "#FFFFFF" : "#111111";

	const shapes = [
		"circle",
		"square",
		"diamond",
		"triangle",
		"ring",
		"bar",
		"chevron"
	];

	const shape1 = pick(b[4], shapes);
	const shape2 = pick(b[5], shapes);

	function makeShape(
		type: string,
		offset: number,
		color: string,
		opacity = 1,
	): string {
		const cx = 8 + (b[offset] % 17);
		const cy = 8 + (b[offset + 1] % 17);

		const size = 6 + (b[offset + 2] % 8);
		const rotation = (b[offset + 3] % 8) * 45;

		switch (type) {
			case "circle":
				return `
					<circle
						cx="${cx}"
						cy="${cy}"
						r="${size / 2}"
						fill="${color}"
						opacity="${opacity}"
					/>
				`;

			case "square":
				return `
					<rect
						x="${cx - size / 2}"
						y="${cy - size / 2}"
						width="${size}"
						height="${size}"
						rx="1.5"
						fill="${color}"
						opacity="${opacity}"
						transform="rotate(${rotation} ${cx} ${cy})"
					/>
				`;

			case "diamond":
				return `
					<rect
						x="${cx - size / 2}"
						y="${cy - size / 2}"
						width="${size}"
						height="${size}"
						rx="1"
						fill="${color}"
						opacity="${opacity}"
						transform="rotate(${45 + rotation} ${cx} ${cy})"
					/>
				`;

			case "triangle": {
				const half = size / 2;

				return `
					<polygon
						points="
							${cx},${cy - half}
							${cx + half},${cy + half}
							${cx - half},${cy + half}
						"
						fill="${color}"
						opacity="${opacity}"
						transform="rotate(${rotation} ${cx} ${cy})"
					/>
				`;
			}

			case "ring":
				return `
					<circle
						cx="${cx}"
						cy="${cy}"
						r="${size / 2}"
						fill="none"
						stroke="${color}"
						stroke-width="3"
						opacity="${opacity}"
					/>
				`;

			case "bar":
				return `
					<rect
						x="${cx - size / 2}"
						y="${cy - 2}"
						width="${size}"
						height="4"
						rx="2"
						fill="${color}"
						opacity="${opacity}"
						transform="rotate(${rotation} ${cx} ${cy})"
					/>
				`;

			case "chevron": {
				const half = size / 2;

				return `
					<path
						d="
							M ${cx - half} ${cy - half}
							L ${cx} ${cy + half}
							L ${cx + half} ${cy - half}
						"
						fill="none"
						stroke="${color}"
						stroke-width="3"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity="${opacity}"
						transform="rotate(${rotation} ${cx} ${cy})"
					/>
				`;
			}

			default:
				return "";
		}
	}

	const svg = `
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 32 32">

			<!-- Background -->
			<rect
				width="32"
				height="32"
				rx="6"
				fill="${background}"
			/>

			<!-- Large underlying shape -->
			${makeShape(shape1, 6, color1, 0.95)}

			<!-- Second geometric feature -->
			${makeShape(shape2, 12, color2, 0.95)}

			<!-- Hash-controlled accent slash -->
			<line
				x1="${2 + (b[18] % 8)}"
				y1="${2 + (b[19] % 8)}"
				x2="${22 + (b[20] % 8)}"
				y2="${22 + (b[21] % 8)}"
				stroke="${accent}"
				stroke-width="2.5"
				stroke-linecap="round"
				opacity="0.9"
			/>

		</svg>
	`;

	const faviconUrl =
		"data:image/svg+xml," + encodeURIComponent(svg);

	// Remove existing favicon definitions.
	document
		.querySelectorAll(
			'link[rel="icon"], link[rel="shortcut icon"]'
		)
		.forEach(link => link.remove());

	// Add generated SVG favicon.
	const link = document.createElement("link");

	link.rel = "icon";
	link.type = "image/svg+xml";
	link.href = faviconUrl;

	document.head.appendChild(link);

	return svg;
}