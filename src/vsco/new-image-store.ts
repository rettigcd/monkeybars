import { newImageRepo, type LocalStorageImageDict, type LocalStorageImageEntity } from "./local-storage";
import type { ImageModel } from "./models/image-model";

export class NewImageStore {

	public addNewImagesToUser(username:string,newImages:ImageModel[]){
		if(newImages.length === 0) return;
		newImageRepo.update(username,(newImageGroup:LocalStorageImageDict)=>{
			newImages.forEach( img => {
				const jsonParams:LocalStorageImageEntity = img.toJSON();
				newImageGroup[jsonParams.responsiveUrl]=jsonParams;
			} );
		});

	}
}