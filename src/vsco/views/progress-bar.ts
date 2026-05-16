import { $, ElementBuilder } from "~/lib/dom3";
import type { LTProgress } from "~/lib/progress-types";

type FormatterParams = {loaded:number; total:number;};
export type TextFormatter = ({loaded,total}:FormatterParams) => string;

export class ProgressBar{ 

	private initialColor: string;
	private finalColor: string;
	private progressDiv: ElementBuilder<HTMLDivElement>;

	private _textFormatter: TextFormatter;

	constructor(container: HTMLElement,textFormatter:TextFormatter, initialColor='#aaf',finalColor='#ccf'){
		const $container = $(container).css({'position':'relative'});
		this.initialColor = initialColor; this.finalColor=finalColor;
		this._textFormatter = textFormatter;

		const css = {
			position:'absolute', top:'0', 
			height:"16px",width:'100%',
			'text-align':'right', 'vertical-align':'middle',
			padding:'1px 4px',
			'font-family':'Verdana','font-size':'10px',
			'white-space':'nowrap',
			display:'none',

			left:'-'+$container.el.style.marginLeft,
			margin:$container.el.style.margin
		};

		this.progressDiv = $('div').appendTo($container.el).css(css);
	}

	public set text(value:string){ this.progressDiv.txt(value); }

	public set percent(pct:number){ // 0..100
		const fc=this.finalColor,ic=this.initialColor;
		this.progressDiv.css({backgroundImage:`repeating-linear-gradient(to right, ${fc}, ${fc} ${pct}%, ${ic} ${pct}%, ${ic})`,'display':'block'});
	}

	public close(){ this.progressDiv.el.remove(); }


	// Shows progress until we have an error, or is complete
	// can be passed directly in without using (x)=>track(x)
	public track = ({loaded,total,error}: LTProgress & {error?:unknown}) => {
		this.percent = Math.floor((loaded/total*100)+0.5); // 0..100%
		this.text = this._textFormatter({loaded,total});
		if(loaded == total || error)
			this.close();
	}


}
