import { $, $q, $qAll, ElementBuilder, loadImgSrcAsync } from "~/lib/dom3";
import { type Employee } from "./data-source";
import { downloadImageAsync } from "./download";
import { savedEmployeeFields, store } from "./store";


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

//=============================
//====      Table          ====
//=============================

const thCss: Partial<CSSStyleDeclaration> = {
	border: "thin solid gray",
	padding: "2px 6px",
	textAlign: "left",
	background: "#eee",
};

const tdCss: Partial<CSSStyleDeclaration> = {
	border: "thin solid gray",
	padding: "2px 6px",
};

export function renderEmployeeTable(employees: Employee[]): void {
	renderTable("employeeTable", null, employees, savedEmployeeFields);
}

export function renderTerminatedTable(employees: Employee[]): void {
	renderTable("terminatedTable", "terminated", employees, terminatedTableFields);
}

const terminatedTableFields = ["firstName", "lastName", "employeeId", "location", "startDate", "lastWorkDate"] as const satisfies readonly (keyof Employee)[];

function renderTable(id: string, title: string | null, employees: Employee[], fields: readonly (keyof Employee)[]): void {
	$q(`#${id}`)?.remove();

	const headerCells = [
		...fields.map(field => $("th").txt(field).css(thCss)),
		$("th").txt("show-pic").css(thCss),
	];

	const tbody = $("tbody").withChildren(...sortEmployees(employees).map(emp => buildEmployeeRow(emp, fields)));

	const table = $("table")
		.css({ borderCollapse: "collapse", fontSize: "0.75rem" })
		.withChildren(
			$("thead").withChildren($("tr").withChildren(...headerCells)),
			tbody
		);

	const container = $("div").attr("id", id);
	if (title) container.withChildren($("h2").txt(title));
	container.withChildren(table).appendTo(document.body);
}

// TERM employees sort to the bottom; within each group, sort by employeeId.
function sortEmployees(employees: Employee[]): Employee[] {
	return [...employees].sort((a, b) => {
		const termDiff = Number(a.statusCode === "TERM") - Number(b.statusCode === "TERM");
		if (termDiff !== 0) return termDiff;
		return Number(a.employeeId) - Number(b.employeeId);
	});
}

const noLastWorkDate = "1900-01-01T00:00:00";

function buildEmployeeRow(emp: Employee, fields: readonly (keyof Employee)[]): ElementBuilder<HTMLTableRowElement> {
	const dataCells = fields.map(field => $("td").txt(formatCell(field, emp[field])).css(tdCss));
	return $("tr").withChildren(...dataCells, buildShowPicCell(emp.employeeId));
}

const dateFields: readonly (keyof Employee)[] = ["startDate", "lastWorkDate"];

function formatCell(field: keyof Employee, value: unknown): string {
	if (field === "lastWorkDate" && value === noLastWorkDate) return "";
	if (value == null) return "";
	return dateFields.includes(field) ? String(value).slice(0, 10) : String(value);
}

function buildShowPicCell(employeeId: string): ElementBuilder<HTMLTableCellElement> {
	const cell = $("td").css(tdCss);
	const link = $("a")
		.attr("href", "#")
		.txt("show pic")
		.css({ cursor: "pointer" });

	link.on("click", async (e) => {
		e.preventDefault();
		const img = $("img").css({ width: "80px" });
		try {
			await loadImgSrcAsync(img.el, `https://intranetapps.tql.com/api/photo/photos/${employeeId}`, 5000);
			cell.el.replaceChildren(img.el);
		} catch {
			link.txt("no photo");
		}
	});

	return cell.withChildren(link);
}
