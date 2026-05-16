import { $, $qAll, ElementBuilder, loadImgSrcAsync } from "~/lib/dom3";
import { type Employee } from "./data-source";
import { downloadImageAsync } from "./download";
import { store } from "./store";


export function clearEmployees(): void {
	$qAll<HTMLDivElement>("div.emp").forEach(el => el.remove());
}

export async function appendEmployeeAsync(employeeId:number, employee?: Employee): Promise<void> {
	const { div, img } = buildEmployeeCard(employeeId, employee);

	div.appendTo(document.body);

	try {
		await loadImgSrcAsync(img.el, `https://intranetapps.tql.com/api/photo/photos/${employeeId}`, 5000);
	} catch {
		// Missing employee photos are expected while scanning IDs.
	}
}

// Sync part of appendEmployee
function buildEmployeeCard(employeeId:number, emp?: Employee): {
	div: ElementBuilder<HTMLDivElement>;
	img: ElementBuilder<HTMLImageElement>;
} {

	const divCss: Partial<CSSStyleDeclaration> = {
		display: "inline-block",
		padding: "3px",
		border: "thin solid gray",
	};

	const img = $("img").css({ width: "120px" });
	const div = $("div")
		.attr("id", `emp_${employeeId}`)
		.cls("emp")
		.data("id", String(employeeId))
		.css(divCss)
		.withChildren(img);

	function addLine(text: string | number | null | undefined): void {
		$("p")
			.txt(text == null ? "" : String(text))
			.css({ margin: "0px", padding: "1px" })
			.appendTo(div.el);
	};

	addLine(`${employeeId}`);

	if (emp) {
		img.on("click", async () => {
			store.saveEmployee(emp);
			await downloadImageAsync(img.el);
			img.css({opacity:"0.4"});
		});

		addLine(`${emp.firstName} ${emp.lastName}`);
		addLine(emp.location);
		addLine(emp.mobilePhone);
		addLine(emp.startDate?.slice(0, 10));

		if (emp.lastWorkDate && emp.lastWorkDate !== "1900-01-01T00:00:00")
			addLine(emp.lastWorkDate.slice(0, 10));
	}

	return { div, img };
}
