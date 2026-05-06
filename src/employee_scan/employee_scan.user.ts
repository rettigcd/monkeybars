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

import { delayAsync } from "~/lib/async";
import { type EmployeeDirectory, getEmployeeDictAsync } from "./data-source";
import { activeIvyIds, registerIds } from "./ids";
import { store } from "./store";
import { appendEmployeeAsync, clearEmployees } from "./ui";


declare global {
	var employeeData: EmployeeDirectory | undefined;
	var scanEmployeesAsync: (start: number, count?: number) => Promise<void>;
	var showEmployeesByIdAsync: (ids?: number[] | null) => Promise<void>;
}

registerIds(globalThis);

async function showEmployeesByIdAsync(ids: number[] | null = null): Promise<void> {
	ids = ids || activeIvyIds;
	clearEmployees();
	for (const id of ids) {
		await appendEmployeeAsync(id);
		await delayAsync(250);
	}
}

export async function scanEmployeesAsync(start: number, count = 100): Promise<void> {
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

//=============================
//====  Employee-Specific  ====
//=============================

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
