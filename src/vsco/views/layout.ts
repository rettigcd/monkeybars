import { $ } from "~/lib/dom3";
import { byDesc } from "~/lib/sorting";
import { Importer } from "../importer";
import { CalendarModel } from "../models/calendar-model";
import { Gallery } from "../models/gallery-model";
import { UserStatusType } from "../types";
import { UserCtx } from "../user-ctx";
import { UserStore } from "../user-store";
import { CalendarView } from "./calendar-view";
import { GalleryView } from "./gallery-view";
import { ScanNewImagesMenu } from "./scan-new-images";

export class Layout{
	gallery: Gallery;
	galleryView: GalleryView;
	calendarEl: HTMLDivElement;
	scanNextEl: HTMLDivElement;
	userStatusDiv;
	userDownloadCountsDiv;

	constructor(userStore: UserStore, gallery:Gallery){
		const css = {
			top			: {position:"fixed",top:"0px",left:'0px',width:'100%',height:"50px",'z-index':'3000',background:'rgba(255,255,255,0.9)',overflow:"auto"},
			leftPanel	: {margin:"0",padding:"0",display:'inline-block'},
			star		: {display:'inline-block'},
			userLink	: {display:'inline-block'},
			calendar	: {position:'fixed',right:'2px',top:'0',background:"white",border:"thin solid gray"},
			next		: {position:'absolute',right:'400px',top:'0'},
			counts		: {display:'inline-block'},
			progress	: {display:'inline-block', width:"150px", height:"15px","font-size":"12px", padding:'2px',color:'#060'},
		};

		// prependTo, appendTo, insertAfter

		const top = $('div').css(css.top).el;
		const leftPanel = $('div').css(css.leftPanel).appendTo(top).el;

		this.userStatusDiv = $('div').css(css.star).appendTo(leftPanel).el;
		this.userDownloadCountsDiv = $('div').css(css.counts).appendTo(leftPanel).el;

		const scanNewImagesDiv = $('div').css(css.userLink).appendTo(leftPanel).el;
		const visibleRowProgress = $('div').css(css.progress).appendTo(leftPanel).el;

		this.calendarEl = $('div').css(css.calendar).appendTo(top).el;
		this.scanNextEl = $('div').css(css.next).appendTo(top).el;
		const thumbDiv = $('div').el;

		const spacer = $('div').css({"height":css.top.height});
		setInterval(()=>spacer.css({'height':top.style.height}),2000); // !!! ? does top height change?
		const fileImport = $('input').appendTo(document.body).attr('type','file').attr('multiple',String(true));

		document.body.prepend(spacer.el,top,thumbDiv);

		this.gallery = gallery;

		// bind to model
		new ScanNewImagesMenu( scanNewImagesDiv, userStore, gallery );
		this.galleryView = new GalleryView( thumbDiv, visibleRowProgress, gallery );
		new Importer( fileImport );

		// next links
		for(let link of [userStore.needsReview(), userStore.missingViewDate(), userStore.toPrune()])
			link.appendTo(this.scanNextEl);
	}
	// If page is a user-page, this binds to their models.
	showCurrentUser(userCtx: UserCtx, calendar:CalendarModel){
		this.userStatusDiv.append( makeUserStatusControl( userCtx ).el );
		this.userDownloadCountsDiv.append( makeDownloadCountsControl(userCtx).el );
		this.calendarEl.appendChild( new CalendarView( calendar, this.gallery ).table );
	}
	appendButton(button:HTMLButtonElement){
		this.scanNextEl.appendChild(button);
	}
}

/// ::User Status (following,ignore,etc)
function makeUserStatusControl(userCtx:UserCtx){
	return $('select')
		.on('click', function(event){ userCtx.status = (event.currentTarget as HTMLSelectElement).value as UserStatusType; } )
		.do(x=>{
			x.add(new Option("following","following"));
			x.add(new Option("new","new"));
			x.add(new Option("queued","queued"));
			x.add(new Option("notFollowing","notFollowing"));
			x.value = userCtx.status;
		});
}

function makeDownloadCountsControl(userCtx:UserCtx){
	const div = $('div').css({padding:"2px",border:"thin solid green"});
	function updateUi() {
		const {data} = userCtx;
		div.txt(`↓ ${data.downloadsInLastYear}`);
		const byYear = Object.entries(data.byYear).sort(byDesc(x=>x[0])).map(x=>x[0]+':'+x[1]);
		if( byYear.length > 0)
			div.attr('title',byYear.join(' '));
	}
	updateUi();
	userCtx.on( 'imageDownloaded', updateUi );
	return div;
}
