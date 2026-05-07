import { ObservableBase } from "~/lib/observable";
import { YearStr, YYYYMM } from "../format-date";
import { MonthModel } from "./month-model";

// all the images in a users profile for a given year, organized by month
export class YearModel extends ObservableBase<YearModel> {

	public readonly months: MonthModel[] = []; // array with only the months we have
	public hasFocus: boolean = false; // observable

	constructor(
		public readonly year:YearStr
	){
		super();
	}

	public loadMonths(byMonth:Partial<Record<YYYYMM,MonthModel>>){
		for(var m=1;m<=12;++m){
			const month = byMonth[ this.year+(m<10?"-0":"-")+m as YYYYMM]; // key: yyyy-mm
			if(month !== undefined) this.months.push(month);
		}
	}

	// array 0..11, with possible undefineds
	get sparse():Array<MonthModel|undefined>{
		const sparse: Array<MonthModel | undefined> = Array(12).fill(undefined);
		for(const month of this.months)
			sparse[month.base1Num-1] = month;
		return sparse;
	}
}