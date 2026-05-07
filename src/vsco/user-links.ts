import { con } from "~/lib/console";
import { by, byDesc, onlyUnique } from "~/lib/sorting";
import { CachedPersistentArray, SyncedPersistentDict } from "~/lib/storage";
import { Fetcher } from "./fetcher";
import { Gallery } from "./models/gallery-model";
import { GalleryRowModel } from "./models/gallery-row-model";
import { ImageModel } from "./models/image-model";
import { executePromisesInParallelAsync } from "./parallel";
import { ILinkedUser, LocalStorageUserLinks } from "./types";

type UserLinkRepos = {
	linkRepo: SyncedPersistentDict<LocalStorageUserLinks>;
	commonRepo:CachedPersistentArray;
	pageOwner?:string;
}

type GetLinkedUser = (username: string) => ILinkedUser;	

type LinkedUserPage = {
	user: ILinkedUser; 
	images:ImageModel[];
}

export class UserLinks {
	private readonly commonRepo: CachedPersistentArray; // Stuff we ignore
	private readonly linkRepo: SyncedPersistentDict<LocalStorageUserLinks>;					// stores the links

	private readonly username: string;
	private readonly pageOwner?: string;

	private readonly _fetcher: Fetcher;
	private readonly gallery: Gallery;	


	constructor(
		username:string, 
		{linkRepo,commonRepo,pageOwner}:UserLinkRepos, 
		fetcher:Fetcher, 
		private readonly getLinkedUser:GetLinkedUser,
		gallery: Gallery,
		private readonly track: (model:ImageModel) => void
	){
		this.username=username;

		this.linkRepo = linkRepo;
		this.commonRepo = commonRepo;
		this.pageOwner = pageOwner;
		this._fetcher = fetcher;
		this.gallery = gallery;
	}

	// returns array of linked user names, using cache if possible
	cached(): Promise<string[]>{
		return this.linkRepo.containsKey(this.username)  // in cache?
			? Promise.resolve( this.linkRepo.get(this.username) ) // use cache
			: this._scanAndSaveToCache();  // else scan
	}
	async list(){ this._listUsers( await this.cached() ); }
	async refresh(){ this._listUsers( await this._scanAndSaveToCache() ); }
	async show(){

		// $$$$$ - THIS MUST be somthing that has the fetcher
		const newUsers = (await this.cached())
			.map( username => this.getLinkedUser(username ) )
			.filter( user => user.status == "new" );
		console.log(`Scanning 1st page of ${newUsers.length} users.`);

		const firstPageWithUsernameArray = await fetchFirstPageOfEachUserAsync( newUsers, this.pageOwner, this.track ); // array of {user,images}
		firstPageWithUsernameArray.sort(byDesc<LinkedUserPage,number>(x=>x.images.length).thenBy(x=>x.user.username));

		this.gallery.rows = firstPageWithUsernameArray
			.map(({user,images})=>{
				const irm = new GalleryRowModel({
					labelText:user.username,
					images:images,
					actions:{
						open: ()=>user.open(),
						save: ()=>user.save(),
						X:    ()=>user.mask(),
					}
				});
				irm.listen('isVisible',({newValue:isVisible}) => {
					if(!isVisible)
						con.print(`closing row [${user.username}]`);
				})
				return irm;
			});
	}

	// Scans current linked users, saves them to the cache, returns them.
	async _scanAndSaveToCache(): Promise<string[]> {
		const collectionImages = await this._fetcher.fetchCollectionImages();
		const linkedUsers = collectionImages.map(i=>i.owner)
			.filter(onlyUnique)
			.filter(u=>!this.commonRepo.includes(u)); // exclude anything in the commonRepo

		console.log(`Collection scan of [${this.username}] found ${linkedUsers.length} links.`); // log
		this.linkRepo.update(this.username,arr=>{ arr.length=0; arr.push(...linkedUsers.sort()); });
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
