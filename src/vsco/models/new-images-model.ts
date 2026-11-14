import { delayAsync } from "~/lib/async";
import { con } from "~/lib/console";
import { type LTProgress, openInTab } from "~/lib/gm";
import { ObservableBase } from "~/lib/observable";
import { by, byDesc } from "~/lib/sorting";
import { BlockedError, reportBlocked } from "../blocked-error";
import { requestDelay } from "../fetcher";
import { executePromisesInParallelAsync } from "../parallel";
import { UserStore } from "../user-store";
import { UserCtx } from "../user/user-ctx";
import { GalleryRowModel } from "./gallery-row-model";
import type { TaskStatus } from "./image-model";

// # of users we scan in 1 go
const numToScan = 200; // 500?

// Tracks the current state of: 
//	1) stale Users to scan and 
//	2) Users with new images 
export class NewImagesModel extends ObservableBase<NewImagesModel> {

	staleUserCount: number = 0; // observable
	newImageUserCount: number = 0; // observable
	scannedNewImages: GalleryRowModel[] = []; // observable

	scanStaleUsersStatus: TaskStatus = { status:"notStarted" }; // observable
	
	public readonly trackStaleUserProgress = ({loaded,total}:LTProgress) => this.scanStaleUsersStatus = { status:'inProgress', loaded, total }

	// to-be-private
	private _staleUsers: UserCtx[] = [];
	_cachedNewImageUsers: UserCtx[] = [];

 	constructor(
 		private readonly _userStore:UserStore
 	){
		super();
		this.refreshStaleUsers();
		this.loadNewImageUsers();
 	}

	// converts stale users into new-image users
	public async scanStaleUsersAsync(){
		const toScan:UserCtx[] = this._staleUsers
			.sort(by(user=>user.viewDateMs))
			.slice(0,numToScan); // only scan 200 oldest
		let blocked: BlockedError | undefined; // once set, remaining users are skipped
		const unexecutedPromiseGenerators = toScan
			.map(user => async () => {
				if(blocked) return;
				await delayAsync(requestDelay);
				try{
					await user.scanForNewImagesAsync();
				} catch(err){
					if(!(err instanceof BlockedError)) throw err;
					blocked = err;
				}
			});

		try{
			await executePromisesInParallelAsync( unexecutedPromiseGenerators, 1, this.trackStaleUserProgress );
			if(blocked){
				this.scanStaleUsersStatus = {status:"error", error:blocked.message};
				reportBlocked(blocked);
			} else
				this.scanStaleUsersStatus = {status:"complete"};
		} catch(err){
			this.scanStaleUsersStatus = {status:"error", error:String(err) };
			console.log(err);
		}
		this.refreshStaleUsers();
		this.loadNewImageUsers();
	}

	// takes a batch of new-image users and generates GalleryRows[]
	// when user hides GalleryRow, they are removed from the cache and globaly
	public buildImageBatch(): void {
		// Drop users whose new images were cleared since we cached them (e.g. in another tab).
		const stillNew = new Set(this._userStore.newImageUsers.map(user => user.username));
		this._cachedNewImageUsers = this._cachedNewImageUsers
			.filter(user => stillNew.has(user.username) && user.newImages.length > 0);
		this.newImageUserCount = this._cachedNewImageUsers.length;

		const pageSize=25,allowOverflow=5;
		const countOnPage = this._cachedNewImageUsers.length % pageSize; 
		const take = countOnPage < allowOverflow ? countOnPage + pageSize : countOnPage;

		// Assigns a slice of the NewImage-Users' images to the gallery.
		const newRows = this._cachedNewImageUsers
			.sort(byDesc<UserCtx,number>(user=>user.downloadsInLastYear).thenBy(user=>user.username))
			.slice(0,take)
			.map( user => this.makeGalleryRowForNewImages(user) );
		this.scannedNewImages = [...this.scannedNewImages, ...newRows]; // trigger change
	}

	private loadNewImageUsers(){ // make private
		this._cachedNewImageUsers = this._userStore.newImageUsers;
		this.newImageUserCount = this._cachedNewImageUsers.length;
	}
	private removeNewImageUser(username:string){ // removes from cache
		this._cachedNewImageUsers = this._cachedNewImageUsers
			.filter(otherUser=>otherUser.username != username); // removes users from current cached list.
		this.newImageUserCount = this._cachedNewImageUsers.length;
	}

	private refreshStaleUsers(){
		this._staleUsers = this._userStore.allUsers.filter( user=>user.isDueToScanNewImages );
		this.staleUserCount = this._staleUsers.length;
	}

 	private makeGalleryRowForNewImages(user:UserCtx):GalleryRowModel {
 		const rowModel = new GalleryRowModel({
 			labelText : user.username + ' ' + user.downloadsInLastYear,
 			images : user.newImages,
 			actions : { 
 				open: function(){openInTab(user.fetch.galleryUrl);}, // !!! ??? should this move to the UI
 			}
 		});
 		rowModel.listen('isVisible',({newValue:isVisible})=>{
 			if(isVisible) return; // should we do something if they re-show it?
 			this._userStore.get(user.username).clearNewImages(); // remove globally
			this.removeNewImageUser(user.username);				// remove from cache
 			con.debug(`closing row [${user.username}]`);
 		});
 		return rowModel;
 	}

}