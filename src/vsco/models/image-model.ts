import { con } from "~/lib/console";
import { assertMs } from "~/lib/epoch-time";
import { DownloadTimeoutError, GM } from "~/lib/gm";
import { ObservableBase } from "~/lib/observable";
import type { TaskStatus } from "~/lib/progress-types";
import { formatDate } from "../format-date";
import { LocalStorageImageEntity } from "../types";
import { boxSize } from "../views/css";
export type { TaskStatus };

// prsents and downloads a single image, tracking download progress
export class ImageModel extends ObservableBase<ImageModel>{

	public static nowMs: number;

	public readonly owner: string; 

	// urls
	public readonly downloadUrl: string; // so user can right click on link and open in new tab
	public readonly thumbUrl: string;
	public readonly videoUrl?: string; 

	public readonly height: number;
	public readonly width: number;

	// dates
	public readonly imgDate: Date; // effective date of image
	public readonly captureDateMs: number;
	public readonly uploadDateMs: number;

	public downloadProgress: TaskStatus = { status:'notStarted' }; // observable

	private readonly localFileName: string;

	constructor(private readonly constructorArgs:LocalStorageImageEntity){
		super();
		const {owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate} = constructorArgs; // capture ONLY the props we need
		const {downloadUrl,thumbUrl} = buildUrls(responsiveUrl);

		// publc
		this.owner = owner;
		this.height = height;
		this.width = width;

		this.videoUrl = videoUrl;
		this.downloadUrl = videoUrl&&('https://'+videoUrl) || downloadUrl;
		this.thumbUrl = thumbUrl;

		this.captureDateMs = assertMs( captureDate, 'captureDate' );
		this.uploadDateMs = assertMs( uploadDate, 'uploadDate');
		this.imgDate = new Date(captureDate||uploadDate);

		// private
		this.localFileName = owner+' '+formatDate.forFilename(this.imgDate)+".jpg";
	}

	public get ageMs() : number { return ImageModel.nowMs - this.imgDate.valueOf(); }

	// Downloads image to "Downloads" folder
	public async downloadAsync(): Promise<void>{
		try{
			await GM.downloadAsync({ url: this.downloadUrl, name: this.localFileName, onprogress: this._onProgress });
			this.downloadProgress = {status:'complete'};
			con.print('Image saved.');
		} catch(error){
			if(error instanceof DownloadTimeoutError)
				this.downloadProgress = {status:'timeout'};
			else if(error instanceof Error)
				this.downloadProgress = {status:'error',error:error.message};
			else
				this.downloadProgress = {status:'error',error:String(error)};
		}
	}

	private _onProgress = ({loaded,total}:{loaded:number,total:number}): void => {
		console.debug( `%cdownloading... ${Math.floor(loaded / total * 100)}%`, 'color:blue;font-size:14px;');
		this.downloadProgress = { status: 'inProgress', loaded, total};
	}		

	toJSON(): LocalStorageImageEntity{ return this.constructorArgs; }

}

// static helper
function buildUrls(responsiveUrl:string): {downloadUrl:string, thumbUrl: string, urlStyle:number } {
	let match = responsiveUrl.match(/im.vsco.co\/aws-us-west-2\/(.*)/);
	if( match !== null ){
		const urlStyle = 1;
		const downloadUrl = 'https://im.vsco.co/aws-us-west-2/'+match[1];
		const thumbUrl = downloadUrl + '?w='+boxSize+'&amp;dpr=1'
		return { downloadUrl, thumbUrl, urlStyle };
	}

	match = responsiveUrl.match(/im.vsco.co\/1\/(.*)/);
	if( match !== null ){
		const urlStyle = 2;
		const downloadUrl = 'https://im.vsco.co/1/'+match[1];
		const thumbUrl = downloadUrl;
		return { downloadUrl, thumbUrl, urlStyle };
	}

	if( responsiveUrl.endsWith('?width=120') ){
		const url = responsiveUrl;
		return { downloadUrl:url,thumbUrl:url, urlStyle:3};
	}

	throw 'unable to rewrite Image Url for image: ' + responsiveUrl;
}
