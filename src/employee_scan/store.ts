import { CachedPersistentArray, SyncedPersistentDict } from "~/lib/storage";
import { type Employee } from "./data-source";

const maxEmployeeKey = "maxEmployeeId";

function pick<T, K extends keyof T>( obj: T, keys: K[] ): Pick<T, K> {
	return Object.fromEntries(
		keys.map(key => [key, obj[key]])
	) as Pick<T, K>;
}

// Stores: GoodIDs & maxEmployeeID
export const store = {

	saveEmployee(employee:Employee){
		employee = pick(employee,["employeeId","firstName","lastName","nickName","location","mobilePhone","startDate","lastWorkDate","dept","statusCode"]);
		employeeRepo.update(employee.employeeId,x=>Object.assign(x,employee));
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
};

const goodIds = new CachedPersistentArray("goods");
const employeeRepo = new SyncedPersistentDict<Employee>("employees");
