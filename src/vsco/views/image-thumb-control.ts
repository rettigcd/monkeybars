import { con } from "~/lib/console";
import { $, loadImgSrcAsync } from "~/lib/dom3";
import { toMs } from "~/lib/epoch-time";
import { throwNever } from "~/lib/throw";
import { formatDate } from "../format-date";
import { ImageModel, TaskStatus } from "../models/image-model";
import { imgCardBgColor, imgCardCss } from "./css";
import { ProgressBar } from "./progress-bar";

const {containerCss,imageSizeSpanCss,imgCss,dateSpanCss,checkmarkCss} = imgCardCss;

// Helper for showing Photo-taken and upload dates
function makeDateString(x:null|number){ return (x===null) ? 'N/A' : formatDate.YMD( new Date(toMs(x)) ); }

export class ImageThumbControl{ // single image

	private wrapperDiv: HTMLDivElement; // hosts progress-bar and checkmark
	private _progressBar?: ProgressBar;

	// trigger thumb load asynchronously
	private img: HTMLImageElement;
	private thumbUrl: string;

	constructor(model: ImageModel,container: HTMLDivElement){

		this.thumbUrl = model.thumbUrl;
		model.listen("downloadProgress", ({newValue}) => this.update(newValue));

		// wrapper
		this.wrapperDiv = $('div').appendTo(container).css(containerCss).css({background:imgCardBgColor(model)})
			.withChildren(
				$('a')
					.attr('href',model.downloadUrl)
					.on('click',(event)=> {
						event.preventDefault();
						model.downloadAsync();
					})
					.withChildren(
						this.img = $('img').css(imgCss).el
					),
				$('br'),
				// metadata caption
				$('span').css(imageSizeSpanCss).txt(model.width+' x '+model.height),
				$('span').css(dateSpanCss).attr('title','Taken: '+makeDateString(model.captureDateMs))
					.txt( makeDateString(model.uploadDateMs) )
			).el;

		this.update(model.downloadProgress);
	}

	// display the thumbnail image
	async loadAsync() : Promise<void>{ // load image
		await loadImgSrcAsync(this.img, this.thumbUrl, 5000);
	}

	private update(progress:TaskStatus){
		switch(progress.status){
			case 'notStarted':
				break;
			case 'inProgress':
				this._progressBar ??= new ProgressBar(this.wrapperDiv,({loaded,total})=>Math.floor(loaded/1000+0.5)+' of '+Math.floor(total/1000+0.5)+'KB');
				this._progressBar.track({loaded:progress.loaded,total:progress.total});				
				this.img.style.cursor = "wait";
				break;
			case 'complete':
				this._showCheckmark();
				this.img.style.opacity = "0.3";
				// fall thru
			case 'error':
			case 'timeout':
				this.img.style.cursor = "default";
				this._progressBar?.close();
				con.print( `download: ${progress.status}`);
				break;
			default: throwNever(progress);
		}
	}

	_showCheckmark(){
		$('span').txt('✓').css(checkmarkCss).appendTo(this.wrapperDiv);
	}
}
