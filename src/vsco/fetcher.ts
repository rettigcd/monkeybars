import { $q } from "~/lib/dom3";
import { byDesc } from "~/lib/sorting";
import { ImageModel } from "./models/image-model";
import type { FetchProfileResponse, PreloadedState, PreloadImageEntity } from "./types/vsco-json";

export class Fetcher {

	private username: string;
	private _useDocumentBody: boolean;
	private track: (model:ImageModel) => void;

	constructor(username:string,useDocumentBody:boolean,track:(model:ImageModel)=>void){
		this.username = username;
		this._useDocumentBody = useDocumentBody;
		this.track = track;
	}

	get galleryUrl(){ return 'https://vsco.co/'+this.username+'/gallery'; }
	collectionUrl(page:number):string { return 'https://vsco.co/'+this.username+'/collection/'+page; }

	// gets all "reposts" so we can harvest them for linked-users / friends
	public async fetchCollectionImages(): Promise<ImageModel[]>{
		const maxImagesPerPage=20;
		const allImages: ImageModel[] = [];
		let pageNum = 0;
		let imgs;
		do{
			imgs = await this._fetchCollectionImagesOnPage(++pageNum);
			allImages.push(...imgs);
			console.log('links...',pageNum,imgs.length,imgs.length==maxImagesPerPage);
		} while(imgs.length==maxImagesPerPage);
		return allImages;
	}

	// Gets the 1st page of a user for displaying their images in the linked-user friend list.
	async fetchFirstPageImages(): Promise<ImageModel[]>{
		const html = await this._fetchGalleryPageHtml();
		return getPageImages( html );
	}

	// Used by:
	// - calendar to fetch-all of a users images and by
	// - fetch-new to just get images new since last-view-date (breaks once we've hit the an old image)
	async * fetchGalleryImagesAsync(): AsyncGenerator<ImageModel,void,unknown> {
		const startingHtml = await this._fetchGalleryPageHtml();
		const preloadedState = extractPreloadedStateFromHtml(startingHtml);

		const { users:{currentUser:{tkn:token}}, medias:{bySiteId} } = preloadedState;
		const siteStates = Object.entries(bySiteId);
		const firstSite = siteStates[0];
		if(firstSite === undefined) return;
		const [siteId,siteMedia] = firstSite;

		const result = extractImagesFromPreloadedState(preloadedState).sort(byDesc(x=>x.uploadDateMs));

		for(let img of result){
			this.track(img);
			yield img;
		}

		let nextCursor = siteMedia.nextCursor;
		while(nextCursor){

			await new Promise(resolve => setTimeout(resolve, 60*1000/150)); // rate-limit - do 200/minute

			let params = {site_id:siteId,limit:"14",show_only:"0",cursor:nextCursor} as Record<string,string>;
			let response = await fetch(
				'https://vsco.co/api/3.0/medias/profile?'+new URLSearchParams(params).toString(),
				{headers:{"Authorization":"Bearer "+token}}
			);

			let json: FetchProfileResponse = await response.json();
			let newImgs = json.media
				.map(({image:i}) => new ImageModel({
					owner : i.perma_subdomain,
					height : i.height,
					width : i.width,
					responsiveUrl : i.responsive_url,
					captureDate : i.capture_date,
					uploadDate : i.upload_date,
					// video???
				}))
				.sort(byDesc<ImageModel,number>(x=>x.uploadDateMs));

			for(let img of newImgs){
				this.track(img);
				yield img;
			}

			nextCursor = json.next_cursor;
		}

	}

	private async _fetchGalleryPageHtml(): Promise<string>{
		return this._useDocumentBody
			? $q<HTMLBodyElement>('body')!.outerHTML
			: await (await fetch( this.galleryUrl )).text();
	}

	private async _fetchCollectionPageHtml(pageNum: number): Promise<string>{
		const resp = await fetch( this.collectionUrl(pageNum) );
		return await resp.text();
	}

	private async _fetchCollectionImagesOnPage(pageNum: number): Promise<ImageModel[]>{
		const collectionHtml = await this._fetchCollectionPageHtml(pageNum);
		return getPageImages( collectionHtml );
	}

}

// called from 2 places
function getPageImages(html:string): ImageModel[] {
	let preloadedState = extractPreloadedStateFromHtml(html);
	if(preloadedState.errorMessage =="site_not_found") { throw new Error("site_not_found"); }
	let result = extractImagesFromPreloadedState(preloadedState);
	return result;
}

// returns array of ImageModel objects.
function extractImagesFromPreloadedState(preloadedState: PreloadedState) : ImageModel[]{
	const preloadedImages: PreloadImageEntity[] = Object.values(preloadedState.entities.images);
	return preloadedImages
		.map(({permaSubdomain:owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate}) => new ImageModel({
			owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate
		}));
}

// static helper
function extractPreloadedStateFromHtml(html:string): PreloadedState{
	let json = extractPreloadedJson(html);
	if(json == null){ 
		console.debug('Unable to find preloaded state in:',html); 
		throw 'no preloaded state found';
	}
	json = json.replaceAll(":undefined",":null");
	return JSON.parse(json);
}

function extractPreloadedJson(html:string): string | null {
	return findStringBetween(html,'window.__PRELOADED_STATE__ = ','</script>'); // because string.match(regex) does not match unicode characters!
}

function findStringBetween(src:string,prefix:string,suffix:string): string | null {
	let prefixIndex = src.indexOf(prefix);
	if(prefixIndex==-1) return null;
	const startIndex = prefixIndex+prefix.length;
	let endIndex = src.indexOf(suffix,startIndex);
	if(endIndex==-1) return null;
	return src.substring(startIndex,endIndex);
}


// function findStringBetween(src,prefix,suffix) {
// 	let prefixIndex = src.indexOf(prefix);
// 	if(prefixIndex==-1) return null;
// 	const startIndex = prefixIndex+prefix.length;
// 	let endIndex = src.indexOf(suffix,startIndex);
// 	if(endIndex==-1) return null;
// 	return src.substring(startIndex,endIndex);
// }

// function extractPreloadedJson(html) {
// 	return findStringBetween(html,'window.__PRELOADED_STATE__ = ','</script>'); // because string.match(regex) does not match unicode characters!
// }

// bob = extractPreloadedJson(document.body.outerHTML)
// bob = bob.replaceAll(":undefined",":'-undefined-'");