// ==UserScript==
// @name         Instagram 3
// @namespace    http://tampermonkey.net/
// @version      3
// @description  Make individual Instagram images more accessible.
// @author       Dean Rettig
// @run-at       document-start
// @require      file://C:/[monkeyBarsFolder]/storage.js
// @require      file://C:/[monkeyBarsFolder]/epoch_time.js
// @require      file://C:/[monkeyBarsFolder]/utils.js
// @require      file://C:/[monkeyBarsFolder]/snoop.js
// @require      file://C:/[monkeyBarsFolder]/dom2.js
// @require      file://C:/[monkeyBarsFolder]/observable.js
// @require      file://C:/[monkeyBarsFolder]/Instagram3.user.js
// @match        https://www.instagram.com/*
// @exclude      https://www.instagram.com/p/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_download
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

// Requires:
// (a) Developer mode
// (b) Allow User Scripts
// (c) Allow access to file URLs

(function() {
	'use strict';

	// Swallow apps console.log(...)
	unsafeWindow.console = { 
		__proto__:unsafeWindow.console,
		log:function(){ this.logArgs.push(arguments); }, logArgs:[],
	}

	unsafeWindow.WebSocket = makeNewWebSocket(unsafeWindow.WebSocket);

	const storageTime = EpochTime.JavascriptTime;

	const dom = {
		get focusUser         (){ return document.querySelector('div.x10wlt62.xlyipyv span').innerHTML; },
		get imageCountSpan    (){ return document.querySelector('div.x40hh3e span.html-span'); },
		get presentationCenter(){ return document.querySelector('div._aatk'); },
		get thumbRows         (){ return document.querySelectorAll('div._ac7v'); },
	}

	function buildRequestSnooper(){
		let showLogMessage = true; 
		function fetchInterceptor(url,options){
			if(url.contains('edge-chat.instagram.com')){
				if(showLogMessage){
					console.print("intercepted:",url);
					console.print('additional interceptions will not be shown.');
					showLogMessage = false;
				}
				return new Promise(()=>{}); // never resolves
			}
			return undefined;
		}

		const snooper = new RequestSnooper(unsafeWindow,{fetchInterceptor})
			.logRequests(({url})=> [
					'https://www.instagram.com/logging/falco',
					'https://graph.instagram.com/logging_client_events'
				].includes(url.toString()) == false
			);

		// scans log for the image and logs it.
		snooper.checkLogForMissingImage = (imgUrl) => {
			const matches = imgUrl.match(/.*?jpg/);
			if(matches === undefined){
				console.debug('missing image:',imgUrl);
				return;
			}
			const noQueryUrl = matches[0];
			const candidateResponses = snooper._loadLog.filter(x=>x.responseText.contains(noQueryUrl));
			const details = {
				imgUrl,
				simpleUrl:noQueryUrl,
				logMatches:candidateResponses,
			};
			if(candidateResponses.length != 0)
				details.cssPath = detectPath(candidateResponses[0].responseText,noQueryUrl);
			const css = candidateResponses.length != 0 ? 'color:purple' : '';
			console.debug(`Missing info - found %c${details.logMatches.length} matches`,css,details);
		}

		return snooper;
	}

	// return YYYYMMYYHHMMSS
	function formatDateForFilename(d=throwExp('date')){
		let parts = "FullYear,Month,Date,Hours,Minutes,Seconds".split(',').map(x=>d['get'+x]());
		parts[1]++; // month++
		function pad(x){ return (x<10?'0':'')+x;}
		return parts.map(pad).join('');
	}

	const calcDownloadsInLastYear = (function(now = new Date()) {
		const thisYear = now.getFullYear();
		const fractionOfPreviousYearToInclude = (storageTime.toNum(new Date(thisYear + 1, 0, 1)) - storageTime.toNum(now)) / (365*storageTime.DAYS);
		return function(byYear={}) {
			return (byYear[thisYear] || 0) + Math.round((byYear[thisYear - 1] || 0) * fractionOfPreviousYearToInclude);
		};
	})();
	function getTotalDownloads(byYear = {}) { return Object.values(byYear).reduce((sum, count) => sum + count, 0);}
	const countUserDownloads = x => calcDownloadsInLastYear(x.dl||{});

	// Returns urls of images under the given coords
	function getSourcesUnder({clientX,clientY}){
		function getBackgroundImage(el){
			if(!(el instanceof Element)) return null;
			const styles = getComputedStyle(el);
			const b = styles.backgroundImage || styles['background-image'];
			return b=='none' ? null : (b && b.substring(5,b.length-2));
		}
		return document.elementsFromPoint(clientX, clientY)
			.map(el => ({ el, src:el.src || getBackgroundImage(el) }))
			.filter(({src})=>src!=null);
	}

	function sanitizeImgUrl(url){ 
		const len = url.indexOf('?');
		return len < 0 ? url : url.substring(0,len);
		// return url.match(/.*?(jpg|webp|heic)/)[0];
	}

	// For each Pickgroup displayed, 
	// stores: date,following,liked,filename,index 
	// NOTE: 
	//      ImageInfo classes are initialized internally
	//      caller just gets ImageInfo and modify them, never create them.
	class ImageLookupByUrl{
		constructor(batchProducer){
			this._dict={};
			new HasEvents(this);
			batchProducer.listen('lastBatch',({lastBatch}) => {
				lastBatch.forEach(picGroup=>{ 
					this.addGroup( picGroup );
				});
			})
		}
		modValue(key,mod){
			key = this.sanitize(key);
			if(!this.hasKey(key))
				this._dict[key] = {singleImage:undefined,index:undefined};
			mod(this._dict[key]);
		}
		getValue(key){ key = this.sanitize(key); return this._dict[key]; }
		hasKey(key){ key = this.sanitize(key); return this._dict.hasOwnProperty(key); }
		sanitize(url){ return sanitizeImgUrl(url); } // extracts start through extension

		addGroup(group){
			try{
				group.pics.forEach( (single) => this.addSingle(single) );
			} catch (ex) {
				console.log('unable to save to images to lookup', this);
				throw ex;
			}
		}

		addSingle(singleImage){
			singleImage.images.forEach(({url})=> {
				this.modValue(url, x=> Object.assign(x,{singleImage}) );
			});
		}
		// End Monitoring

		getImageFor(imgUrl){

			if(this.hasKey(imgUrl)){
				const {singleImage} = this.getValue(imgUrl);
				if(singleImage)
					return singleImage;
			}

			this.trigger('missingImage',imgUrl);
			return null;
		}

		_missingStandIn = ""
	}

	// =======================
	// :: BasePicExtractor 
	// =======================
	// This section contains classes that Parse image-info 
	// out of the snooped HTTP responses

	function isFollowing(fs/* friendship_status */){
		return fs && (fs.following 
			|| fs.outgoing_request	// !!! this is wrong, need to group these with the Tracked, not the followed.
		);
	}

	// Monitors Batches as they come in and updates User data
	class UserUpdateService {
		constructor({userRepo,batchProducer,pageOwner}){
			this.userRepo=userRepo || throwExp('UserService missing userRepo');
			this.pageOwner = pageOwner;

			this.singlePicDownloadListener = this.singlePicDownloadListener.bind(this);
			batchProducer.listen('lastBatch',({lastBatch}) => {
				this.onScan_UpdateFollowingLikedLastUpload(lastBatch);
				this.registerDownloadListeners(lastBatch);
			})
		}

		onScan_UpdateFollowingLikedLastUpload(batch){

			batch.forEach(({owner,following,liked,date})=>{
				if(following || this.userRepo.containsKey(owner)){
					this.userRepo.update(owner,x=>{
						x.username = owner;
						if(following)
							x.isFollowing = following;
					})
				}

			});
		}

		registerDownloadListeners(batch){
			for(let {pics} of batch)
				for(let pic of pics)
					pic.listen('downloaded', this.singlePicDownloadListener);
		}

		singlePicDownloadListener({host:{owner,date},downloaded}){
			if(downloaded && owner ){ // && this.userRepo.containsKey(owner) - don't require this anymore, allow saving without prior tracking
				const year = date.getFullYear();
				this.userRepo.update(owner,u=>{
					u.username ??= owner; // temporary until we no longer need username.
					u.dl ??= {};
					u.dl[year] = (u.dl[year] || 0) +1;
					if (owner === this.pageOwner && (u.lastVisit || 0) < loadTimeMs)
						u.lastVisit = loadTimeMs;
				});
			}
		}
	}

	// 1 entire media group. May contain 1..many pics
	class PicGroup{

		owner// type:string			owner of the PicGroup
		date; // type:Date				date of the pic group
		pics; // type:SingleImage[]		all of the images in the group.
		following; // type:bool			are we following owner
		lat; lng;
		liked;
		isNew; // set by BatchProducerGroup
		isVisible; // used by SidePanel to hide/show groups

		constructor({owner,date,pics,following,lat,lng,liked,captionText}){
			Object.assign(this,{owner,date,pics,following,lat,lng,liked,captionText});
			new Observable(this).define('isVisible',true); // observable for hiding/showing in side panel
			this.sanitizedImgUrl = sanitizeImgUrl(pics[0].smallestUrl);
		}

		get dateMs(){ return storageTime.toNum(this.date); }

		static fromMediaWithUser(dto){
			const {user,taken_at,device_timestamp,carousel_media,usertags,image_versions2,lat,lng,has_liked,caption} = dto;
			const captionText = caption && caption.text;
			// other tags:  has_liked, has_privately_liked, has_viewer_saved
			// lat, lng
			// owner.id, owner.username
			// user.friendship_status.following
			// user.friendship_status.outgoing_request
			// user.full_name
			// user.is_private

			// these 2 values are missing from Tagged
			const owner = user.username;

			const date = storageTime.toDate(taken_at&&(taken_at*1000) || device_timestamp/1000 ); // one is too small, other too big
			// !!! TODO: if storageTime.toDate works correctly, this can be simplified to:
			//const date = storageTime.toDate(taken_at || device_timestamp/1000 ); // device_timestamp is too big

			const pics = carousel_media && carousel_media
				.map(({usertags,image_versions2}) => SingleImage.fromMedia({usertags,image_versions2,owner,date})) 
					|| [SingleImage.fromMedia({usertags,image_versions2,owner,date})];
			const following = isFollowing(user && user.friendship_status);
			return new PicGroup({owner,date,pics,following,liked:has_liked,lat,lng,captionText});
		}

	}

	// The different resolution urls and tagged users for 1 Image
	// observable: downloaded
	class SingleImage{

		static fromMedia({usertags,image_versions2,owner,date=throwExp("date")}){

			const taggedUsers = SingleImage.parseUserTags(usertags);
			return new SingleImage( taggedUsers, image_versions2.candidates, owner, date ); // candidates is array of {url,width,height}
		}

		static fromUrlAndOwner(url,width,height,owner){
			return new SingleImage([],[{url,width,height}],owner,new Date());
		}

		static parseUserTags(usertags){
			try{
				return usertags
					&& usertags.in
						.sort(by(({position})=>position[0]))
						.map(x=>x.user.username)
					|| [];
			}
			catch(err){
				// this is expected on User's Tagged page
				// this missing tags are found on the TaggedPopupWindow
				// console.error('Unable to parse usertags:',JSON.stringify(usertags));
				return [];
			}

		}

		taggedUsers; // string[] - left to right
		images; // images: array of {url,width,height}
		largestUrl;
		smallestUrl;
		largestDimensionName; // "width" or "height"

		constructor(taggedUsers,images,owner,date){ // images: array of {url,width,height}
			this.taggedUsers = taggedUsers;

			// Remove Squares
			const nonSquareImages = images.filter(({height,width})=>height != width);
			console.debug(`${nonSquareImages.length} of ${images.length} are non-square`);
			if(images.length * 40 <= nonSquareImages.length * 100) images = nonSquareImages; // if at least 40% are non-square, use only them.

			this.images = images.sort(by(({height})=>height)); // smallest to largest
			this.smallestUrl = this.images[0].url;
			this.largestUrl = this.images[this.images.length-1].url;
			this.largestDimensionName = images[0].width < images[0].height ? "height" : "width";

			// Needed for calculating filename, but can we remove otherwise?
			this.owner = owner;
			this.date = date;
			
			const ext = this.smallestUrl.contains(".webp") ? ".webp" : ".jpg";
			this.filename = [owner,...taggedUsers].slice(0,10).join(' ')
				+' '+formatDateForFilename(date) + ext;
			new Observable(this).define('downloaded',false);
		}

		getThumbUrl(minSize=0){
			const largerThanRequested = this.images.filter(({width,height})=>minSize<Math.max(width,height));
			return largerThanRequested.length ? largerThanRequested[0].url : this.largestUrl;
		}

		// Downloads the cleaned-up URL of the requested url
		async downloadAsync(requestedUrl,onprogress){ // $$$
			const matching = this.images.filter(({url}) => url.includes(requestedUrl)).reverse();
			await downloadImageAsync({url:matching[0] || requestedUrl, filename:this.filename, onprogress });
			this.downloaded=true;
			console.print(`downloaded: ${this.filename}`);
		}

		async downloadLargestAsync(onprogress){
			await downloadImageAsync({url:this.largestUrl, filename:this.filename, onprogress });
			this.downloaded=true;
			console.print(`downloaded: ${this.filename}`);
		}

	}

	class BasePicExtractor {
		constructor(){
			new Observable(this).define('lastBatch', []);
		}

		snoop = (x) => {
			if(!this.matches){
				console.log( ':', this.constructor["name"] );
				return false;
			}
			const {url,body} = x;
			if(this.matches(url,body)){
				apiTimes.touch(this.constructor.name);
				this.processResponse(x);
				x.handled = this.constructor["name"];
			}
		}

		processResponse(x){
			const {responseText,id} = x;
			try{
				const json = JSON.parse(responseText);
				// array of PicGroup
				const batch = this.findMediaArray(json)
					.map(PicGroup.fromMediaWithUser);

				this.lastBatch = x.batch = batch; // setting .lastBatch triggers event
			}catch(err){
				if(this.handleError){
					this.handleError(err,responseText,id);
					return;
				}
				console.error('Error parsing responseText', err);
			}
		}
	}

	// https://www.instagram.com/api/v1/feed/saved/posts/ ...stuff
	class SavedPosts extends BasePicExtractor {
		constructor(snooper){
			super();
			snooper.addHandler( this.snoop );			
		}
		matches({pathname}){ return pathname=="/api/v1/feed/saved/posts/"; }
		findMediaArray(json){ return json.items.map(x=>x.media); }
	}

	// https://www.instagram.com/api/v1/feed/user/1560767330/?count=12&max_id=3091713838536813928_1560767330
	class UserPosts extends BasePicExtractor {
		constructor(snooper){
			super();
			snooper.addHandler( this.snoop );			
		}
		matches({pathname}){ 
			return pathname.startsWith("/api/v1/feed/user/");
		}
		findMediaArray(json){ return json.items; }
	}

	// Called for a Tagged Popup-Window (may be redundant)
	class TaggedPopupWindow extends BasePicExtractor {
		constructor(snooper){
			super();
			snooper.addHandler( this.snoop );
		}
		// https://www.instagram.com/api/v1/media/3018008531365446145/info/
		matches({pathname}){ return pathname.startsWith('/api/v1/media/') && pathname.endsWith('/info/'); }
		findMediaArray(json){ return json.items; }
	}

	const GQL1 = "xdt_api__v1__feed__user_timeline_graphql_connection";
	const GQL2 = "xdt_api__v1__usertags__user_id__feed_connection";
	class GraphQLExtractor extends BasePicExtractor {

		// stores the DATA-PROP name of the response
		static configurations = {

			// Users "Posts" tab
			"PolarisProfilePostsQuery":{simple:"Post-0", mainPropName:GQL1}, // initial
			"PolarisProfilePostsTabContentQuery_connection":{simple:"Post-n", mainPropName:GQL1}, // scrolling down

			// Tagged Tab 
			"PolarisProfileTaggedTabContentQuery":{simple:"Tag-0", mainPropName:GQL2}, // initial
			"PolarisProfileTaggedTabContentQuery_connection":{simple:"Tag-N", mainPropName:GQL2} // more

			// "PolarisProfilePostsTabContentQuery_connection":GQL1,

		};
		// Unknown: PolarisProfileSuggestedUsersWithPreloadableDirectQuery

		constructor(snooper){
			super();
			snooper.addHandler( this.snoop );
		}

		// override handle() so we can attach .friendlyName to object.
		snoop = (x) => {
			const {url:{pathname},body,responseText,id} = x;
			if( this.matchesPath(pathname) ){
				x.bodyParams = new URLSearchParams(body);
				x.friendlyName = x.bodyParams.get('fb_api_req_friendly_name');

				if( x.friendlyName in GraphQLExtractor.configurations ){
					const {simple,mainPropName} = GraphQLExtractor.configurations[x.friendlyName];
					this.mainPropName = mainPropName;
					x.handled = `${this.constructor["name"]}-${simple}`;
					this.processResponse(x);
				}
			}
		}

		matchesPath(pathname){
			return pathname=='/api/graphql'   // old way
				|| pathname=='/graphql/query'; // new way
		}

		findMediaArray(json){
			try{
				const {data,errors} = json;
				if( errors && errors.length>0 ){
					console.log("Query error",json);
					return [];
				}
				const dataProp = data[this.mainPropName];
				return dataProp.edges
					.map(edge=>edge.node);
			}
			catch(ex){
				console.log('Unable to find media array: '+this.dataPropName, json);
				return [];
			}
		}
	}

	class LocationBase extends BasePicExtractor {
		constructor(){super();}
		mediaFromSectionParent(sectionParent){
			if(sectionParent.status=='fail' || !sectionParent.sections){
				console.error('Fail',sectionParent);
				return [];
			}
			const media = sectionParent.sections
				.filter(s=>s.layout_type=='media_grid')
				.map(sec=>sec.layout_content.medias.map(media=>media.media))
				.flat(1);
			return media;
		}
	}

	// Initial Load. Contains (Location-Header,top,recent)
	 class Location1Posts extends LocationBase {
		constructor({snooper,startingState,locRepo}){
			super();
			snooper.addHandler( this.snoop );
			this.startingState = startingState;
			this.locRepo = locRepo;
		}
	 	matches({pathname}){
	 		return pathname=='/api/v1/locations/web_info/';
	 	}
		findMediaArray(json){
			apiTimes.touch(this.constructor.name);

			const {ranked,recent,location_info} = json.native_location_data;
			const {lat,lng,media_count} = location_info;
			// Record Header info
			if(lat!=null)
				this.locRepo.update(this.locKey, x=>Object.assign(x,{lat,lng}));

			return [
				this.mediaFromSectionParent(ranked),
				this.mediaFromSectionParent(recent)
			].flat(1);
		}
		handleError(err,responseText,id){
			console.error('Error parsing Loc1 response.',err);
			if(this.startingState.lastVisit){
				const key = this.locKey;
				const lv = this.startingState.lastVisit;
				console.log(`Resetting ${key} to ${lv}`);
				this.locRepo.update(key, x=>x.lastVisit=lv);
			}
		}
		get locKey(){ return this.startingState.slug+' '+this.startingState.id; }
	}

	// https://www.instagram.com/api/v1/locations/web_info/?location_id=1251125&show_nearby=false
	 class Location2Posts extends LocationBase {
	 	constructor(snooper){
	 		super();
			snooper.addHandler( this.snoop );
	 	}
	 	matches({pathname}){
	 		return pathname.startsWith('/api/v1/locations/') 
	 			&& pathname.endsWith('/sections/');
	 	}
		findMediaArray(json){
			apiTimes.touch(this.constructor.name);
			return this.mediaFromSectionParent(json);
		}
	}

	const apiTimes = new SyncedPersistentDict('apiTimes');
	apiTimes.touch = function(key){ const ts = new Date().valueOf();  this.update(key, x => x.timeStamp=ts); }

	// Searches GrqphQL response trees matching the [friendlyName] for [edges] property.
	class GraphQLEdgeFinder {
		constructor(snooper,friendlyName){
			new Observable(this).define('lastBatch', []);
			this.friendlyName = friendlyName;
			this.handledLabel = `${this.constructor["name"]}(${friendlyName})`;
			snooper.addHandler( this.snoop );
		}
		snoop = (x) => {
			apiTimes.touch(this.handledLabel);

			const {url,body} = x;
 			if(url.pathname=='/graphql/query' && new URLSearchParams(body).get('fb_api_req_friendly_name')==this.friendlyName){
				this.processResponse(x);
				x.handled = this.handledLabel;
			}
		}
		processResponse({data}){
			// const edges = data.data.xdt_location_get_web_info_tab.edges; // hardcode path
			const edges = findProp(data,'edges'); // alternate, more flexible, slower
			this.lastBatch = edges.map(x=>x.node).map(PicGroup.fromMediaWithUser);
		}
	}

	// removes all properties of the haystack object tree that does not include the needle text
	function pruneHay( haystack, needle ){
		const hayOnly = [];
		for(let hay in haystack){
			const smallerHaystack = haystack[hay];
			if( !JSON.stringify(smallerHaystack).includes(needle) )
				hayOnly.push(hay);
			else if(typeof smallerHaystack == 'object')
				pruneHay(smallerHaystack,needle);
		}
		hayOnly.forEach(hay => delete haystack[hay]);
	}

	// Searches object tree for a property that matches the needle and returns that props value.
	function findProp(host,needle){
		if(typeof(host) == "object")
			for(let prop in host){
				if(prop==needle) return host[prop];
				const value = findProp(host[prop],needle);
				if(value !== undefined)
					return value;
			}
		return undefined;
	}

	// Something like this could be used to find the Path to a particular string/value.
	// function findProp(host,needle){
	// 	const ns = `"${needle}"`;
	// 	if(typeof(host) == "object")
	// 		for(let prop in host){
	// 			if(prop==needle) return host[prop];
	// 			const value = host[prop],json = JSON.stringify(value) || '';
	// 			if(json.contains(ns))
	// 				return findProp(value,needle);
	// 		}
	// 	return undefined;
	// }


	// ===========
	// ::User
	// ===========
	// Track last: visit, download, heart, post
	/* class User{ 
		id; username; fullName isPrivate; isFollowing; 
		lastVisit;  // visted profile page
	} */

	// Load followers by scrolling through list
	class FollowingScrollerTracker{
		constructor(snooper){
			new Observable(this).define("foundLeaders");
			snooper.addHandler( this.snoop );			
		}

		snoop = ({url,responseText}) => {
			const match = url.pathname.match(/friendships\/(\d+)\/following/);
			if(match===null) return;
			const followerId = match[1];
			const leaders = JSON.parse(responseText).users;
			this.foundLeaders = {followerId,leaders};
		}
	}

	// Next Link
	class NextLink {
		label; nextUrl; count;
		constructor({label,nextUrl,count}){
			Object.assign(this,{label,nextUrl,count});
		}
		goto(){
			console.print(`${this.count} ${this.label}.`);
			if(this.nextUrl)
				setTimeout(()=>window.location.href=this.nextUrl,2000);
		}
		// UI stuff
		appendTo(host){
			const { label, nextUrl, count } = this;
			if (!nextUrl) return;
			el("div")
				.txt(`${label}: ${count}`)
				.css({ textDecoration: "underline", cursor: "pointer", fontSize: "12px" })
				.on("click", () => document.location.href = nextUrl)
				.appendTo(host);
		}
		static forFirstUser(label,users){
			return new NextLink({ label, count:users.length, nextUrl:users.length?'/'+users[0].username+'/':undefined });
		}
	}

	// Identifies UNHANDLED Snoop Requests
	// Should always be processed LAST
	class IdentifyUnhandledRequests {
		constructor(snooper){
			snooper.addHandler( this.snoop );			
		}
		snoop = (x) => {
			if(x.handled) return;
			let desc = this.getDescription(x);
			if(desc)
				x.notHandled = `[${desc}]`;
		}
		getDescription({url:{pathname}}){
			let desc = {
				'/ajax/bz': "ajax/bz",
				'/ajax/bulk-route-definitions/': 'bulk-routes',
				'/api/v1/web/fxcal/ig_sso_users/': "ig_sso_users",
				'/ajax/bootloader-endpoint/': "boot-endpoint",
				'/api/v1/feed/reels_tray/': "reals_tray",
				'/api/v1/web/accounts/fb_profile/': "fb_profile",
				'/sync/instagram/': "sync"
			}[pathname] || (function(){
				if(pathname.endsWith('/comments/')) return "comments";
				if(pathname.endsWith('.js')) return 'javascript';
				if(pathname.startsWith('/btmanifest/')) return 'btManifest';
				if(pathname.includes('graphql')){ return 'graphql'; }
			})();
		}
	}

	// When visiting someones page (aka their 'Posts' tab)
	// checks if we are following them and if so, saves following=true status to userRepo
	class VisitingUserTracker {
		constructor(snooper,userRepo){ 
			this._userRepo = userRepo;
			snooper.addHandler( this.snoop );
		}
		snoop = (snoopRequest) => {
			const {url,body,responseText} = snoopRequest;
			if(url.pathname=='/graphql/query' && new URLSearchParams(body).get('fb_api_req_friendly_name')=='PolarisProfilePageContentDirectQuery'){
				snoopRequest.handled = this.constructor["name"];
				const {user} = snoopRequest.data;
				const following = isFollowing(user.friendship_status);
				if(following || this._userRepo.containsKey(user.username)){
					// record Following - lastVisit
					this._userRepo.update(user.username,u=>{
						u.id = user.id;
						u.username = user.username;
						u.fullName = user.full_name;
						u.isPrivate = user.is_private;
						u.isFollowing = following;
						u.lastVisit = loadTimeMs;
					});
					setPublicPrivateLabel(user.is_private);
				}
			}
		}
	}

	// Unfollowing
	class UnfollowTracker{
		constructor(snooper,userRepo){
			this._userRepo=userRepo;
			snooper.addHandler( this.snoop );
		}
		snoop = ({url,body,responseText}) => {
			if(url.pathname=='/graphql/query' && new URLSearchParams(body).get('fb_api_req_friendly_name')=='usePolarisUnfollowMutation'){
				const {data:{xdt_destroy_friendship:{username,friendship_status}}} = JSON.parse(responseText);
				console.log('unfriending: ',username);
				this._userRepo.update(username,x=>x.isFollowing=false);
			}
		}
	}

	// ======================
	// ===  Downloading  ====
	// ======================

	let mousePos = {};
	window.addEventListener('mousemove', ({clientX,clientY}) => { mousePos={clientX,clientY}; });

	function getCenterOfPresentation(){
		const el = dom.presentationCenter;
		if(el==null) return;
		el.style.border="thick solid red";
		const r = el.getBoundingClientRect();
		return { clientX:(r.left+r.right)/2, clientY:(r.top+r.bottom)/2};
	}

	let missingStandIn = "";
	function getImageUnderPoint(point,iiLookup){

		// sometimes the image we want to download is missing imageInfo
		// and this filter is preventing downloading it.
		const sources = getSourcesUnder(point);
		if(sources.length==0){ console.log('no img'); return; }
		const source = sources[0], imgUrl = source.src;

		const singleImage = iiLookup.getImageFor(imgUrl);

		if(singleImage != null) return { singleImage, imgUrl };

		// get the owner/username
		const newMissingStandIn = prompt("Please enter username", missingStandIn);
		if(newMissingStandIn == null) return null;
		missingStandIn = newMissingStandIn;

		// still let them download it
		return { singleImage:SingleImage.fromUrlAndOwner(imgUrl,source.width,source.height,missingStandIn), imgUrl };
	}

	async function simpleDownloadImageUnderPoint(point,pageOwner){

		try{
			// sometimes the image we want to download is missing imageInfo
			// and this filter is preventing downloading it.
			const sources = getSourcesUnder(point);
			if(sources.length==0){ console.log('no img'); return; }
			const imgUrl = sources[0].src;
			if(imgUrl.startsWith('blob:')){
				console.log(`Has 'blob:' prefix. Not an image.`, imgUrl );
				// assume video element, save current image.
				const videoElement = sources[0].el;
				const canvas = document.createElement("canvas");
				const context = canvas.getContext("2d");
				function extract(){
					canvas.width = videoElement.videoWidth;
					canvas.height = videoElement.videoHeight;
					context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
					// Get the image data URL
					const coverImageSrc = canvas.toDataURL("image/jpeg"); // canvas.toDataURL({ format: 'png' });
					const extractFilename = (pageOwner || 'instagram_img') + ' '+formatDateForFilename(new Date())+ '.jpg';
					GM_download({ url: coverImageSrc, name: extractFilename });
				}
				extract();
				// videoElement.addEventListener("loadeddata", extract);
				return;
			}

			const filename = (pageOwner || 'instagram_img') + ' ' + formatDateForFilename(new Date()) + '.' + await getExtensionFromBlobType(imgUrl);
			await downloadImageAsync({url:imgUrl,filename});
			console.log(`downloaded: ${filename}`);
		}catch (ex){
			console.error(ex);
		}
	}

	function detectPath(blob,needle){
		let path = []
		let item = JSON.parse(blob);
		function keyHasNeedle(key){ return JSON.stringify(item[key]).contains(needle); }
		while(true){
			var keys = (item == null || typeof(item) == "string") ? [] : Object.keys(item);
			if(keys.length == 0) break;
			const matchingChildren = keys.filter(keyHasNeedle);
			var match = matchingChildren[0];
			path.push(match);
			item = item[match];
		}
		return path;
	}

	async function getExtensionFromBlobType(url){
		// replace url with Blob (requires Tampermonkey beta)
		const response = await fetch(url);
		const blobUrl = await response.blob();
		switch(blobUrl.type){
			case 'image/webp': return "webp";
			case 'image/jpeg': return "jpg";
		}
		console.log(`Unknown mimetype [${url.type}]`);
		return "jpg";
	}

	async function downloadImageAsync({url,filename,onprogress}){
		if(!onprogress) onprogress = ({loaded,total})=>{};

		console.debug('GM_download:',{url,filename});
		await new Promise((onload,onerror)=>{
			const ontimeout = (x)=>onerror({"error":"timeout"});
			GM_download({ url, name:filename, onload, onerror, onprogress, ontimeout });
		});

	}

	// =====================================
	// ===  Update Thumbs as we scroll  ====
	// =====================================

	function msToAgeString(ageMs){
		const daysOld = (ageMs) / storageTime.DAYS;
		const {divider,label,color:ageColor}
			= (daysOld < 3) ? {divider:1,label:'day',color:'red'}
			: (daysOld < 14)  ?{divider:1, label:'day',color:'green'}
			: (daysOld < 365) ? {divider:30, label:'month',color:'blue'}
			: {divider:365,label:'year',color:'black'};
		const num = Math.floor(daysOld*10/divider)/10;
		const s = (num != 1) ? "s" : "";
		const ageText = `${num} ${label}${s}`;
		return {ageText,ageColor};
	}

	// ===============
	// Add UI Elements
	// ===============
	async function addCopyButton(pageOwnerName){ // fire and forget
		const h2El = querySelectorAsync('h2');
		const button = el("div")
			.txt("📋")
			.css({ margin: "3px", padding: "2px", cursor: "pointer", color: "black" })
			.on("click", async () => {
				await navigator.clipboard.writeText(pageOwnerName);
			});
		const referenceEl = (await h2El).parentNode;
		referenceEl.parentNode.insertBefore(button,referenceEl);
	}

	let publicPrivateSpan = null;
	function setPublicPrivateLabel(isPrivate){
		if(publicPrivateSpan == null) {
			// quickly - create el (so we don't enter this body twice)
			publicPrivateSpan = document.createElement('span');
			// eventually - add to DOM
			querySelectorAsync('div._ap3a')
				.then( div => div.appendChild(publicPrivateSpan) );
		}

		// only set it if previously undefined
		if(publicPrivateSpan.isPrivate === undefined){
			publicPrivateSpan.isPrivate = isPrivate;
			publicPrivateSpan.textContent = isPrivate ? "-Private" 
				: (isPrivate === false) ? "-Public"
				: "-Unknown";
		}
	}

	// =============
	// Key Presses
	// =============
	function trackKeyPresses({iiLookup,pageOwner,sidePanel}){

		// Built In:
		// L => Like / Un-Like a post
		// S => Save / Un-Save a post

		unsafeWindow.addEventListener('keydown',function({which,repeat,ctrlKey,altKey,shiftKey}){
			if(repeat) return;

			function downloadImageInCenter(){
				const imageInfo = getImageUnderPoint(getCenterOfPresentation()||mousePos,iiLookup);
				if(imageInfo==null) return;
				const {singleImage,imgUrl} = imageInfo;
				singleImage.downloadAsync(imgUrl);
			}

			function findEl(css){ return (document.querySelector(css)||{click:function(){console.debug(`${css} not found.`)}}); }
			function previousInSet(){ findEl('div.html-div>div>button[aria-label="Go back"]').click(); }
			function nextInSet(){ findEl('div.html-div>div>button[aria-label="Next"]').click(); }

			function downloadImageUnderMouse(){ simpleDownloadImageUnderPoint(mousePos,pageOwner); }

			function openFocusUserProfilePage(){
				const focusUser = dom.focusUser;
				console.debug('focus User', focusUser);
				if(focusUser){
					GM_openInTab(`https://instagram.com/${focusUser}`);
				} else
					console.log('No focusUser found.');
			}

			function showTaggedUsersUnderMouse(){
				const found = getImageUnderPoint(getCenterOfPresentation()||mousePos,iiLookup);
				if(found==null) return;
				const {singleImage:{owner:imgOwner,taggedUsers}} = found;
				console.log(imgOwner,taggedUsers);
			}

			function saveUsersToFile(){
				if(ctrlKey && shiftKey){
					const filename = `instagram.localStorage.users ${formatDateForFilename(new Date())}.json`;
					downloadTextToFile(localStorage.users,filename);
					console.log("localStorage.users save to "+filename);
				}
			}
			const UP='&',DOWN='(';
			const key=String.fromCharCode(which), actions = {
				" ": downloadImageInCenter,
				[UP]: previousInSet,
				[DOWN]: nextInSet,
				"D": downloadImageUnderMouse,
				"P": openFocusUserProfilePage,
				"T": showTaggedUsersUnderMouse,
				"U": saveUsersToFile,
				"O": () => sidePanel.openLast(),
				"X": () => sidePanel.closeFirst(),
			}, action = actions[key] || function(){console.debug(`no action found for which:${which}`)};
			action();

		});
	}

	// Convert string to a # from 0..1
	function strToFloat(str){
		function cc(a,i=0){ return a.charCodeAt(i);}
		const v = [0,1,2].map(i=>{const k=str[i]||'0',[b,o] = ('0'<=k&&k<'9')?['0',1]:('a'<=k&&k<'z')?['a',11]:[k,0]; return cc(str,i)-cc(b)+o; });
		return (v[0]*37*37 + v[1]*37 + v[2])/(37*37*37);
	}

	// ===============
	// === Reports ===
	// ===============

	// AKA younger than
	function getRefreshTime(x) {
		const downloads = calcDownloadsInLastYear(x.dl);
		if (downloads <= 0) return false;

		const { MONTHS, DAYS } = storageTime;
		const timeframe = downloads >= 20 ? 1 * MONTHS
			: downloads >= 10 ? 2 * MONTHS
			: downloads >= 5  ? 3 * MONTHS
			: downloads >= 1  ? 6 * MONTHS 
			: 6 * MONTHS;

		return (x.lastVisit || 0) + timeframe
			+ Math.floor((strToFloat(x.username) - 0.5) * 14 * DAYS); // spread out over 14 days
	}

	function lastVisitWithinThreshold(lastVisit,threshold){ return loadTimeMs <= (lastVisit||0) + threshold; }
	function lastVisitOlderThanThresholdOrMissing(lastVisit,threshold){ return !lastVisitWithinThreshold(lastVisit,threshold); } // AKA "stale"
	const filters = {
		followed:{
			// FOLLOWED with unknown status.
			stale: (timeframe) => (x) => x.isFollowing && lastVisitOlderThanThresholdOrMissing(x.lastVisit,timeframe),
			// FOLLOWED that are public. - and maybe LOTS of followers.
			public: (x) => x.isFollowing && !x.isPrivate,
		},
		tracked:{ // AKA - not following
			//	- ALL tracked
			all: (x) => !x.isFollowing,
			//	- TRACKED that have not been visited in a while
			stale: (timeframe) => (x) => !x.isFollowing && !x.isPrivate && lastVisitOlderThanThresholdOrMissing(x.lastVisit,timeframe),
			//	- PRIVATE that might be public now.
			private: (x) => !x.isFollowing && x.isPrivate,
		},
		//	- DOWNLOADED that have not been visited in a while (stale)
		downloaded:{
			all: (x) => 0 < calcDownloadsInLastYear(x.dl),
			stale: (x) => 0 < calcDownloadsInLastYear(x.dl) && getRefreshTime(x) < loadTimeMs,
		}
	}
/*
Might want to review:
	Last Visit		Downloads
	T				T				=> process normal, if no downloads in last 4 years, prune
	F				T				=> need to visit, download anything between existing downloads and now, gives it a lastVisit
	T				F				=> may have had downloads prior to tracking downloads, need to identify if any downloads in last 2 or 4 years or else prune.
	F				F				=> Why are we tracking?  Either download something or prune.  Maybe these are people we are following?  Or Private?

	Order: Normal => Have Downloads (easy to visit) => Identify old downloads or prune => prune

	Following / Private		=> might want to review to see if we want to keep following.
	
*/

	class UserReports{
		constructor({userRepo,iiLookup}){
			function showUsers(filter){ return userRepo.values().filter(filter); }
			this.followed={
				stale: (notVisitedDays=60)=>showUsers( filters.followed.stale(notVisitedDays*storageTime.DAYS) ).sort(by(x=>x.lastVisit||0)),
				public: ()=>showUsers(filters.followed.public),
			};
			this.tracked={
				stale: (notVisitedDays=60)=>showUsers(filters.tracked.stale(notVisitedDays*storageTime.DAYS)).sort(by(x=>x.lastVisit||0)),
				all: (notVisitedDays=60)=>showUsers(filters.tracked.all).sort(by(x=>x.username)),
				private: (notVisitedDays=60)=>showUsers(filters.tracked.private).sort(by(x=>x.username)),
			};
			this.downloaded = {
				all: () => showUsers(filters.downloaded.all).sort(byDesc(countUserDownloads).thenBy(getRefreshTime)),
				stale: () => showUsers(filters.downloaded.stale).sort(byDesc(countUserDownloads).thenBy(getRefreshTime)),
			};
			this.dayOfWeek = function() {
				const counts = [0, 0, 0, 0, 0, 0, 0];
				const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
				const imageDays = Object.values(iiLookup._dict)
					.filter(x => x.singleImage != null && x.singleImage.date != null)
					.map(x => x.singleImage.date.getDay());

				for (const day of imageDays) counts[day]++;
				return counts.map((count, idx) => [dayNames[idx], count]);
			};			
		}
	}

	class SidePanel{
		picGroups = [];

		outerCss = { position: "fixed", top: "5px", left: "150px", height: "95%", background: "#66C", padding: "5px", "margin-right": "120px", width: "350px" };
		headerCss = { "margin-bottom": "8px","font-size": "16px","font-weight": "bold","font-family": "Tahoma",color: "white",display: "flex","justify-content": "space-between","flex-direction": "row" };
		innerCss = { "overflow-y": "auto",width: "100%",height: "100%" };
		newImageCss = { border: "thick solid yellow", cursor: "pointer" };
		newImageSize = 300;		
		containerCollapsedWidth = "350px";
		elementId = "sidePanel";

		constructor({batchProducer,userRepo,pageOwner}){
			this._userRepo = userRepo;
			this.pageOwner = pageOwner;
			batchProducer.listen('lastBatch',x=>this.showNewBatches(x));
		}

		showNewBatches({lastBatch}){
			for(let picGroup of lastBatch)
				if(picGroup.isNew)
					this.addNewGroup(picGroup);
			this.updateHeaderText();
		}

		closeFirst(){
			// interact with model instead of view
			const visibleModels = this.picGroups
				.filter(m=>m && m.isVisible);
			if(visibleModels.length) visibleModels[0].isVisible=false;
		}
		openLast(){
			// interact with model instead of view
			const visibleModels = this.picGroups
				.filter(m=>m && !m.isVisible)
				.reverse();
			if(visibleModels.length) visibleModels[0].isVisible=true;
		}

		updateHeaderText() {
			if (!this.headerTextEl) return;
			const count = this.picGroups.filter(x => x.isVisible).length;
			this.headerTextEl.txt(`Groups: ${count}`);
		}

		// addNewGroup(picGroup){

		// 	if(this.newImageContainer == undefined)
		// 		this.createNewImageContainer();

		// 	this.picGroups.push(picGroup);
		// 	const {owner,liked,pics,captionText,date} = picGroup;

		// 	const rowDiv = document.createElement('DIV');

		// 	// Separator
		// 	const separator = this.buildSeparator({date,owner,captionText});
		// 	rowDiv.appendChild(separator);
		// 	// this.newImageContainer.appendChild(separator);

		// 	// Images
		// 	pics.forEach((singleImage,index) => {
		// 		const newImg = this.buildThumb({singleImage});
		// 		rowDiv.appendChild(newImg); // this.newImageContainer.appendChild(newImg);
		// 	});
		// 	picGroup.listen('isVisible',({isVisible})=>{
		// 		rowDiv.style.display=isVisible ? "block" : "none";
		// 		this.updateHeaderText();
		// 	});

		// 	this.newImageContainer.appendChild(rowDiv);
		// }

		addNewGroup(picGroup) {
			if (this.newImageContainer == undefined)
				this.createNewImageContainer();

			this.picGroups.push(picGroup);
			const { owner, pics, captionText, date } = picGroup;

			const rowDiv = el("div").withChildren(
				this.buildSeparator({ date, owner, captionText }),
				...pics.map(singleImage => this.buildThumb({ singleImage }))
			);

			picGroup.listen("isVisible", ({ isVisible }) => {
				rowDiv.style.display = isVisible ? "block" : "none";
				this.updateHeaderText();
			});

			rowDiv.appendTo(this.newImageContainer);
		}

		buildSeparator({ date, owner, captionText }) {
			const separatorCss = { background: "blue", height: "30px", display: "block", color: "white" };
			const buttonCss = { margin: "0 5px", cursor: "pointer", border: "2px outset", padding: "1px 4px", fontSize: "10px" };
			const clickedButtonCss = { cursor: "default", opacity: "0.5", pointerEvents: "none", border: "2px inset", display: "inline-block" };

			const user = this._userRepo.get(owner) || {};
			const isTracking = this._userRepo.containsKey(owner);

			const downloadsInLastYear = countUserDownloads(user);
			const totalDownloads = getTotalDownloads(user.dl);
			const onOwnersPage = owner === this.pageOwner;

			const downloadText = totalDownloads > 0
				? ` ↓ ${downloadsInLastYear}/${totalDownloads}`
				: "";

			return el("div").cls("groupHeader").css(separatorCss).withChildren(
				el("span").txt(`${date.toDateString()} (${owner})${downloadText}${isTracking ? " - TRACKING!" : ""}`),
				onOwnersPage ? null : el("span").txt("OPEN").css(buttonCss).on("click", ({ currentTarget }) => {GM_openInTab(`https://instagram.com/${owner}`);currentTarget.txt("OPENED").css(clickedButtonCss);}),
				(onOwnersPage || isTracking) ? null : el("span").txt("NEW - SAVE").css(buttonCss).on("click", ({ currentTarget }) => {this.addOwnerToTracking(owner);currentTarget.txt("SAVED").css(clickedButtonCss);})
			);
		}		

		addOwnerToTracking(owner) {
			const newOwners = this.getNewOwners();
			newOwners.push(`${owner}\t${Date.now()}`);
			this.saveNewOwners(newOwners);

			console.print(`Add ${owner} => ${newOwners.length}`);
		}
		getNewOwners() { const value = localStorage["newOwners"]; return value ? value.split("\r\n") : []; }
		saveNewOwners(newOwners) { localStorage["newOwners"] = newOwners.join("\r\n"); }

		buildThumb({singleImage}){
			return el("img")
				.attr("src", singleImage.getThumbUrl(this.newImageSize))
				.css(this.newImageCss)
				.do(img => { img.style[singleImage.largestDimensionName] = `${this.newImageSize}px`; })
				.on("click", async (event) => {
					const img = event.currentTarget;
					img.css({ cursor: "wait" });
					await singleImage.downloadLargestAsync();
					img.css({ cursor: "default", opacity: "0.3" });
				});
		}

		createNewImageContainer() {
			this.outer = el("div").attr("id", this.elementId).css(this.outerCss).withChildren(
				el("h2").css(this.headerCss).withChildren(
					this.headerTextEl=el("span").txt("Hello World"), 
					this.toggle=el("span").txt(">>").css({ cursor: "pointer" })
						.on("click", (event) => {
							const toggle = event.currentTarget;
							const expand = toggle.textContent == ">>";
							toggle.txt(expand ? "<<" : ">>");
							this.outer.style.width = expand ? "auto" : this.containerCollapsedWidth;
						})
				),
				this.newImageContainer=el("div").css(this.innerCss)
			)
			.appendTo(document.body);
		}

	}

	// Monitors batches and decorates thumbnails
	class Gallery{

		// Model portion
		lookup; // dictionary: sanitirzedUrl => PicGroup

		constructor(batchProducer){
			this.lookup = {};
			this.strartWatchingThumbs();
			batchProducer.listen('lastBatch',x=>this.storeBatch(x));
		}

		storeBatch({lastBatch}){
			for(let picGroup of lastBatch)
				this.lookup[picGroup.sanitizedImgUrl] = picGroup;
		}

		// View portion - Periodically updates thumbs and pulls images 
		strartWatchingThumbs() { setInterval(()=>this.decorateThumbs(),1000); }

		decorateThumbs(){
			const rows = dom.thumbRows;
			if(rows.length==0) return;

			const rowOffset = rows[0].index // check 1st row
				|| rows[rows.length-1].index - (rows.length-1) // check last row
				|| 0;

			for(let i=0;i<rows.length;++i){
				const row = rows[i];

				// Add row-index label to row ("1..3", "64..66")
				if(row.index==null){
					row.index = rowOffset+i;
					row.style.position='relative';
					const child = document.createElement('div');
					child.textContent=`${row.index*3+1}-${row.index*3+3}`;
					Object.assign(child.style,{position:'absolute',bottom:'5px',right:'10px',background:'rgba(0,0,0,0.2)',padding:'2px 10px',color:'white'});
					row.appendChild(child);
				}

				// index child images (before adding label)
				for(let j=0;j<row.children.length;++j){
					const cell = row.children[j];
					if(cell.decorated) continue;
					const imgEl = cell.querySelector('img');
					if(imgEl == null )
						continue;

					const imgIndex = row.index*3+j;
					const sanitizedImgUrl = sanitizeImgUrl(imgEl.src);

					let picGroup = this.lookup[sanitizedImgUrl];

					if(picGroup == null) continue;

					this.decorateThumb({imgEl,picGroup});
					cell.decorated = true;
				}
			}
		}

		decorateThumb({imgEl,picGroup}){
			const {following,liked,pics} = picGroup;
			const {ageText,ageColor} = msToAgeString(loadTimeMs-picGroup.dateMs);
			const isNew = picGroup.isNew;

			// Store the thumbUrl we used to find the pic-group
			picGroup.thumbUrl = imgEl.src;

			// Verify urls match
			const a = sanitizeImgUrl(imgEl.src);
			const b = sanitizeImgUrl(picGroup.pics[0].smallestUrl);
			if( a != b )
				console.warn("Group urls do not match", a, b);

			// Setup host
			const host = imgEl.parentNode;
			host.style.position='relative';

			// Add top-left text
			const style = {
				...(isNew 
					? {color:'black',background:'yellow'}
					: {color:'white',background:ageColor}
				),
				...(following
					? {border:'solid black thick',fontWeight:900}
					: {}
				),
				position:'absolute',
				zIndex:1000,
			};
			let txt = `Age: ${ageText}`
			if(liked) txt += " ♥ ";
			if(isNew) txt += " NEW! ";
			const span = document.createElement('SPAN');
			Object.assign(span.style,style);
			span.innerText = txt;
			host.appendChild(span);

			if(pics.length > 1){

				// Add bottom left
				const showImagesSpan = document.createElement('SPAN');
				showImagesSpan.innerText = `+ ${pics.length-1}`;
				Object.assign(showImagesSpan.style,{ position:'absolute', bottom:0, zIndex:1000, 
					color:"red", background:"white", border:"thin solid red","border-radius":"4px",
					"font":"bold 28px Arial",
					padding:"4px 12px",
				});
				host.appendChild(showImagesSpan);
				showImagesSpan.addEventListener('click',function(event){
					event.stopPropagation(); // don't open image
					event.preventDefault(); // 

					// Remove that damn overlay that grays out the cell
					const hideGrayOverlay = () => {

						try{
							const aElement = this.parentNode.parentNode.parentNode;
					    	const ul = aElement.querySelector('ul');
							if(ul){ // sometimes it the ui messes up and doesn't add the ul
								ul.parentNode.style.display = 'none';
								ul.parentNode.parentNode.style.display = 'none';
							}
						} catch(error){
							console.error(error); // some times the parentNode chain doesn't work...
						}
					}
					hideGrayOverlay();

					this.remove();

					const numPerRow = 4;
					const {width,height} = imgEl, clipSize = width / numPerRow;

					const clipStyle = {
						position:'absolute',
						width: (clipSize-4)+"px",
						height:(clipSize-4)+"px",
						border:"thick solid black",
					}
					
					const thumbPics = pics.slice(1);
					const rowsNeeded = Math.floor((thumbPics.length-1) / numPerRow) + 1;
					thumbPics.forEach((si,index) => {
						const newImg = document.createElement('IMG');
						newImg.setAttribute('src',si.smallestUrl)
						Object.assign(newImg.style,clipStyle);
						const colIndex = index % numPerRow, rowIndex = (index - colIndex)/numPerRow;
						newImg.style.left = (colIndex*clipSize)+"px";
						const useRow = (rowsNeeded-rowIndex-1);
						newImg.style.bottom = (useRow*clipSize)+"px";
						host.appendChild(newImg);
					})

				})
			}
		}

	}

	function downloadTextToFile(text,filename){
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text])); // old way that doesn't handle '#' a.href = "data:text,"+text;
		a.download = filename;
		a.click();
	}

	// ===============
	// ===  INIT  ====
	// ===============
	function reportLast(lastVisit,label){
		// depends on: loadTimeMs
		if(0<lastVisit){
			const lvd = storageTime.toDate(lastVisit).toDateString();
			const {ageText,ageColor} = msToAgeString(loadTimeMs-lastVisit);
			const ageStyle =`color:white;background-color:${ageColor};`;
			console.print(`Last ${label}: %c${ageText}%c ago on %c${lvd}`,ageStyle,'color:black;background-color:white;',ageStyle);
		}
	}

	class InitialLocationPageParser {
		constructor(){
			new Observable(this).define('lastBatch', []);
			this.id = setInterval(()=>this.scanScriptsForMedia(),3000);
		}
		scanScriptsForMedia(){
			const parsedScripts = [...unsafeWindow.document.querySelectorAll('script')]
				.filter(x=>x.innerHTML.contains('edges')) // or 'xdt_location_get_web_info_tab'
				.map(x=>findProp(JSON.parse(x.innerHTML),'edges')) // find property called 'edges'
				.filter(x=>x!==undefined);
			if(parsedScripts.length != 1){
				console.log(`${parsedScripts.length} media-nodes scrips found.`); // not expected
				return;
			}
			try{
				// trigger event to notify everything that we have new data
				this.lastBatch = parsedScripts[0].map(x=>x.node).map(PicGroup.fromMediaWithUser);
				// console.log("Initial Location Images",this.lastBatch);
			} catch(ex){
				console.error(ex);
			}
			clearInterval(this.id);
		}
	}

	class LocationPage{
		constructor(){
			const userRepo = new SyncedPersistentDict('users');
			const snooper = buildRequestSnooper();
			const locRepo = new SyncedPersistentDict('locations');

			// Capture Starting State before anything modifies it.
			const [,id,slug] = document.location.href.match(/instagram.com\/explore\/locations\/([^\/]+)\/([^\/]+)/);
			const location = `${slug} ${id}`;
			const isTracking = locRepo.containsKey(location);
			const startingState = isTracking 
				? structuredClone(locRepo.get(location)) // because repo will modify original object
				: {}; // leave empty so we can detect not-visited
			console.log(location,JSON.stringify(startingState,null,'\t'))
			reportLast(startingState.lastVisit,'Visit');

			// Route Batch Producers to Batch Consumers
			const batchProducer = new BatchProducerGroup(startingState.lastVisit,[
				new Location1Posts({snooper,startingState,locRepo}),
				new Location2Posts(snooper),
				new GraphQLEdgeFinder(snooper,'PolarisLocationPageTabContentQuery_connection'), // used: 2025-04-06
				new GraphQLEdgeFinder(snooper,'PolarisLocationPageTabContentQuery'),			// used: 2025-04-06
				new InitialLocationPageParser()
			]);
			new UserUpdateService({userRepo,batchProducer});
			const gallery = new Gallery(batchProducer);
			const sidePanel = new SidePanel({userRepo,batchProducer});
			const iiLookup = new ImageLookupByUrl(batchProducer);
			iiLookup.on('missingImage',	snooper.checkLogForMissingImage);

			const CTX = unsafeWindow.cmd = {
				// global
				snoopLog:snooper._loadLog,
				userRepo,
				iiLookup,
				// location
				location,
				locRepo,
				gallery,
				startingState
			};
			CTX.reports = new UserReports(CTX);

			if(isTracking){
				locRepo.update(location,x=>x.lastVisit=loadTimeMs)
			} else {
				CTX.track = function(){ locRepo.update(location,u=>{
					u.slug=slug;
					u.id=id;
					u.lastVisit=loadTimeMs;
				}); }
			}
			CTX.stop = function(){
				if(confirm(`Remove all tracking info for ${location}?`))
					locRepo.remove(location);
			}

			trackKeyPresses({iiLookup,sidePanel});
		}
	}

	// Grab good title before Instagram replaces it with 'Instagram' OR never resolves
	function getGoodTitleAsync(timeoutAfter = 10000){
		return new Promise((resolve) => {
			function logAndResolve(val){console.debug('page title:'+val); resolve(val);}
			const timeoutAt = new Date().valueOf() + timeoutAfter;
			const titleLog = [];
			const intervalId = setInterval(function(){
				const title = document.title, isGood = title !== '' && title !== 'Instagram', timedOut = timeoutAt <= new Date().valueOf();
				titleLog.push(title);
				if(isGood) logAndResolve(title);
				if(timedOut) { console.debug(titleLog); logAndResolve( document.location.pathname.split('/')[1] ); }
				if(isGood || timedOut) clearInterval(intervalId);
			},200)
		});
	}
	function getImageCountAsync(timeoutAfter = 2000){
		return new Promise((resolve) => {
			const timeoutAt = new Date().valueOf() + timeoutAfter;
			const intervalId = setInterval(function(){
				const imageCountSpan = dom.imageCountSpan;
				const foundSpan = imageCountSpan != undefined;
				const timedOut = timeoutAt <= new Date().valueOf();
				if(foundSpan) resolve(imageCountSpan.innerText-0);
				if(foundSpan || timedOut) clearInterval(intervalId);
			},500)
		});
	}
	function getImageCountGroup(count){
		const a=[20,50,100,200,400,1000];
		for(var i=0;i<a.length;++i) if(count<a[i]) break;
		return i;
	}

	// contains Observable property .lastBatch that triggers event when it is set.
	class BatchProducerGroup {
		lastVisit;
		constructor(lastVisit,batchProviders){
			this.lastVisit = lastVisit || 0; // if new/undefined, use 0 so everything is treated as new
			new Observable(this).define('lastBatch', []);
			for(let source of batchProviders)
				source.listen('lastBatch',this.routeBatch);
		}
		routeBatch = ({lastBatch}) => {
			// all picGroups go through here...
			// Apply .isNew to all picGroups
			for(let picGroup of lastBatch)
				picGroup.isNew = this.isNew(picGroup);

			// forward
			this.lastBatch = lastBatch; // .lastBatch is observable and this triggers event
		}
		isNew(picGroup){ return this.lastVisit < picGroup.dateMs; }		
	}

	class UserPage {
		userRepo;
		snooper;
		ctx;
		reports;
		pageOwner;
		constructor(){
			const userRepo = this.userRepo = new SyncedPersistentDict('users');
			const snooper = this.snooper = buildRequestSnooper();
			const {pageOwner,isTracking,startingState} = this.captureStartingState();
			this.pageOwner = pageOwner;

			// Misc Tracking
			new UnfollowTracker(snooper,userRepo);
			new VisitingUserTracker(snooper,userRepo);
			new IdentifyUnhandledRequests(snooper); // always snoop this last - !!! make this event on snooper we can plug into so order doesn't matter
			new FollowingScrollerTracker(snooper).listen('foundLeaders',({newValue})=>this.savePeopleIAmFollowing(newValue));

			// Route Batch Producers to Batch Consumers
			const batchProducer = new BatchProducerGroup(startingState.lastVisit, [
				new GraphQLExtractor(snooper),
				new SavedPosts(snooper), // used: 2025-04-04,
				new UserPosts(snooper), // used: 2025-04-06
				new TaggedPopupWindow(snooper), // used: 2025-04-06
			]);
			new UserUpdateService({userRepo,batchProducer,pageOwner});
			const gallery = new Gallery(batchProducer);
			const sidePanel = new SidePanel({batchProducer,userRepo,pageOwner});
			const iiLookup = new ImageLookupByUrl(batchProducer);
			iiLookup.on('missingImage',	snooper.checkLogForMissingImage);

			const reports = this.reports = new UserReports({userRepo,iiLookup});
			this.ctx = unsafeWindow.cmd = {
				// global
				snoopLog:snooper._loadLog,
				userRepo,
				iiLookup,
				reports,
				page:this,

				next:() => this.oldestTrackedLink(reports).goto(),
				nextDownloaded: () => this.oldestDownloadedLink(reports).goto(),

				// owner/user based
				pageOwner,
				gallery,
				startingState,
			};

			window.addEventListener('load', ()=>this.onWindowLoad());

			if(isTracking)
				this.initTrackedUser({pageOwner,startingState});
			else
				this.initUntrackedUser({pageOwner});

			trackKeyPresses({iiLookup,pageOwner,sidePanel});

			this.logStartingState(startingState);
		}

		scheduleSetTabTitle(){
			Promise.all([getGoodTitleAsync(4000),getImageCountAsync()])
				.then( ([title,count]) => setInterval( () => document.title = getImageCountGroup(count) + ' ' + title, 10000 ) );
		}

		savePeopleIAmFollowing({followerId,leaders}){
			console.log(`Found ${leaders.length} Leaders`);
			if(followerId != '1039022773') return;
			// save/add Users to the repo
			for(const user of leaders)
				this.userRepo.update(user.username,u=>{
					u.username  = user.username;
					u.fullName  = user.full_name;
					u.isPrivate = user.is_private;
					u.id = user.id;
					u.isFollowing = true;
				})
		}

		onWindowLoad(){
			this.showNextLinks();
			this.scheduleSetTabTitle();
			this.addDownloadCountBadge();
			addCopyButton(this.pageOwner);
		}

		addDownloadCountBadge() {
			const user = this.userRepo.get(this.pageOwner) || {};
			const count = countUserDownloads(user);
			if (count <= 0) return;
			querySelectorAsync('h2').then(h2El => {
				const badge = el("div")
					.txt(`↓ ${count} last year`)
					.css({ margin: "3px", padding: "2px 6px", color: "white", background: "#446", borderRadius: "4px", fontSize: "12px", display: "inline-block" });
				const referenceEl = h2El.parentNode;
				referenceEl.parentNode.insertBefore(badge, referenceEl.nextSibling);
			});
		}

		showNextLinks() {
			const { reports } = this;
			const linkHost = el("div")
				.css({position: "fixed",top: 0,right: 0,background: "#ddf",padding: "5px",})
				.appendTo(document.body);
			this.oldestDownloadedLink(reports).appendTo(linkHost);
			this.oldestTrackedLink(reports).appendTo(linkHost);
		}

		// Capture Starting State before anything modifies it.
		captureStartingState(){
			const pageOwner = this.pageOwner = document.location.href.match(/instagram.com.([^\/]+)/)[1];
			const isTracking = this.userRepo.containsKey(pageOwner);
			const startingState = isTracking 
				? structuredClone(this.userRepo.get(pageOwner)) // because repo will modify original object
				: {}; // leave empty so we can detect not-visited
			return {pageOwner,isTracking,startingState};
		}

		logStartingState(startingState){
			console.print(JSON.stringify(startingState,null,'\t'))
			reportLast(startingState.lastVisit,'Visit');
		}

		initTrackedUser({pageOwner,startingState}){
			const {userRepo,ctx} = this;
			userRepo.update(pageOwner,u=>u.lastVisit=loadTimeMs);
			setPublicPrivateLabel(startingState.isPrivate);
			ctx.stop = function(){
				ctx.old = userRepo.get(pageOwner);
				userRepo.remove(pageOwner);
				console.log('Stopped tracking:',ctx.old);
			}
		}

		initUntrackedUser({pageOwner}){
			const {userRepo,ctx} = this;
			ctx.stop = function(){ console.log('Tracking was previously stopped.'); }
			// ctx.score = function(score){ userRepo.update(pageOwner,u=>{
			// 	u.username=pageOwner;
			// 	u.lastVisit=loadTimeMs;
			// 	if(score!=null)
			// 		u.score=score;
			// }); }
		}

		oldestDownloadedLink(reports){ return NextLink.forFirstUser("stale downloaded", reports.downloaded.stale()); }

		// used to find un-scored people, that aren't being periodically visited
		oldestTrackedLink(reports){ return NextLink.forFirstUser("stale followed", reports.followed.stale()); }

	}

	// Capture Starting State before anything modifies it.
	const loadTimeMs = storageTime.now();

	if(window.location.pathname.startsWith("/explore/locations"))
		new LocationPage();
	else if(window.location.pathname != "/")
		new UserPage();

	console.print('%cInstagram2.js loaded','background-color:#DFD'); // Last line of file

})();

