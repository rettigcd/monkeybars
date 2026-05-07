import { ObservableBase } from "~/lib/observable";
import { GalleryRowModel } from "./gallery-row-model";

export class Gallery extends ObservableBase<Gallery>{
	rows: GalleryRowModel[] = [];

	closeFirst(){
		// interact with model instead of view
		const [firstVisible] = this.rows
			.filter(m=>m && m.isVisible);
		if(firstVisible) firstVisible.isVisible=false;
	}

	openLast(){
		// interact with model instead of view
		const [firstHidden] = this.rows
			.filter(m=>m && !m.isVisible)
			.reverse();
		if(firstHidden) firstHidden.isVisible=true;
	}

}
