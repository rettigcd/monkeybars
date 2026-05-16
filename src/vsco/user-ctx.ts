import { openInTab } from "~/lib/gm";
import { EventHostBase } from "~/lib/observable";
import { SyncedPersistentDict } from "~/lib/storage";
import { DAYS } from "~/lib/time";
import { Fetcher } from "./fetcher";
import { ImageModel } from "./models/image-model";
import type { LocalStorageUserEntity } from "./types/local-storage";
import type { ILinkedUser, UserStatusType } from "./types/types";
import { UserAccess } from "./user-access";
import { UserData } from "./user-data";
import { UserLinks } from "./user-links";
import { pageOwnerName } from "./vscoDom";

type UserCtxEvents = {
	imageDownloaded: [];
};

export class UserCtx extends EventHostBase<UserCtxEvents> implements ILinkedUser {

	public static nowMs: number; // for detecting what Users are stale

	public username: string;

	_access: UserAccess;
	_track: (x:ImageModel)=>void;

	private readonly _userRepo: SyncedPersistentDict<LocalStorageUserEntity>;

	constructor(username: string, userRepo: SyncedPersistentDict<LocalStorageUserEntity>, userAccess: UserAccess, track: (x:ImageModel)=>void){
		super();
		this.username = username;
		this._userRepo = userRepo;
		this._access = userAccess; // class: UserAccess
		this._track = track;
	}

	get isPageOwner(): boolean{ return this.username === pageOwnerName; }

	get links(){ 
		return new UserLinks(
			this.username,
			this._access,
			this.fetch,
			(u:string)=>new UserCtx(u, this._userRepo, this._access, this._track),
			this._track
		);
	}
	get data(){ return new UserData(this.username,this._userRepo.get(this.username)); }

	get newImages(){ // uses responsiveUrl as key to prevent duplicates, only need values
		return Object.values( this._access.newImageRepo.get(this.username) )
			.map(i=>{ 
				const model = new ImageModel(i);
				this._track(model);
				return model;
			});
	} 
	clearNewImages(){ this._access.newImageRepo.remove(this.username); }

	save(){ if(this.status != "following") this.status = "queued";}
	open(){ 
		this.save();
		this._userRepo.sync(); // flush 'save' before we open the next page.
		openInTab(this.fetch.galleryUrl); // window.open(this.fetch.galleryUrl, '_blank');
	}
	mask(){ this._access.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

	get isPersisted(){ return this._userRepo.containsKey(this.username); }

	// status
	get status(){ return this.data.status; }
	set status(status: UserStatusType){ 
		// when we follow someone, assume everything has been viewed.
		if(status=='following')
			this.setViewDateToNow();
		this._update( data => data.status=status);
	}

	// Counts
	logDownloadImage(imgModel:ImageModel){
		const imageYear = imgModel.imgDate.getFullYear();
		this._update( data=>{ data.trackImageDownloaded( imageYear ); } );
		this.trigger('imageDownloaded');
	}

	public prune(){ this._userRepo.remove(this.username);}

	// ui items
	rename(newName:string){ this._userRepo.rename(this.username,newName); this.username=newName; }

	get fetch(){ return new Fetcher(this.username, this.isPageOwner, this._track ); }

	async scanForNewImagesAsync(){

		await new Promise(resolve => setTimeout(resolve, 300)); // rate-limit - do 100/minute

		try{
			const newImages = await this._fetchNewImagesAsync();
			this.setViewDateToNow();
			if(0<newImages.length)
				this._access.newImageRepo.update(this.username,newImageGroup=>{
					newImages.forEach( img => {
							const jsonParams = img.toJSON();
							newImageGroup[jsonParams.responsiveUrl]=jsonParams;
						} ); // adds each image to the group
				});
		} catch( error ){
			console.log('Failed to load '+this.username);
			console.error(error);
			this._update( data => data.loadFailed() );
		}
	}

	public setViewDateToNow() {
		this._update( data=> data.setViewDateToNow() ); // also clears failures
	}

	public clearFailure() {
		this._update( data => data.clearFailure() );
	}

	async _fetchNewImagesAsync(): Promise<ImageModel[]>{ // move into fetcher?
		let result:ImageModel[] = [];

		// const info = this.data._info;
		// const before = JSON.stringify(this.data._info);
		const lastViewDateMs = this.data.viewDateMs;
		for await(let img of this.fetch.fetchGalleryImagesAsync()){
			if(img.uploadDateMs<lastViewDateMs) break;
			this._track(img);
			result.push(img);
		}
		return result;
	}

	// !!! THIS MIGHT BE WRONG.
	// People missing viewDate are showing up as 1980
	// and when we do a scan of them, it goes all the way back to the beginning.
	// !!! don't scan people without viewDates.
	// !!! MAYBE the status is wrong.  Maybe the status should show up as "new" or "notFollowing" but are erroneously showing up as following.
	// !!! TEST - of everyone that .isDueToScanNewImages, show their: status & raw viewDate
	get isDueToScanNewImages(){ 
		const data: UserData = this.data;
		if( data.status !== "following" ) return false;
		const effectiveDownloadsInLastYear = data.downloadsInLastYear || 1;
		const daysBetweenScans = Math.max( 5, 365/effectiveDownloadsInLastYear*0.6); // 60% of wait duration
		const nextScanTime = Math.floor( daysBetweenScans * DAYS ) + data.viewDateMs;
		return nextScanTime < UserCtx.nowMs;
	}

	private _update(action:(d:UserData)=>void){
		return this._userRepo.update( this.username, 
			info => action( new UserData(this.username,info) ) 
		);
	}

}
