import { CachedPersistentArray, SyncedPersistentDict } from "~/lib/storage";
import { LocalStorageImageDict, LocalStorageUserLinks } from "./types";

export class UserAccess {

	public readonly newImageRepo: SyncedPersistentDict<LocalStorageImageDict>;
	public readonly linkRepo: SyncedPersistentDict<LocalStorageUserLinks>;
	public readonly commonRepo: CachedPersistentArray;
	
	constructor(){
		this.newImageRepo = new SyncedPersistentDict<LocalStorageImageDict>('newImages');
		this.linkRepo     = new SyncedPersistentDict<LocalStorageUserLinks>('graph',()=>[]);
		this.commonRepo   = new CachedPersistentArray('common');
	}	
}
