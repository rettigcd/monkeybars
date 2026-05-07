import { con } from "~/lib/console";
import { $, addStyleSheet } from "~/lib/dom3";
import { GM } from "~/lib/gm";
import { by, byDesc } from "~/lib/sorting";
import { Gallery } from "../models/gallery-model";
import { GalleryRowModel } from "../models/gallery-row-model";
import { executePromisesInParallelAsync } from "../parallel";
import { UserCtx } from "../user-ctx";
import { UserStore } from "../user-store";
import { ProgressBar } from "./progress-bar";
import { ProgressMonitor } from "./progress-monitor";

export class ScanNewImagesMenu{

	public static nowMs: number;

	private div: HTMLDivElement;
	private _readyToScanUsers: UserCtx[] = [];
	private _newImageUsers: UserCtx[] = [];
	private _userStore: UserStore;
	private gallery: Gallery;
	private _readySpan?: HTMLSpanElement;
	private _newImagesSpan?: HTMLSpanElement;

	constructor(div: HTMLDivElement, userStore: UserStore, gallery: Gallery){ 
		this._userStore = userStore;
		this.div = div;
		this._setUsersByStar();
		this.gallery = gallery;
	}

	_setUsersByStar(){

		this.div.innerHTML='';
		addStyleSheet('.scanButton{cursor:pointer;} .scanButton:hover{border: thin dashed gray;}');

		this._readySpan = $('span').addClass('scanButton').on('click',()=>this.scanReadyAsync()).appendTo(this.div).el;
		$('span').txt(' / ').appendTo(this.div);
		this._newImagesSpan = $('span').addClass('scanButton').on('click',()=>this._showNewImages()).appendTo(this.div).el;

		this._refreshReadyCount();
		this._refreshNewImageCount();
	}

	_refreshReadyCount(){
		this._readyToScanUsers = this._userStore.allUsers.filter( user=>user.isDueToScanNewImages );
		this._readySpan!.innerText = 'due:'+this._readyToScanUsers.length;
	}

	_refreshNewImageCount(){
		function displayNewImages(user: UserCtx){
			const imgs = user.newImages;
			return imgs.length>=4
				|| Math.min(...imgs.map(x=>x.uploadDateMs) ) < ScanNewImagesMenu.nowMs;
		}
		this._newImageUsers = this._userStore.newImageUsers
			.filter( displayNewImages );
		this._displayNewImageCount();
	}
	_displayNewImageCount(){
		this._newImagesSpan!.innerText='images:'+this._newImageUsers.length;
	}
	async scanReadyAsync(){
		const numToScan = 500;
		const toScan = this._readyToScanUsers
			.sort(by(user=>user.data.viewDateMs))
			.slice(0,numToScan); // only scan 200 oldest
		const unexecutedPromiseGenerators = toScan
			.map( user => ( ()=>user.scanForNewImagesAsync() ) );

		const monitor = new ProgressMonitor( new ProgressBar(this._readySpan!), ({loaded,total})=>loaded+' of '+total );
		try{
			await executePromisesInParallelAsync( unexecutedPromiseGenerators, 1, (x)=>monitor._progress(x) );
		} catch(err){
			console.log(err);
		}
		this._refreshReadyCount();
		this._refreshNewImageCount();
	}

	_clearNewImages(username:string){
		this._userStore.get(username).clearNewImages();
		this._newImageUsers = this._newImageUsers.filter(user=>user.username != username);
		this._displayNewImageCount();
	}

	_showNewImages(){
		const pageSize=25,allowOverflow=5;
		const users = this._newImageUsers;
		const countOnPage = users.length%pageSize; 
		const take = countOnPage < allowOverflow ? countOnPage + pageSize : countOnPage;

		const self = this;

		this.gallery.rows = users
			.sort(byDesc<UserCtx,number>(user=>user.data.downloadsInLastYear).thenBy(user=>user.username))
			.slice(0,take)
			.map( user => { 
				const irm = new GalleryRowModel({
					labelText : user.username + ' ' + user.data.downloadsInLastYear,
					images : user.newImages,
					actions : { 
						//open: function(){window.open(user.fetch.galleryUrl, '_blank');},
						open: function(){GM.openInTab(user.fetch.galleryUrl);},
					}
				});
				irm.listen('isVisible',({newValue:isVisible})=>{
					if(!isVisible){
						self._clearNewImages(user.username);
						con.print(`closing row [${user.username}]`);
					}
				})
				return irm;
			});
	}

}

