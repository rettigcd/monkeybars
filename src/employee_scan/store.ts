import { CachedPersistentArray, SyncedPersistentDict } from "~/lib/storage";
import { type Employee } from "./data-source";

const maxEmployeeKey = "maxEmployeeId";

// Fields of an Employee that we persist to localStorage.
export const savedEmployeeFields = [
	"employeeId","firstName","lastName","nickName","location",
	"mobilePhone","startDate","lastWorkDate","dept","statusCode",
] as const satisfies readonly (keyof Employee)[];

function pick<T, K extends keyof T>( obj: T, keys: readonly K[] ): Pick<T, K> {
	return Object.fromEntries(
		keys.map(key => [key, obj[key]])
	) as Pick<T, K>;
}

// Stores: GoodIDs & maxEmployeeID
export const store = {

	saveEmployee(employee:Employee){
		employee = pick(employee,savedEmployeeFields);
		employeeRepo.update(employee.employeeId,x=>Object.assign(x,employee));
	},

	get employees(): Employee[] {
		return employeeRepo.values();
	},

	saveGoodId(id: number): void {
		goodIds.add(String(id));
		console.log("savenum", id);
	},

	set maxEmployeeId(id: number) {
		localStorage[maxEmployeeKey] = String(id);
	},

	get maxEmployeeId(): number {
		return Number(localStorage[maxEmployeeKey] || 0);
	},

	get activeEmployeeCount(): number {
		return employeeRepo.values().filter(x => x.statusCode === "ACT").length;
	},
};

const goodIds = new CachedPersistentArray("goods");
const employeeRepo = new SyncedPersistentDict<Employee>("employees");
