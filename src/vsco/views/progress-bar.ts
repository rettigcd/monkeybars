import { $, ElementBuilder } from "~/lib/dom3";

export class ProgressBar{ 

	private initialColor: string;
	private finalColor: string;
	private progressDiv: ElementBuilder<HTMLDivElement>;

	constructor(container: HTMLElement,initialColor='#aaf',finalColor='#ccf'){
		const $container = $(container).css({'position':'relative'});
		this.initialColor = initialColor; this.finalColor=finalColor;

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
}
