import type { SyncedPersistentDict } from "~/lib/storage";
import type { ImageModel } from "./models/image-model";
import type { LocalStorageImageDict, LocalStorageImageEntity } from "./types/local-storage";

export class NewImageStore {
	constructor(
		private readonly newImageRepo: SyncedPersistentDict<LocalStorageImageDict>, 
	){}

	public addNewImagesToUser(username:string,newImages:ImageModel[]){
		if(newImages.length === 0) return;
		this.newImageRepo.update(username,(newImageGroup:LocalStorageImageDict)=>{
			newImages.forEach( img => {
				const jsonParams:LocalStorageImageEntity = img.toJSON();
				newImageGroup[jsonParams.responsiveUrl]=jsonParams;
			} );
		});

	}
}