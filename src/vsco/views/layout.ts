import { $, ElementBuilder } from "~/lib/dom3";
import { byDesc } from "~/lib/sorting";
import { Importer } from "../importer";
import { CalendarModel } from "../models/calendar-model";
import { Gallery } from "../models/gallery-model";
import { NewImagesModel } from "../models/new-images-model";
import type { UserStatusType } from "../types/types";
import { UserCtx } from "../user/user-ctx";
import { CalendarView } from "./calendar-view";
import { GalleryView } from "./gallery-view";
import { makeScanNewImagesMenu } from "./scan-new-images";

export class Layout{

	private calendarEl: HTMLDivElement;
	private $actionLinks: ElementBuilder<HTMLDivElement>;
	private userStatusDiv;
	private userDownloadCountsDiv;

	constructor(
		gallery:Gallery, // where the images are displayed
		newImagesModel:NewImagesModel // scanning stale users for new images
	){
		// calendar (attached in separate method) => 

		const css = {
			top			: {position:"fixed",top:"0px",left:'0px',width:'100%',height:"80px",'z-index':'3000',background:'rgba(255,255,255,0.9)',overflow:"auto"},
			leftPanel	: {margin:"0",padding:"0",display:'inline-block'},
			star		: {display:'inline-block'},
			userLink	: {display:'inline-block'},
			calendar	: {position:'fixed',right:'2px',top:'0',background:"white",border:"thin solid gray"},
			actionLinkContainer		: {position:'absolute',right:'400px',top:'0'},
			counts		: {display:'inline-block'},
			progress	: {display:'inline-block', width:"150px", height:"15px","font-size":"12px", padding:'2px',color:'#060'},
		};

		let visibleRowProgress;
		let top;
		let thumbDiv;
		let spacer;

		document.body.prepend(
			(spacer = $('div').css({height:css.top.height})).el,
			top = $('div').css(css.top).withChildren(
				$('div').css(css.leftPanel).withChildren(
					this.userStatusDiv = $('div').css(css.star).el,
					this.userDownloadCountsDiv = $('div').css(css.counts).el,
					makeScanNewImagesMenu(newImagesModel).css(css.userLink),
					visibleRowProgress = $('div').css(css.progress).el
				),
				this.calendarEl = $('div').css(css.calendar).el,
				this.$actionLinks = $('div').css(css.actionLinkContainer),	// holds action links
			).el,
			thumbDiv = $('div').el
		);

		setInterval(()=>spacer.css({height:top.style.height}),2000); // !!! ? does top height change?

		// bind to model
		new GalleryView( thumbDiv, visibleRowProgress, gallery );
		new Importer( $('input').appendTo(document.body).attr('type','file').attr('multiple',String(true)) );
	}

	// If page is a user-page, this binds to their models.
	showCurrentUser(userCtx: UserCtx, calendar:CalendarModel){
		this.userStatusDiv.append( makeUserStatusControl( userCtx ).el );
		this.userDownloadCountsDiv.append( makeDownloadCountsControl(userCtx).el );
		this.calendarEl.append( new CalendarView( calendar ).table ); // !!! instead of passing gallery to CalendarView, assign it directly to the Calendar model
	}

	// adds the prune-user button
	withActions(...actionEls:Array<HTMLElement|undefined>){
		this.$actionLinks.withChildren(...actionEls);
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
	// Create UI
	const div = $('div').css({padding:"2px",border:"thin solid green"});
	// UI-update function
	function updateUi() {
		div.txt(`↓ ${userCtx.downloadsInLastYear}`);
		const byYear = Object.entries(userCtx.byYear)
			.sort(byDesc(x=>x[0]))
			.map(x=>x[0]+':'+x[1]);
		if( 0 < byYear.length)
			div.attr('title',byYear.join(' '));
	}
	updateUi();
	userCtx.on( 'imageDownloaded', updateUi );

	return div;
}
