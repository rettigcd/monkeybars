export type EmployeeId = string;
export type DateTimeString = string; // e.g. "2002-07-15T00:00:00"

export type Employee = {

	employeeId: string;

	fullName: string;
	lastName: string;
	firstName: string;
	nickName: string;
	fullNickName: string;

	location: string;

	mobilePhone: string | null;	// 8000+ records
	homePhone: string | null; // 600+ recoreds
	email: string;

	startDate: DateTimeString;
	lastWorkDate: DateTimeString;

	dept: string;		// Department descriptions
	department: string; // Department # as a string.  Example: "262", "86"

	statusCode: "ACT" | "LOA" | "TERM";

	// firstResponder: 0 | 1;
	// extension: string;
	// title: string;
	// supervisor: string;
	// supervisorId: string;
	// assignedToId: string;
	// orgUnitLeaderId: string;
	// mobileCountryCode: string | null;
	// homeCountryCode: string | null;
	// fax: string;
	// teamNumber: string;
	// isAdmin: boolean;
	// titleDesc: string;
};

// JSON response from server
type EmployeeListResponse = {
	content: Employee[];
	message: "Success" | string;
	statisCode: number;
	errors: unknown[];
};

// How we are going to store the records
export type EmployeeDirectory = Record<EmployeeId, Employee>;

// Loads Data-Dictionary
export async function getEmployeeDictAsync(): Promise<EmployeeDirectory> {
	const resp = await fetch("https://intranetapps.tql.com/api/extensionlist/employees/list");
	const json = await resp.json() as EmployeeListResponse;
	const dict: EmployeeDirectory = {};
	json.content.forEach(emp => dict[emp.employeeId] = emp);
	return dict;
}
