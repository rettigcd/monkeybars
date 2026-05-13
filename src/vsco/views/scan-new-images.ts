import { $, addStyleSheet, ElementBuilder } from "~/lib/dom3";
import { NewImagesModel } from "../models/new-images-model";
import { ProgressBar } from "./progress-bar";

export class ScanNewImagesMenu{

	private _progressBar?: ProgressBar;

	constructor(div: HTMLDivElement, model: NewImagesModel){ 

		addStyleSheet('.scanButton{cursor:pointer;} .scanButton:hover{border: thin dashed gray;}');

		let staleUserSpan: HTMLSpanElement
		let newImagesSpan: HTMLSpanElement;
		$(div).withChildren(
			staleUserSpan = $('span').addClass('scanButton').on('click',async() => await model.scanStaleUsersAsync()).el,
			$('span').txt(' / '),
			newImagesSpan = $('span').addClass('scanButton').on('click',()=>model.buildImageBatch()).el
		);

		model.listen("scanStaleUsersStatus", ({newValue:status})=> {
			switch(status.status){
				case "inProgress": 
					this._progressBar ??= new ProgressBar(staleUserSpan, ({loaded,total})=>loaded+' of '+total );
					this._progressBar.track(status); 
					break;
				default: 
					this._progressBar?.close();
					this._progressBar = undefined;
					break;
			}
		})

		model.listen("staleUserCount", ({newValue:count})=>staleUserSpan.innerText = 'due:'+count);
		model.listen("newImageUserCount", ({newValue:count})=>newImagesSpan.innerText='images:'+count);
	}

}


export function makeScanNewImagesMenu(model: NewImagesModel) : ElementBuilder<HTMLDivElement> {

	let progressBar: ProgressBar | undefined;

	addStyleSheet('.scanButton{cursor:pointer;} .scanButton:hover{border: thin dashed gray;}');

	let staleUserSpan: HTMLSpanElement
	let newImagesSpan: HTMLSpanElement;
	const $div = $('div').withChildren(
		staleUserSpan = $('span').addClass('scanButton').on('click',async() => await model.scanStaleUsersAsync()).el,
		$('span').txt(' / '),
		newImagesSpan = $('span').addClass('scanButton').on('click',()=>model.buildImageBatch()).el
	);

	model.listen("scanStaleUsersStatus", ({newValue:status})=> {
		switch(status.status){
			case "inProgress": 
				progressBar ??= new ProgressBar(staleUserSpan, ({loaded,total})=>loaded+' of '+total );
				progressBar.track(status); 
				break;
			default: 
				progressBar?.close();
				progressBar = undefined;
				break;
		}
	})

	model.listen("staleUserCount", ({newValue:count})=>staleUserSpan.innerText = 'due:'+count);
	model.listen("newImageUserCount", ({newValue:count})=>newImagesSpan.innerText='images:'+count);

	return $div;
}
