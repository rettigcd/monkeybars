// ==UserScript==
// @name         Instagram 4
// @namespace    http://tampermonkey.net/
// @version      4
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/employee_Scan.user.js
// @match        https://www.instagram.com/*
// @exclude      https://www.instagram.com/p/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_download
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

import { $, $qAll, ElementBuilder } from "~/lib/dom3";
import { CachedPersistentArray } from "~/lib/storage";
import { registerIds } from "./ids";

// ====================================
// Snippet for showing employees photos
// ====================================

// =========================
// ====  Generic Stuff  ====
// =========================

type Employee = {
	employeeId: number;
	fullName?: string;
	location?: string;
	mobilePhone?: string;
	startDate?: string;
	lastWorkDate?: string;
};

type EmployeeListResponse = {
	content: Employee[];
};

type EmployeeDict = Record<number, Employee>;

declare global {
	var employeeData: EmployeeDict | undefined;
	var scanEmployeesAsync: (start: number, count?: number) => Promise<void>;
	var showEmployeesByIdAsync: (ids?: number[] | null) => Promise<void>;
}

registerIds(globalThis);

// Loading Image - async
async function loadImageAsync(
	img: HTMLImageElement,
	src: string,
	timeoutMs = 500,
): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const timerId = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);

		img.onload = () => {
			clearTimeout(timerId);
			resolve(img);
		};

		img.onerror = (err) => {
			clearTimeout(timerId);
			reject(err);
		};

		img.src = src;
	});
}

// Delay
async function delayAsync(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function downloadImageAsync(
	source: string | HTMLImageElement,
	filename?: string | null,
): Promise<void> {
	const url = typeof source === "string"
		? source
		: source instanceof HTMLImageElement
			? source.currentSrc || source.src
			: (() => { throw new Error("Unsupported image source."); })();

	filename ??= (() => {
		try {
			return new URL(url).pathname.split("/").pop() || null;
		} catch {
			return null;
		}
	})();

	// Fetch image as a blob to support cross-origin downloads
	const response = await fetch(url);
	if (!response.ok) throw new Error("Failed to fetch image");
	const blob = await response.blob();
	const objectUrl = URL.createObjectURL(blob);

	// Create a temporary download link
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename || "image";
	document.body.appendChild(a);
	a.click();

	// Cleanup
	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}

//=============================
//====  Employee-Specific  ====
//=============================


const goodIds = new CachedPersistentArray("goods");

const store = {
	saveGoodId(id: number): void {
		goodIds.add(String(id));
		console.log("savenum", id);
	},

	set maxEmployeeId(id: number) {
		localStorage["maxEmployeeId"] = String(id);
	},

	get maxEmployeeId(): number {
		return Number(localStorage["maxEmployeeId"] || 0);
	},
};

async function appendEmployeeAsync(id: number): Promise<void> {
	const { div, img } = buildEmployeeCard(id);

	div.appendTo(document.body);

	try {
		await loadImageAsync(img.el, `https://intranetapps.tql.com/api/photo/photos/${id}`);
	} catch {
		// Missing employee photos are expected while scanning IDs.
	}
}

function buildEmployeeCard(id: number): {
	div: ElementBuilder<HTMLDivElement>;
	img: ElementBuilder<HTMLImageElement>;
} {
	const img = $("img")
		.css({ width: "120px" })
		.on("click", async (e) => {
			const clickedImg = e.currentTarget as HTMLImageElement;
			store.saveGoodId(id);
			await downloadImageAsync(clickedImg);
			clickedImg.style.opacity = "0.4";
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

function clearEmployees(): void {
	$qAll<HTMLDivElement>("div.emp").forEach(el => el.remove());
}

async function showEmployeesByIdAsync(ids: number[] | null = null): Promise<void> {
	ids = ids || activeIvyIds;
	clearEmployees();
	for (const id of ids) {
		await appendEmployeeAsync(id);
		await delayAsync(250);
	}
}

async function scanEmployeesAsync(start: number, count = 100): Promise<void> {
	clearEmployees();
	const end = start + count;
	for (let employeeId = start; employeeId < end; ++employeeId) {
		if (globalThis.employeeData?.[employeeId] === undefined) continue;
		if (store.maxEmployeeId < employeeId) store.maxEmployeeId = employeeId;
		await appendEmployeeAsync(employeeId);
		await delayAsync(400);
		console.debug("employee added");
	}
	console.log(`${start} .. ${start + count - 1} complete`);
}

// Loads Data-Dictionary
async function getEmployeeDictAsync(): Promise<EmployeeDict> {
	const resp = await fetch("https://intranetapps.tql.com/api/extensionlist/employees/list");
	const json = await resp.json() as EmployeeListResponse;
	const dict: EmployeeDict = {};
	json.content.forEach(emp => dict[emp.employeeId] = emp);
	return dict;
}

void (async function (): Promise<void> {
	globalThis.employeeData = await getEmployeeDictAsync();
	globalThis.scanEmployeesAsync = scanEmployeesAsync;
	globalThis.showEmployeesByIdAsync = showEmployeesByIdAsync;

	function foo(str: string): void {
		queueMicrotask(console.log.bind(console, `%c${str}`, "color:#00c;font-style:italic;font-weight:800;"));
	}

	foo("activeIds = [...]");
	foo("terminatedIds = [...]");
	foo("scanEmployeesAsync(start,count=100);");
	foo("showEmployeesByIdAsync(ids=null);");

	const lastEmployee = Object.values(globalThis.employeeData).pop();
	foo(`Last employee: ${lastEmployee?.employeeId ?? "?"}, Last scanned:${store.maxEmployeeId}`);

	queueMicrotask(console.log.bind(console, "%cemployee_scan.ts initialized", "background-color:#DFD")); // Last line of file
})();

export { };

