import { assertNotNull } from "~/laundry/location";
import { openInTab } from "~/lib/gm";
import { EventHostBase } from "~/lib/observable";
import { CachedPersistentArray } from "~/lib/storage";
import { Fetcher } from "../fetcher";
import { commonRepo, newImageRepo, userRepo } from "../local-storage";
import { ImageModel } from "../models/image-model";
import { NewImageStore } from "../new-image-store";
import type { ILinkedUser, UserStatusType } from "../types/types";
import { pageOwnerName } from "../vscoDom";
import { UserData } from "./user-data";
import { UserLinks } from "./user-links";

type UserCtxEvents = {
	imageDownloaded: [];
};

export class UserCtx extends EventHostBase<UserCtxEvents> implements ILinkedUser {

	// Static
	public static readonly commonRepo: CachedPersistentArray = commonRepo; // init from local-storage.ts
	public static nowMs: number; // for detecting what Users are stale

	// private
	private _track: (x:ImageModel)=>void;
	private  _username: string;

	constructor(username: string, track: (x:ImageModel)=>void){
		super();
		this._username = username;
		this._track = track;
	}

	public get isPageOwner(): boolean{ return this.username === pageOwnerName; }

	// Data / LocalStorageUserEntity stuff
	public get username(){ return this._username; }
	public set username(newName:string){ userRepo.rename(this._username,newName); this._username=newName; }
	public get viewDateMs(){ return this.data.viewDateMs; }
	public setViewDateToNow() { this._update( data=> data.setViewDateToNow() ); } // also clears failures
	public get downloadsInLastYear(){ return this.data.downloadsInLastYear; }
	public get isDueToScanNewImages(){ return this.data.isDueToScanNewImages; }
	public get lastDownloadYear(){ return this.data.lastDownloadYear; }
	public get lastCount(){ return this.data.lastCount; }
	public get byYear(){ return this.data.byYear; }
	public get status(){ return this.data.status; }
	public set status(status: UserStatusType){ 
		// when we follow someone, assume everything has been viewed.
		if(status=='following')
			this.setViewDateToNow();
		this._update( data => data.status=status);
	}
	public get firstFailure(){ return this.data.firstFailure; }
	public get toFailureString(){ return this.data.toFailureString; }
	public get group(){ return this.data.group; }
	public get shouldPrune(){ return this.data.shouldPrune; }

	get isPersisted(){ return userRepo.containsKey(this.username); }

	public cloneLocalStorageEntity(){ return this.data.cloneLocalStorageEntity(); }

	get links(){ 
		return new UserLinks(
			this.username,
			this.fetch,
			(u:string)=>new UserCtx(u, this._track),
			this._track
		);
	}

	get newImages(){ // uses responsiveUrl as key to prevent duplicates, only need values
		return Object.values( newImageRepo.get(this.username) )
			.map(i=>{ 
				const model = new ImageModel(i);
				this._track(model);
				return model;
			});
	} 
	clearNewImages(){ newImageRepo.remove(this.username); }

	save(){ if(this.status != "following") this.status = "queued";}
	open(){ 
		this.save();
		userRepo.sync(); // flush 'save' before we open the next page.
		openInTab(this.fetch.galleryUrl); // window.open(this.fetch.galleryUrl, '_blank');
	}
	mask(){ UserCtx.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

	// Counts
	logDownloadImage(imgModel:ImageModel){
		const imageYear = imgModel.imgDate.getFullYear();
		this._update( data=>{ data.trackImageDownloaded( imageYear ); } );
		this.trigger('imageDownloaded');
	}

	public prune(){ userRepo.remove(this.username);}

	get fetch(){ return new Fetcher(this.username, this.isPageOwner, this._track ); }


	// user MUST have .viewDate for this work.
	public async scanForNewImagesAsync(){
		try{
			const lastViewDateMs = this.data.viewDateMs;
			assertNotNull( lastViewDateMs, ".viewDate");

			const newImages:ImageModel[] = [];
			for await(let img of this.fetch.fetchGalleryImagesAsync()){
				if(img.uploadDateMs<lastViewDateMs) break;
				this._track(img);
				newImages.push(img);
			}

			this.setViewDateToNow();

			new NewImageStore().addNewImagesToUser(this.username,newImages);
		} catch( error ){
			console.log('Failed to load new images for '+this.username);
			console.error(error);
			this._update( data => data.loadFailed() );
		}
	}

	public clearFailure() {
		this._update( data => data.clearFailure() );
	}

	private get data(){ return new UserData(this.username,userRepo.get(this.username)); }

	private _update(action:(d:UserData)=>void){
		return userRepo.update( this.username, 
			info => action( new UserData(this.username,info) ) 
		);
	}

}
