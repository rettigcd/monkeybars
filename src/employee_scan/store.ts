import { CachedPersistentArray } from "~/lib/storage";

const maxEmployeeKey = "maxEmployeeId";

// Stores: GoodIDs & maxEmployeeID
export const store = {

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
