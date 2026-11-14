import { delayAsync } from "~/lib/async";
import { $q } from "~/lib/dom3";
import { throwIfBlocked } from "./blocked-error";
import { byDesc } from "~/lib/sorting";
import { ImageModel } from "./models/image-model";
import type { FetchProfileResponse, PreloadedState, PreloadImageEntity } from "./types/vsco-json";

// ms to wait between requests to vsco.co (keeps us under Cloudflare's rate limit)
export const requestDelay = 300;

// User's page doesn't exist (404 or VSCO's site_not_found) - deleted or renamed account.
export class UserNotFoundError extends Error {
	constructor(public readonly username: string){
		super(`404 user ${username} not found`);
		this.name = "UserNotFoundError";
	}
}

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
		return getPageImages( html, this.username );
	}

	// Used by:
	// - calendar to fetch-all of a users images and by
	// - fetch-new to just get images new since last-view-date (breaks once we've hit the an old image)
	async * fetchGalleryImagesAsync(): AsyncGenerator<ImageModel,void,unknown> {
		const startingHtml = await this._fetchGalleryPageHtml();
		const preloadedState = extractPreloadedStateFromHtml(startingHtml);
		throwIfSiteNotFound(preloadedState, this.username);

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

			await delayAsync(requestDelay);

			let params = {site_id:siteId,limit:"14",show_only:"0",cursor:nextCursor} as Record<string,string>;
			let response = await fetch(
				'https://vsco.co/api/3.0/medias/profile?'+new URLSearchParams(params).toString(),
				{headers:{"Authorization":"Bearer "+token}}
			);
			throwIfBlocked(response);

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

	// Throws on 404 (deleted/renamed account) so the caller records a failure
	// instead of treating it as a user with no new images.
	private async _fetchGalleryPageHtml(): Promise<string>{
		if(this._useDocumentBody)
			return $q<HTMLBodyElement>('body')!.outerHTML;
		const resp = await fetch( this.galleryUrl );
		throwIfBlocked(resp);
		if(resp.status === 404)
			throw new UserNotFoundError(this.username);
		return await resp.text();
	}

	private async _fetchCollectionPageHtml(pageNum: number): Promise<string>{
		const resp = await fetch( this.collectionUrl(pageNum) );
		throwIfBlocked(resp);
		return await resp.text();
	}

	private async _fetchCollectionImagesOnPage(pageNum: number): Promise<ImageModel[]>{
		const collectionHtml = await this._fetchCollectionPageHtml(pageNum);
		return getPageImages( collectionHtml, this.username );
	}

}

// called from 2 places
function getPageImages(html:string, username:string): ImageModel[] {
	let preloadedState = extractPreloadedStateFromHtml(html);
	throwIfSiteNotFound(preloadedState, username);
	let result = extractImagesFromPreloadedState(preloadedState);
	return result;
}

function throwIfSiteNotFound(preloadedState: PreloadedState, username: string): void {
	if(preloadedState.errorMessage == "site_not_found") { throw new UserNotFoundError(username); }
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