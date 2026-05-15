import { con } from "~/lib/console";
import { $, $qAll, $qAsync2 } from "~/lib/dom3";
import { HotkeyManager } from "~/lib/hotkey-manager";
import { LastYear } from "./last-year";
import { CalendarModel } from "./models/calendar-model";
import { Gallery } from "./models/gallery-model";
import { GalleryRowModel } from "./models/gallery-row-model";
import { LocalStorageUserEntity, UserStatusType } from "./types";
import { UserCtx } from "./user-ctx";
import { UserStore } from "./user-store";
import { Layout } from "./views/layout";

const consoleCss = {
	msg : 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;',
	important : 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;',
	downloadCount : 'color:red; font-weight:bold; font-size:1.5rem;',
	startingState: 'color:blue;'
}

function makePruneButton(pageOwnerCtx:UserCtx){
	return $('button').txt('Prune').on('click',function(event){
		pageOwnerCtx.prune();
		con.print(`[${pageOwnerCtx.data.username}] pruned`);
		(event.currentTarget! as HTMLElement).remove();
	}).el	
}

// Init page - assume we have a user
function logStartingState(startingState:LocalStorageUserEntity,startingStatus:UserStatusType){
	const json = JSON.stringify(startingState,null,'\t');
	con.print(`starting state => %c${json} (${startingStatus})`,consoleCss.startingState);
	function condShow(label:string,seconds:number|undefined){ if(seconds) con.log(label+"="+new Date(seconds*1000).toDateString()); }
	condShow('viewDate',startingState.viewDate);
	condShow('firstFailure',startingState?.failure?.first);
}

// Only called if User Page exists (failures should be cleared)
export async function initUserPageAsync(
	pageOwnerName: string, // passed in so I don't have to assert it is not undefined
	userStore: UserStore,
	uiLayout: Layout,
	hotkeys: HotkeyManager,
	gallery: Gallery,
	pageLoadTime: number,
	window: Window
){

	UserStore.pageOwnerName = pageOwnerName;
	const pageOwnerCtx: UserCtx = userStore.get( pageOwnerName );
	const startingState: LocalStorageUserEntity = pageOwnerCtx.data.cloneLocalStorageEntity();
	const startingStatus = pageOwnerCtx.status;
	logStartingState(startingState,startingStatus);

	if(await $qAsync2(".NotFound",1000)){

		// Give them an option to prune this user.
		if(pageOwnerCtx.isPersisted)
			uiLayout.withActions( makePruneButton(pageOwnerCtx) );
		console.log("Not valid user page.");
		return;
	}

	pageOwnerCtx.clearFailure(); // if we get here, page is valid

	// Current User
	const calendar = new CalendarModel( pageOwnerCtx ).showNewImagesIn(gallery);

	// UI / view - currentUser

	uiLayout.showCurrentUser(pageOwnerCtx, calendar);

	addCopyUsernameUiElement( pageOwnerName! );

	calendar.registerHotkeys( hotkeys );

	switch( pageOwnerCtx.status ){
		case "new":
		case "queued":
			// show First Page
			const firstPageImages = await pageOwnerCtx.fetch.fetchFirstPageImages();
			if(0<firstPageImages.length){
				const imageRow = new GalleryRowModel({ 
					labelText: 'galley page-1 images',
					images:firstPageImages
				});
				gallery.rows = [imageRow];
			}
			uiLayout.withActions( makePruneButton(pageOwnerCtx) );
//				calendar.loadAsync();
			break;

		case "following":
			// Show New Images !
			if(startingState.viewDate===undefined){
				con.print('%cNo View Date found',consoleCss.important);
				if(startingState.dl !== undefined){
					const lastYear = Object.keys(startingState.dl).reverse()[0]||new Date(pageLoadTime).getFullYear();
					con.print(`Downloads for ${lastYear}: %c${startingState.dl[lastYear]}`,consoleCss.downloadCount);
				}
				con.print("Loading calendar to verify ready-to-prune.");
				calendar.loadAsync();
			} else {
				// Check if user should be pruned - !!! should use same code as is in UserCtx
				const lastYearInfo = new LastYear([pageOwnerName,startingState]);
				const earliestEmptyYear = new Date().getFullYear() - 4;
				if( lastYearInfo.lastYear<earliestEmptyYear ){
					uiLayout.withActions( makePruneButton(pageOwnerCtx) );
//					calendar.loadAsync();
				}
			}

			await pageOwnerCtx.scanForNewImagesAsync(); // Sets .viewDate which we NEED

			if(pageOwnerCtx.newImages.length>0){
				const newImagesRow = new GalleryRowModel({ labelText : 'new images', images:pageOwnerCtx.newImages })
				gallery.rows = [newImagesRow];
				pageOwnerCtx.clearNewImages();
			}
			break;

		case "notFollowing":
			con.print(`%cstatus=Ignored`,consoleCss.important);
			break;

		case "failed":
			con.print(`%cstatus=Failed`,consoleCss.important);
			break;

		default: // !!! replace with throwNever()
			con.print(`%cUnknown status [${pageOwnerCtx.status}]`,'color:#F88;background-color:black;');
			break;
	}

	const win = window as Window & { user: UserCtx, cmd: Record<string,unknown>};
	win.user = pageOwnerCtx;
	win.cmd = {
		owner: pageOwnerName,
		user: pageOwnerCtx,
		missingViewDate: function(sortLongestOutageFirst=false){
			userStore.missingViewDateUsers( sortLongestOutageFirst ).goto();
		},
		nextToPrune: function(yearsWithoutDownload=4){
			userStore.toPrune( yearsWithoutDownload ).goto();
		},
		showLinks: async function(){
			gallery.rows = await pageOwnerCtx.links.asGalleryRowsAsync();
		},
		downloads: []
	}

}

function addCopyUsernameUiElement(pageOwner:string){
	// !! Sometimes the matching element is inside a tree that is hidden so maybe we should put it someplace else.
	// !! sometimes the element does not contain the Page owner, but some other name.
	function addCopyElInterval(){
		const markerClass = 'name-copy-marker';
		const els = $qAll('h1.css-1u3pn9l.e19mt3zn0').filter(x=>!x.classList.contains(markerClass));
		els.forEach(el=>{
				el.innerText = "📋 " + el.innerText;
				el.style.cursor="pointer";
				el.addEventListener('click',() => navigator.clipboard.writeText(pageOwner));
				el.classList.add(markerClass);
				addCopyElInterval();
			});
	}
	// addCopyElInterval(); 
	setTimeout(addCopyElInterval,500);
}
