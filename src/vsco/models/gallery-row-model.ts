import { ObservableBase } from "~/lib/observable";
import { ImageModel } from "./image-model";

type ImageRowConstructorParams = {
	labelText:string;
	images:ImageModel[];
	actions?: Record<string,()=>void>;
}

// 1 row of images that appears in the Gallery
// has actions associated the row.
export class GalleryRowModel extends ObservableBase<GalleryRowModel>{
	public readonly labelText: string;
	public readonly images: ImageModel[];
	public readonly actions: Record<string,()=>void>;
	public isVisible: boolean = true; // observable

	constructor({labelText,images,actions={}}:ImageRowConstructorParams){
		super();
		this.labelText=labelText;
		this.images=images;
		this.actions=actions;
	}
}
