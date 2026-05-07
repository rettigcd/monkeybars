import { ImageModel } from "../models/image-model";
import { ProgressBar } from "./progress-bar";

type FormatterParams = {loaded:number; total:number;};
export type TextFormatter = ({loaded,total}:FormatterParams) => string;

// displays generic progress-object on a ProgressBar using custom text and % complete bar
export class ProgressMonitor{

	private _bar: ProgressBar;
	private _textFormatter: TextFormatter;

	constructor(bar: ProgressBar,textFormatter:TextFormatter){
		this._bar = bar;
		this._textFormatter = textFormatter;
	}
	
	monitorImageModel(imageModel:ImageModel){
		this._bar.percent = 0;
		this._bar.text = '...';
		imageModel.listen('downloadProgress', ({newValue:{status,loaded,total}})=>{
			switch(status){
				case 'timeout':
				case 'errored':
					console.log( `download: ${status}`);  // fall thru
				case 'complete':
					this._bar.close();
					break;
				case 'downloading':
					const l:number = loaded!;
					const t:number = total!;
					this._progress({loaded:l,total:t}); 
					break;
				default: console.log('well this is akward...'); break;
			}
		});
	}
	_progress({loaded,total,error}: {loaded:number; total:number; error?:unknown}){
		this._bar.percent = ProgressMonitor.progressToPercent({loaded,total});
		this._bar.text = this._textFormatter({loaded,total});
		if(loaded == total || error)
			this._bar.close();
	}
	static progressToPercent({loaded,total}:FormatterParams): number { 
		return Math.floor((loaded/total*100)+0.5);
	}
}
