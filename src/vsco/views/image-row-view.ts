import { $ } from "~/lib/dom3";
import { EventHostBase } from "~/lib/observable";
import { GalleryRowModel } from "../models/gallery-row-model";
import { executePromisesInParallelAsync } from "../parallel";
import { css } from "./css";
import { ImageRowLabelView } from "./image-row-label-view";
import { ImageThumbControl } from "./image-thumb-control";


type ImageRowEvents = {
	closed: [];
	loaded: [];
	opened: [];
};

export class ImageRowView extends EventHostBase<ImageRowEvents> {

	model: GalleryRowModel;
	labelDiv?: HTMLDivElement;
	imgContainer: HTMLDivElement;
//	_buttons: unknown;

	constructor(imageRowModel: GalleryRowModel, container: HTMLDivElement){
		super();
		this.model = imageRowModel;

		const rowDiv = $('div').css(css.imageRow).appendTo(container).el;
		const closeTab = $('div').css({'width':'30px','borderTop':'thin solid #808'}).appendTo( rowDiv );
		const subContainer = $('div').css({'width':'100%'}).appendTo(rowDiv).el;
		const label = new ImageRowLabelView( subContainer, this.model.labelText );
		this.imgContainer = $('div').appendTo(subContainer).el;

		this.model.listen('isVisible',({newValue:isVisible})=>{
			if(isVisible){
				rowDiv.style.display=css.imageRow.display;
				this.trigger('opened');
			} else {
				rowDiv.style.display="none";
				this.trigger('closed');
			}
		})

		// Events
		this.on('loaded',()=>{
			label.enable();
			closeTab
				.css({"cursor":"pointer","background":"#CCF"})
				.on('click',()=> this.close())
		});

		// add buttons
		for(const [text, action] of Object.entries(imageRowModel.actions))
			label.addButton(text,action);
	}
	close(){
		this.model.isVisible = false;
	}
	async loadAsync(){
		// construct all of the image-thumb containers now
		const thumbNames = this.model.images.map(imgModel =>
			new ImageThumbControl( imgModel, this.imgContainer )
		);

		// load them later
		await executePromisesInParallelAsync( thumbNames.map( t=>(()=>t.loadAsync()) ), 10 );
		this.trigger('loaded');
	}
}
