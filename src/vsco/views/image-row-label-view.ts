import { $ } from "~/lib/dom3";

type ButtonClick = () => void;
type ButtonData = {
	text: string;
	onClickHandler: ButtonClick;
}

export class ImageRowLabelView {
	private labelDiv: HTMLDivElement;
	private _buttons: ButtonData[];

	constructor(container:HTMLDivElement,text:string){
		const labelCss = {
			"font-size":"20px",
			"font-family":
			"sans-serif",
			"background":"#ACC",
			"text-align":"left",
			"width":"100%",
			"padding":"2px 10px",
			// Stays on screen while its row's images scroll past; leaves with the row.
			// top = height of the fixed header in layout.ts
			"position":"sticky",
			"top":"80px",
			"z-index":"1"};
		this.labelDiv = $('div').txt( text ).css(labelCss).addClass('imageRowLabel').appendTo(container).el;
		this._buttons=[];
	}
	enable(){
		this._buttons.forEach(btn=>this._enableButton(btn));
	}
	_enableButton({text,onClickHandler}:ButtonData){
		const buttonCss = {'cursor':'pointer','border':'outset','margin':'0 10px','display':'inline-block','vertical-align':'middle','font-size':'10px'};
		$('span').txt(text).appendTo(this.labelDiv).css(buttonCss)
			.on('click',(e)=>{
				e.stopPropagation();
				onClickHandler();
			} ).el;
	}
	addButton(text:string,onClickHandler:ButtonClick){
		this._buttons.push({text,onClickHandler});
	}
}
