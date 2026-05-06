import { $, $qAll, ElementBuilder, loadImageAsync } from "~/lib/dom3";
import { downloadImageAsync } from "./download";
import { store } from "./store";


export function clearEmployees(): void {
	$qAll<HTMLDivElement>("div.emp").forEach(el => el.remove());
}

export async function appendEmployeeAsync(id: number): Promise<void> {
	const { div, img } = buildEmployeeCard(id);

	div.appendTo(document.body);

	try {
		await loadImageAsync(img.el, `https://intranetapps.tql.com/api/photo/photos/${id}`);
	} catch {
		// Missing employee photos are expected while scanning IDs.
	}
}

// Sync part of appendEmployee
function buildEmployeeCard(id: number): {
	div: ElementBuilder<HTMLDivElement>;
	img: ElementBuilder<HTMLImageElement>;
} {
	const img = $("img")
		.css({ width: "120px" })
		.on("click", async () => {
			store.saveGoodId(id);
			await downloadImageAsync(img.el);
			img.css({opacity:"0.4"});
		});

	const divCss: Partial<CSSStyleDeclaration> = {
		display: "inline-block",
		padding: "3px",
		border: "thin solid gray",
	};

	const div = $("div")
		.attr("id", `emp_${id}`)
		.cls("emp")
		.data("id", String(id))
		.css(divCss)
		.withChildren(img);

	const addLine = (text: string | number | null | undefined): void => {
		$("p")
			.txt(text == null ? "" : String(text))
			.css({ margin: "0px", padding: "1px" })
			.appendTo(div.el);
	};

	addLine(`${id}`);

	const emp = globalThis.employeeData?.[id];
	if (emp) {
		addLine(emp.fullName);
		addLine(emp.location);
		addLine(emp.mobilePhone);
		addLine(emp.startDate?.slice(0, 10));

		if (emp.lastWorkDate && emp.lastWorkDate !== "1900-01-01T00:00:00")
			addLine(emp.lastWorkDate.slice(0, 10));
	}

	return { div, img };
}
