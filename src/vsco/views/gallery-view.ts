import { $, ElementBuilder } from "~/lib/dom3";
import { EventHostBase } from "~/lib/observable";
import { Gallery } from "../models/gallery-model";
import { GalleryRowModel } from "../models/gallery-row-model";
import { ImageRowView } from "./image-row-view";

type GalleryEvents = {
	place_holder: [];
};


export class GalleryView extends EventHostBase<GalleryEvents> {

	thumbDiv: HTMLDivElement;
	progressDiv: HTMLDivElement;
	_closeButton?: ElementBuilder<HTMLButtonElement>;

	rows: ImageRowView[] = [];
	model; // GalleryModel;
	visibleRowCount: number = 0;
	totalRowCount: number = 0;

	constructor( thumbDiv: HTMLDivElement, progressDiv: HTMLDivElement, model: Gallery ){
		super();
		this.thumbDiv = thumbDiv;
		this.progressDiv = progressDiv;
		this.model = model;
		this.model.listen('rows',({newValue:rows}) => this._showRowViewsAsync(rows) );
	}
	loadRows(rowData: GalleryRowModel[]){ this.model.rows = rowData; }

	async _showRowViewsAsync(rowData: GalleryRowModel[]){

		this.thumbDiv.innerHTML='';
		window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
		this.rows = rowData.map(x=>{ 
			return new ImageRowView(x,this.thumbDiv);
		});

		this.visibleRowCount = 0;
		this.totalRowCount = this.rows.length;
		this._adjustCounts(0,0); // trigger change event
		this.rows.forEach(row=>{
			row.on('loaded',()=>this._adjustCounts(1,0) );
			row.on('closed',()=>this._adjustCounts(-1,-1) );
			row.on('opened',()=>this._adjustCounts(1,1) );
		});

		this._showCloseButton();
		for(let rowView of this.rows)
			await rowView.loadAsync();
	}

	_adjustCounts(deltaVisible: number,deltaTotalRowCount: number){
		this.visibleRowCount += deltaVisible;
		this.totalRowCount += deltaTotalRowCount;
		if(this.totalRowCount == 0)
			this._closeButton?.el.remove();
		this.progressDiv.innerText = `${this.visibleRowCount} of ${this.totalRowCount} rows`;
	}

	_showCloseButton(){
		const buttonCss = {'border':'3px outset black','padding':'3px','margin':'2px','background':'gray'}
		this._closeButton = $('button').appendTo(this.thumbDiv).txt('close all').css(buttonCss)
			.on('click',()=>this._closeAllRows());
	}
	_closeAllRows() {
		window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
		this.rows.forEach( x=>x.model.isVisible = false );
		this.rows = [];
	}
}
