import { ObservableBase } from "~/lib/observable";
import { YYYYMM } from "../format-date";
import { monthNames } from "../month-names";
import { GalleryRowModel } from "./gallery-row-model";
import { ImageModel } from "./image-model";

// All of the images in a users profile for a given month
export class MonthModel extends ObservableBase<MonthModel> {

	public readonly base1Num: number; // 1-12
	public readonly name: string;
	public hasFocus: boolean = false; // observable

	constructor(
		public readonly yearMonth: YYYYMM,
		public readonly images:ImageModel[]
	){
		super();
		this.base1Num = Number(yearMonth.split('-')[1]);
		this.name = monthNames[this.base1Num-1];
	}

	// converts to something we can display in the gallery.
	public toImageRow(): GalleryRowModel{ 
		return new GalleryRowModel({
			labelText:`${this.yearMonth} (${this.name})`,
			images:this.images
		});
	}

}