// ==== Ideas ====
// 'S' saves a user account for review later
// Update Header Count when hiding/showing rows
// ===============


// !!! For accounts that are private, need to differentiate lastVisited from lastViewed

// Tracking...
// * Notes: Don't Follow, Followed and removed, 
// * When following or unfollowing someone, update Repo

// == Next ==
//	Mid - Find People we want to follow but request-pending
//	Mid - Find Scored that haven't visited in a while
//	Mid - Find Tracked (but not scored) that haven't visited in a while
//	Low - Tracking - Private (to see if still private)

//	For each situation - present alerts and buttons to deal with.
//		OLD & NOT hot [& NOT producting]
//			=> unfollow / stop
//			=> score or mark
//		Tracking but not scored and not followed 
//			=> Stop Tracking
//			=> Score

//	For Private: Yellow should be anything newer than lastVisit
//	!!! Track Requested - If requested and rejected, don't request again, don't click like

// !!! https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver

// IILookup usages:
//		Get Image Under Point
//		Decorate Thumbs
//		Report: when do users upload.

// == Split all Groups into these ===
//					
// Tracking / Not
// Following / Not
// public / private
// Has: Last Visit
// Add: Last viewed (if private)

/*

// == Add # to ICON

function getFavIcons(){
  return [...document.getElementsByTagName("link")]
    .filter(x=>['icon','shortcut icon'].includes(x.getAttribute('rel')))
}
function getFavIconUrl(){ 
  return getFavIcons().map(x=>x.getAttribute('href'))[0];
} 
function getImg(url){ 
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = () => res(img);
    img.src = url;
  });
}
async function bob(){
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  Object.assign(canvas.style, {position:'absolute',left:"120px",top:"120px"});
  const ctx = canvas.getContext('2d');

  const img = await getImg(getFavIconUrl());
  ctx.drawImage(img,0,0);

  ctx.font = '24px Arial';
  ctx.textAlign = 'center'; // Set text alignment
  ctx.textBaseline = 'middle'; // Set text baseline

  ctx.fillStyle = 'black'; // Set fill color
  ctx.fillText('10', 15, 15); // Filled text
  ctx.fillText('10', 17, 17); // Filled text
  ctx.fillText('10', 15, 17); // Filled text
  ctx.fillText('10', 17, 15); // Filled text
  ctx.fillStyle = 'white'; // Set fill color
  ctx.fillText('10', 16, 16); // Filled text

  //ctx.strokeStyle = 'blue'; // Set stroke color
  //ctx.strokeText('10', 16, 16); // Stroked text

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data; // Uint8ClampedArray containing pixel data [r, g, b, a, r, g, b, a, ...]
  console.log(data);
}
bob();

x78zum5 x1q0g3np xieb3on

function getFavIcons(){
  return [...document.getElementsByTagName("link")]
    .filter(x=>['icon','shortcut icon'].includes(x.getAttribute('rel')))
}
var bob = getFavIcons()[0];
if(bob !== undefined)
  bob.setAttribute('href','https://en.m.wikipedia.org/wiki/File:Solid_red.svg')

getFavIcons().forEach(x=>x.setAttribute('href','https://en.m.wikipedia.org/wiki/File:Solid_red.svg'))

https://en.m.wikipedia.org/wiki/File:Solid_yellow.svg
https://en.m.wikipedia.org/wiki/File:Solid_red.svg
https://en.m.wikipedia.org/wiki/File:Solid_green.svg
https://en.m.wikipedia.org/wiki/File:Solid_blue.svg
https://en.m.wikipedia.org/wiki/File:Solid_black.svg
*/
