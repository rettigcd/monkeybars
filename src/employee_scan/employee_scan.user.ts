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
import { groupBy } from "~/lib/sorting";
import { throwExp } from "~/lib/throw";
import { type Employee, type EmployeeDirectory, getEmployeeDictAsync } from "./data-source";
import { ids } from "./ids";
import { store } from "./store";
import { appendEmployeeAsync, clearEmployees } from "./ui";


declare global {
	var employeeData: EmployeeDirectory | undefined;
	var scanEmployeesAsync: (start: number, count?: number) => Promise<void>;
	var showEmployeesByIdAsync: (ids?: number[] | null) => Promise<void>;
	var saveEmployees: (ids:number[]) => void;
	var groups: any;

	var ivy2f3_marketing: number[];
	var ivy2f3_it: number[];
	var ivy1f4: number[];
	var miscIds: number[];
	var activeIvyIds: number[];
	var ids: any; // I'm to lazy to type these.
}

globalThis.ids = ids;

// Displays Employees from the DataSource (json)
async function showEmployeesByIdAsync(ids: number[] | null = null): Promise<void> {
	ids = ids || activeIvyIds;
	clearEmployees();
	for (const id of ids) {
		const emp:Employee|undefined = globalThis.employeeData?.[id];
		await appendEmployeeAsync(id,emp);
		await delayAsync(250);
	}
}

// Displays Employees from the DataSource (json)
async function scanEmployeesAsync(start: number, count = 100): Promise<void> {
	clearEmployees();
	const end = start + count;
	for (let employeeId = start; employeeId < end; ++employeeId) {
		if (globalThis.employeeData?.[employeeId] === undefined) continue;
		if (store.maxEmployeeId < employeeId) store.maxEmployeeId = employeeId;
		const emp:Employee|undefined = employeeDirectory()[employeeId];
		await appendEmployeeAsync(employeeId,emp);
		await delayAsync(400);
		console.debug("employee added");
	}
	console.log(`${start} .. ${start + count - 1} complete`);
}

function employeeDirectory() : EmployeeDirectory {
	return globalThis.employeeData || throwExp("No employee data available.");
}

function saveEmployees(ids:number[]){
	const dir = employeeDirectory();
	for (const id of ids) {
		const emp:Employee|undefined = dir[id];
		if(emp != undefined)
			store.saveEmployee(emp);
	}
}

//=============================
//====  Employee-Specific  ====
//=============================

void (async function (): Promise<void> {
	globalThis.employeeData = await getEmployeeDictAsync();
	globalThis.scanEmployeesAsync = scanEmployeesAsync;
	globalThis.showEmployeesByIdAsync = showEmployeesByIdAsync;
	globalThis.saveEmployees = saveEmployees;
	globalThis.groups = groupBy<Employee,string>(Object.values(globalThis.employeeData),x=>x.dept);

	function foo(str: string): void {
		queueMicrotask(console.log.bind(console, `%c${str}`, "color:#00c;font-style:italic;font-weight:800;"));
	}

	foo("activeIds = [...]");
	foo("terminatedIds = [...]");
	foo("scanEmployeesAsync(start,count=100);");
	foo("showEmployeesByIdAsync(ids=null);");
	foo("saveEmployees([...])");

	const lastEmployee = Object.values(globalThis.employeeData).pop();
	foo(`Last employee: ${lastEmployee?.employeeId ?? "?"}, Last scanned:${store.maxEmployeeId}`);

	queueMicrotask(console.log.bind(console, "%cemployee_scan.ts initialized", "background-color:#DFD")); // Last line of file
})();
