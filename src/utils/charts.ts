export type BarPart = {
	count: number;
	color: string;
	label: string;
};

export function makeStackedBar(parts: BarPart[]): HTMLDivElement {
	const total = parts.reduce((sum, p) => sum + p.count, 0);

	const container = document.createElement("div");
	container.style.display = "flex";
	container.style.width = "100%";
	container.style.height = "16px";
	container.style.borderRadius = "4px";
	container.style.overflow = "hidden";

	if (total === 0) {
		container.style.background = "#eee";
		container.title = "No data";
		return container;
	}

	for (const part of parts) {
		const percent = (part.count / total) * 100;

		const segment = document.createElement("div");
		segment.style.width = `${percent}%`;
		segment.style.backgroundColor = part.color;

		const pctStr = percent.toFixed(1);
		segment.title = `${part.label}: ${part.count} (${pctStr}%)`;

		container.appendChild(segment);
	}

	return container;
}
