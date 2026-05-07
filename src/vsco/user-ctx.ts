import { GM } from "~/lib/gm";
import { EventHostBase } from "~/lib/observable";
import { SyncedPersistentDict } from "~/lib/storage";
import { DAYS } from "~/lib/units";
import { Fetcher } from "./fetcher";
import { Gallery } from "./models/gallery-model";
import { ImageModel } from "./models/image-model";
import { ILinkedUser, LocalStorageUserEntity, UserStatusType } from "./types";
import { UserAccess } from "./user-access";
import { UserData } from "./user-data";
import { UserLinks } from "./user-links";
import { UserStore } from "./user-store";

type UserCtxEvents = {
	imageDownloaded: [];
};

export class UserCtx extends EventHostBase<UserCtxEvents> implements ILinkedUser {

	public static nowMs: number; // for detecting what Users are stale
	public isPageOwner: boolean;

	username: string;
	_access: UserAccess;
	gallery:Gallery;
	track: (x:ImageModel)=>void;

	private readonly _userRepo: SyncedPersistentDict<LocalStorageUserEntity>;

	constructor(username: string, userRepo: SyncedPersistentDict<LocalStorageUserEntity>, userAccess: UserAccess, gallery:Gallery, track: (x:ImageModel)=>void){
		super();
		this.username = username;
		this._userRepo = userRepo;
		this._access = userAccess; // class: UserAccess
		this.gallery = gallery;
		this.track = track;
		this.isPageOwner = UserStore.pageOwnerName == this.username;
	}

	get links(){ 
		return new UserLinks(
			this.username,
			this._access,
			this.fetch,
			(u:string)=>new UserCtx(u, this._userRepo, this._access, this.gallery, this.track),
			this.gallery, this.track
		);
	}
	get data(){ return new UserData(this.username,this._userRepo.get(this.username)); }

	get newImages(){ // uses responsiveUrl as key to prevent duplicates, only need values
		return Object.values( this._access.newImageRepo.get(this.username) )
			.map(i=>{ 
				const model = new ImageModel(i);
				this.track(model);
				return model;
			});
	} 
	clearNewImages(){ this._access.newImageRepo.remove(this.username); }

	save(){ if(this.status != "following") this.status = "queued";}
	open(){ 
		this.save();
		this._userRepo.sync(); // flush 'save' before we open the next page.
		GM.openInTab(this.fetch.galleryUrl); // window.open(this.fetch.galleryUrl, '_blank');
	}
	mask(){ this._access.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

	// status
	get status(){ return this.data.status; }
	set status(status: UserStatusType){ 
		// when we follow someone, assume everything has been viewed.
		if(status=='following')
			this._update( data => data.setViewDateToNow() )
		this._update( data => data.status=status);
	}

	// Counts
	logDownloadImage(imgModel:ImageModel){
		const imageYear = imgModel.imgDate.getFullYear();
		this._update( data=>{ data.trackImage( imageYear ); } );
		this.trigger('imageDownloaded');
	}

	public prune(){ this._userRepo.remove(this.username);}

	// ui items
	rename(newName:string){ this._userRepo.rename(this.username,newName); this.username=newName; }

	get fetch(){ return new Fetcher(this.username, this.isPageOwner, this.track ); }

	async scanForNewImagesAsync(){

		await new Promise(resolve => setTimeout(resolve, 300)); // rate-limit - do 100/minute

		try{
			const newImages = await this._fetchNewImagesAsync();
			this._update( data=>data.setViewDateToNow() );
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

	async _fetchNewImagesAsync(): Promise<ImageModel[]>{ // move into fetcher?
		let result:ImageModel[] = [];

		// const info = this.data._info;
		// const before = JSON.stringify(this.data._info);
		const lastViewDateMs = this.data.viewDateMs;
		for await(let img of this.fetch.fetchGalleryImagesAsync()){
			if(img.uploadDateMs<lastViewDateMs) break;
			this.track(img);
			result.push(img);
		}
		return result;
	}

	get isDueToScanNewImages(){ 
		const data: UserData = this.data;
		if( data.status != "following" && data.status != "failed") return false;
		const effectiveDownloadsInLastYear = data.downloadsInLastYear || 1;
		const daysBetweenScans = Math.max( 5, 365/effectiveDownloadsInLastYear*0.6); // 60% of wait duration
		const nextScanTime = Math.floor( daysBetweenScans * DAYS ) + data.viewDateMs;
		return nextScanTime < UserCtx.nowMs;
	}

	_update(action:(d:UserData)=>void){
		return this._userRepo.update( this.username, 
			info => action( new UserData(this.username,info) ) 
		);
	}

}
