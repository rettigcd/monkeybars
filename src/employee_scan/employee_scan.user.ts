// ==UserScript==
// @name         Employees Phone List
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Tracks Employee info
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeybars]/employee_scan.user.js
// @match        https://intranetapps.tql.com/extensionlist/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tql.com
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
import { appendEmployeeAsync, clearEmployees, renderEmployeeTable, renderTerminatedTable } from "./ui";


declare global {
	var employeeData: EmployeeDirectory | undefined;
	var scanEmployeesAsync: (start: number, count?: number) => Promise<void>;
	var showEmployeesByIdAsync: (ids?: number[] | null) => Promise<void>;
	var saveEmployees: (ids:number[]) => void;
	var table: () => void;
	var updateTerms: () => void;
	var groups: any;

	var ivy2f3_marketing: number[];
	var ivy2f3_it: number[];
	var ivy1f4: number[];
	var miscIds: number[];
	var activeIvyIds: number[];
	var ids: any; // I'm to lazy to type these.
}

declare const unsafeWindow: Window;

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

// Renders a table of all employees saved to localStorage.
function table(): void {
	renderEmployeeTable(store.employees);
}

// Checks saved employees against the current data-source; any newly-terminated
// employees are updated in localStorage and listed in a "terminated" table.
function updateTerms(): void {
	const dir = employeeDirectory();
	const terminated: Employee[] = [];

	for (const saved of store.employees) {
		const current = dir[saved.employeeId];
		if (current?.statusCode !== "TERM") continue;

		const updated: Employee = { ...saved, statusCode: "TERM", lastWorkDate: current.lastWorkDate };
		store.saveEmployee(updated);
		terminated.push(updated);
	}

	renderTerminatedTable(terminated);
	console.log(`updateTerms: ${terminated.length} employee(s) newly marked terminated.`);
}

//=============================
//====  Employee-Specific  ====
//=============================

void (async function (): Promise<void> {
	globalThis.employeeData = await getEmployeeDictAsync();
	globalThis.scanEmployeesAsync = scanEmployeesAsync;
	globalThis.showEmployeesByIdAsync = showEmployeesByIdAsync;
	globalThis.saveEmployees = saveEmployees;
	globalThis.table = table;
	globalThis.updateTerms = updateTerms;
	globalThis.groups = groupBy<Employee,string>(Object.values(globalThis.employeeData),x=>x.dept);

	(unsafeWindow as any).cmd = {
		scanEmployeesAsync,
		showEmployeesByIdAsync,
		saveEmployees,
		table,
		updateTerms
	};

	function foo(str: string): void {
		queueMicrotask(console.log.bind(console, `%c${str}`, "color:#00c;font-style:italic;font-weight:800;"));
	}

	foo("activeIds = [...]");
	foo("terminatedIds = [...]");
	foo("scanEmployeesAsync(start,count=100);");
	foo("showEmployeesByIdAsync(ids=null);");
	foo("saveEmployees([...])");
	foo("table()");
	foo("cmd.updateTerms()");

	const lastEmployee = Object.values(globalThis.employeeData).pop();
	foo(`Last employee: ${lastEmployee?.employeeId ?? "?"}, Last scanned:${store.maxEmployeeId}`);

	console.log(`Active employees saved: ${store.activeEmployeeCount}`);

	queueMicrotask(console.log.bind(console, "%cemployee_scan.ts initialized", "background-color:#DFD")); // Last line of file
})();
