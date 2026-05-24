import { by, byDesc, onlyUnique } from "~/lib/sorting";
import { linkRepo } from "~/vsco/local-storage";
import { UserCtx } from "~/vsco/user/user-ctx";
import { pageOwnerName } from "~/vsco/vscoDom";
import { Fetcher } from "../fetcher";
import { GalleryRowModel } from "../models/gallery-row-model";
import { ImageModel } from "../models/image-model";
import { executePromisesInParallelAsync } from "../parallel";
import type { ILinkedUser } from "../types/types";

type GetLinkedUser = (username: string) => ILinkedUser;	

// Result of fetching 1st page from a friend's (aka linked-user)
type LinkedUserPage = {
	user: ILinkedUser; 
	images:ImageModel[];
}

export class UserLinks {

	private readonly username: string;
	private readonly _fetcher: Fetcher;

	constructor(
		username:string, 
		fetcher:Fetcher, 
		private readonly getLinkedUser:GetLinkedUser,
		private readonly track: (model:ImageModel) => void
	){
		this.username=username;
		this._fetcher = fetcher;
	}

	// returns array of linked user names, using cache if possible
	cached(): Promise<string[]>{
		return linkRepo.containsKey(this.username)  // in cache?
			? Promise.resolve( linkRepo.get(this.username) ) // use cache
			: this._scanAndSaveToCache();  // else scan
	}
	async list(){ this._listUsers( await this.cached() ); }
	async refresh(){ this._listUsers( await this._scanAndSaveToCache() ); }

	async asGalleryRowsAsync():Promise<GalleryRowModel[]>{
		// THIS MUST be somthing that has the fetcher
		const newUsers = (await this.cached())
			.map( username => this.getLinkedUser(username ) )
			.filter( user => user.status == "new" );
		console.log(`Scanning 1st page of ${newUsers.length} users.`);

		// foreach user, get their 1st page of images
		const firstPageWithUsernameArray: LinkedUserPage[] = await fetchFirstPageOfEachUserAsync( newUsers, pageOwnerName, this.track ); // array of {user,images}
		firstPageWithUsernameArray.sort(byDesc<LinkedUserPage,number>(x=>x.images.length).thenBy(x=>x.user.username));
		// convert to gallery rows
		return firstPageWithUsernameArray
			.map((x)=>this._makeGalleryRow(x));
	}

	private _makeGalleryRow({user,images}:LinkedUserPage){
		return new GalleryRowModel({
			labelText:user.username,
			images:images,
			actions:{
				open: ()=>user.open(),
				save: ()=>user.save(),
				X:    ()=>user.mask(),
			}
		});
	}

	// Scans current linked users, saves them to the cache, returns them.
	async _scanAndSaveToCache(): Promise<string[]> {
		const collectionImages = await this._fetcher.fetchCollectionImages();
		const linkedUsers = collectionImages.map(i=>i.owner)
			.filter(onlyUnique)
			.filter(u=>!UserCtx.commonRepo.includes(u)); // exclude anything in the commonRepo

		console.log(`Collection scan of [${this.username}] found ${linkedUsers.length} links.`); // log
		linkRepo.update(this.username,arr=>{ arr.length=0; arr.push(...linkedUsers.sort()); });
		return linkedUsers;
	}

	_listUsers(usernames: string[]): void{
		const x = usernames
			.map(u => this.getLinkedUser(u) )
			.sort(by(u=>u.status))
			.map(user=>user.username+'\t'+user.status);
		console.log(x.join('\r\n'));
	}
}

// !! this might be more link-related than fetch-related
async function fetchFirstPageOfEachUserAsync(
	users: ILinkedUser[], 
	pageOwner:string|undefined,
	track: (model:ImageModel) => void
): Promise<LinkedUserPage[]> {
	const linkedUserPages: LinkedUserPage[] = [];
	const threads = users.map( function(user:ILinkedUser){
		return async () => {
			const images: ImageModel[] = await new Fetcher(user.username, user.username === pageOwner, track )
				.fetchFirstPageImages();
			linkedUserPages.push({ user, images});
		}
	});
	await executePromisesInParallelAsync(threads)
	return linkedUserPages;
}
