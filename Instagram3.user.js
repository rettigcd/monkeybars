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
// @require      file://C:/[monkeyBarsFolder]/observable.js
// @require      file://C:/[monkeyBarsFolder]/Instagram3.user.js
// @match        https://www.instagram.com/*
// @exclude      https://www.instagram.com/p/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_download
// @grant        GM_openInTab
// @grant        unsafeWindow
// ==/UserScript==

// Requires (a) Developer Mode = Enabled & (b) Allow Local URLs

(function() {
	'use strict';

	// Swallow apps console.log(...)
	unsafeWindow.console = { 
		__proto__:unsafeWindow.console,
		log:function(){ this.logArgs.push(arguments); }, logArgs:[],
		// error:function(){ this.errorArgs.push(arguments); }, errorArgs:[],
	}

	unsafeWindow.WebSocket = makeNewWebSocket(unsafeWindow.WebSocket);


	const storageTime = EpochTime.JavascriptTime;

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

		return new RequestSnooper({fetchInterceptor})
			.logRequests(({url})=> [
					'https://www.instagram.com/logging/falco',
					'https://graph.instagram.com/logging_client_events'
				].includes(url.toString()) == false
			);
	}

	// return YYYYMMYYHHMMSS
	function formatDateForFilename(d=throwExp('date')){
		let parts = "FullYear,Month,Date,Hours,Minutes,Seconds".split(',').map(x=>d['get'+x]());
		parts[1]++; // month++
		function pad(x){ return (x<10?'0':'')+x;}
		return parts.map(pad).join('');
	}

	// Returns urls of images under the given coords
	function getSourcesUnder({clientX,clientY}){
		function getBackgroundImage(el){
			if(!(el instanceof Element)) return null;
			const styles = getComputedStyle(el);
			const b = styles.backgroundImage || styles['background-image'];
			return b=='none' ? null : (b && b.substring(5,b.length-2));
		}
		return document.elementsFromPoint(clientX, clientY)
			.map(el => el.src || getBackgroundImage(el))
			.filter(src=>src!=null);
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
		constructor(){
			this._dict={};
			new HasEvents(this);
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

		// Begin Monitoring
		monitorLastBatch( basePicExtractors ){
			for(let ex of basePicExtractors){
				ex.listen('lastBatch',({lastBatch}) => {
					lastBatch.forEach(picGroup=>{ 
						this.addGroup( picGroup );
					});
				})
			}
		}

		addGroup(group){
			try{
				group.pics.forEach( (single) => this.addSingle(single) );
			} catch (ex) {
				console.log('unable to save to images to lookup', this);
				throw ex;
			}
		}

		addSingle(singleImage){
			singleImage.imgUrls.forEach(url=> {
				this.modValue(url, x=> Object.assign(x,{singleImage}) );
			});
		}
		// End Monitoring

		getImageFor(imgUrl){

			if(this.hasKey(imgUrl)){
				const {singleImage} = this.getValue(imgUrl);
				if(singleImage)
					return {singleImage};
			}

			this.trigger('missingImage',imgUrl);

			// get the username
			const newMissingStandIn = prompt("Please enter username", this._missingStandIn);
			if(newMissingStandIn == null) return null;
			this._missingStandIn = newMissingStandIn

			// still let them download it
			const date = new Date();
			filename = this._missingStandIn +' '+formatDateForFilename(date)+'.jpg';
			const stub = new SingleImage([],[imgUrl],this._missingStandIn,date);
			return {singleImage:stub};
		}

		_missingStandIn = ""
	}

	// When iiLookup can't find an image, scans snooper log for the image and logs it.
	function reportMissingImages({iiLookup,snooper}){
		iiLookup.on('missingImage',	(imgUrl)=>{
			const matches = imgUrl.match(/.*?jpg/);
			if(matches === undefined){
				console.log('missing image:',imgUrl);
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
		});
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
		constructor({userRepo}){
			this.userRepo=userRepo || throwExp('UserService missing userRepo');
		}

		monitorLastBatch( basePicExtractors ){
			for(let ex of basePicExtractors){
				ex.listen('lastBatch',({lastBatch}) => {
					this.onScan_UpdateFollowingLikedLastUpload(lastBatch);
					this.onDownload_UpdateLastGood(lastBatch);
				})
			}
		}

		onScan_UpdateFollowingLikedLastUpload(batch){

			batch.forEach(({owner,following,liked,date})=>{
				if(following || this.userRepo.containsKey(owner)){
					const dateMs=storageTime.toNum(date);
					this.userRepo.update(owner,x=>{
						x.username = owner;
						if(following)
							x.isFollowing = following;
						if(liked && (x.lastGood||0)<dateMs)
							x.lastGood = dateMs;
						if((x.lastUpload||0)<dateMs)
							x.lastUpload = dateMs;
					})
				}

			});
		}

		onDownload_UpdateLastGood(batch){
			const updateLastGood = ({host:singleImage,downloaded}) => {
				const {owner,date} = singleImage;
				if(downloaded && owner && this.userRepo.containsKey(owner)){
					const date = storageTime.toNum(singleImage.date);
					this.userRepo.update(owner,u=>{
						if((u.lastGood||0)<date)
							u.lastGood = date;
					});
				}
			}
			for(let {pics} of batch)
				for(let pic of pics)
					pic.listen('downloaded', updateLastGood);
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

		constructor({owner,date,pics,following,lat,lng,liked}){
			Object.assign(this,{owner,date,pics,following,lat,lng,liked});
			this.sanitizedImgUrl = sanitizeImgUrl(pics[0].imgUrls[0]);
		}

		logFirst(){ this.pics[0].log(); }
		logAll(){ for(const pic of this.pics) pic.log(); }

		static fromMediaWithUser(aaa){
			const {user,taken_at,device_timestamp,carousel_media,usertags,image_versions2,lat,lng,has_liked} = aaa;
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
			return new PicGroup({owner,date,pics,following,liked:has_liked,lat,lng});
		}

	}

	// The different resolution urls and tagged users for 1 Image
	class SingleImage{

		static fromMedia({usertags,image_versions2,owner,date=throwExp("date")}){

			const taggedUsers = SingleImage.parseUserTags(usertags);

			// tallest 3 images
			const imgUrls = image_versions2.candidates
				.sort(byDesc(({height})=>height))
				.slice(0,3)
				.map(({url})=>url);

			// Make High res come last so if multiple urls sanitize to the same URL
			// The last (HIGH res) wins
			imgUrls.reverse();

			return new SingleImage( taggedUsers, imgUrls, owner, date );
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
		imgUrls; // string[] - urls - biggest first

		constructor(taggedUsers,imgUrls,owner,date){
			this.taggedUsers = taggedUsers;
			this.imgUrls = imgUrls; // low to high res

			// Needed for calculating filename, but can we remove otherwise?
			this.owner = owner;
			this.date = date;

			
			const ext = imgUrls[0].contains(".webp") ? ".webp" : ".jpg";
			this.filename = [owner,...taggedUsers].slice(0,10).join(' ')
				+' '+formatDateForFilename(date) + ext;
			new Observable(this).define('downloaded',false);
		}

		async downloadAsync(requestedUrl,onprogress){
			const matching = this.imgUrls.filter(x => x.includes(requestedUrl)).reverse();
			await downloadImageAsync({url:matching[0] || requestedUrl, filename:this.filename, onprogress });
			this.downloaded=true;
			console.print(`downloaded: ${this.filename}`);
		}

		// logs the smallest image of the lot
		log(){ unsafeWindow.console.image(this.imgUrls[this.imgUrls.length-1],50); }
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

				// if(batch.length){
					// const msg = `${this.constructor.name} extracted %c${batch.length}%c pic groups from json.`;
					// console.print(msg,'background:green;color:white;font-size:18px;','color:black;background:white;font-size:12px;');
				// }

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
		constructor(){super();}
		matches({pathname}){ return pathname=="/api/v1/feed/saved/posts/"; }
		findMediaArray(json){ return json.items.map(x=>x.media); }
	}

	// https://www.instagram.com/api/v1/feed/user/1560767330/?count=12&max_id=3091713838536813928_1560767330
	class UserPosts extends BasePicExtractor {
		constructor(){super();}
		matches({pathname}){ 
			return pathname.startsWith("/api/v1/feed/user/");
		}
		findMediaArray(json){ return json.items; }
	}

	// Called for a Tagged Popup-Window (may be redundant)
	class TaggedPopupWindow extends BasePicExtractor {
		constructor(){super();}
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

		constructor(){super();}

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
		constructor({startingState,locRepo}){
			super();
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
	 	constructor(){
	 		super();
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
		constructor(friendlyName){
			new Observable(this).define('lastBatch', []);
			this.friendlyName = friendlyName;
			this.handledLabel = `${this.constructor["name"]}(${friendlyName})`;
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
		lastGood; // photo date of downloaded or liked
		lastUpload; 
	} */

	// Load followers by scrolling through list
	class FollowingScrollerTracker{
		constructor(){
			new Observable(this).define("foundLeaders");
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
			const {label,nextUrl,count} = this;
			if(!nextUrl) return;
			const div = document.createElement('DIV');
			div.innerText = `${label}: ${count}`;
			Object.assign(div.style,{'text-decoration':'underline','cursor':'pointer','font-size':'12px'});
			div.addEventListener('click', () => document.location.href = nextUrl);
			host.appendChild(div);
		}
		static forFirstUser(label,users){
			return new NextLink({ label, count:users.length, nextUrl:users.length?'/'+users[0].username+'/':undefined });
		}
	}

	// Identifies UNHANDLED Snoop Requests
	// Should always be processed LAST
	class IdentifyUnhandledRequests {
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
		constructor(userRepo){ this._userRepo = userRepo; }
		snoop = (snoopRequest) => {
			const {url,body,responseText} = snoopRequest;
			if(url.pathname=='/graphql/query' && new URLSearchParams(body).get('fb_api_req_friendly_name')=='PolarisProfilePageContentDirectQuery'){
				snoopRequest.handled = this.constructor["name"];
				const {user} = snoopRequest.data;
				const following = isFollowing(user.friendship_status);
				if(following 			// add followed
					|| userRepo.containsKey(user.username)	// update if in repo
				){
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
		constructor(userRepo){this._userRepo=userRepo;}
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
		const el = document.querySelector('div._aatk');
		if(el==null) return;
		el.style.border="thick solid red";
		const r = el.getBoundingClientRect();
		const center = { clientX:(r.left+r.right)/2, clientY:(r.top+r.bottom)/2};
		// console.debug(`center:${JSON.stringify(center)} mouse:${JSON.stringify(mousePos)}`);
		return center;
	}

	function getImageUnderPoint(point,iiLookup){

		// sometimes the image we want to download is missing imageInfo
		// and this filter is preventing downloading it.
		const urls = getSourcesUnder(point);
		if(urls.length==0){ console.log('no img'); return; }
		const imgUrl = urls[0];

		const {singleImage} = iiLookup.getImageFor(imgUrl)

		if(singleImage != null) return { singleImage, imgUrl };

		// return null-object ImageInfo
		const stub = {
			owner:'-none-',
			taggedUsers: [],
			downloadAsync(){
				console.debug('No image found to download.');
				return Promise.reject();
			}
		};
		return { singleImage:stub, imgUrl };
	}

	async function simpleDownloadImageUnderPoint(point,pageOwner){

		try{
			// sometimes the image we want to download is missing imageInfo
			// and this filter is preventing downloading it.
			const urls = getSourcesUnder(point);
			if(urls.length==0){ console.log('no img'); return; }
			if(urls[0].startsWith('blob:')){
				console.log(`Has 'blog:' prefix. Not an image.` );
				return;
			}
			const imgUrl = urls[0];

			const filename = (pageOwner || 'instagram_img') + '.' + await getExtensionFromBlobType(imgUrl);
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
		const button = document.createElement('div');
		button.textContent='📋';// ⇕
		button.onclick = async function(){
			await navigator.clipboard.writeText(pageOwnerName);
		}
		Object.assign(button.style,{margin:'3px',padding:'2px',cursor:'pointer',color:'black'});
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
	function trackKeyPresses({iiLookup,pageOwner}){

		// Built In:
		// L => Like / Un-Like a post
		// S => Save / Un-Save a post

		unsafeWindow.addEventListener('keydown',function({which,repeat,ctrlKey,altKey,shiftKey}){
			if(repeat) return;

			function downloadImageInCenter(){
				const {singleImage,imgUrl} = getImageUnderPoint(getCenterOfPresentation()||mousePos,iiLookup);
				singleImage.downloadAsync(imgUrl);
			}

			function clickEl(css){ (document.querySelector(css) || {click:function(){console.log(`${css} not found.`)}}).click(); }
			function previousInSet(){ clickEl('button[aria-label="Go back"]'); }
			function nextInSet(){ clickEl('button[aria-label="Next"]') ; }

			function downloadImageUnderMouse(){ simpleDownloadImageUnderPoint(mousePos,pageOwner); }

			function openFocusUserProfilePage(){
				const focusUser = document.querySelector('div.x10wlt62.xlyipyv').innerHTML;
				if(focusUser){
					GM_openInTab(`https://instagram.com/${focusUser}`);
				} else
					console.log('No focusUser found.');
			}

			function showTaggedUsersUnderMouse(){
				const {singleImage:{owner:imgOwner,taggedUsers}} = getImageUnderPoint(getCenterOfPresentation()||mousePos,iiLookup);
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
			}, action = actions[key] || function(){console.debug('no action found')};
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
	function getRefreshTime(x){ // only works for scored 2..5
		if(x.score===undefined) return false;
		const {MONTHIS,WEEKS} = storageTime;
		const timeframe = ({
			'2':(x)=>3*MONTHS,
			'3':(x)=>6*WEEKS,
			'4':(x)=>3*WEEKS,
			'5':(x)=>2*WEEKS,
		})[x.score](x) || 6*MONTHS;
		return (x.lastVisit||0) + timeframe 
			+ Math.floor((strToFloat(x.username) - .5) * 4 * DAYS); // spread out over 4 days
	}
	function withinLast(timestamp,threshold){ return loadTimeMs <= (timestamp||0) + threshold; }
	const filters = {
		followed:{
			// FOLLOWED with unknown status.
			stale: (timeframe) => (x) => x.isFollowing && !withinLast(x.lastVisit,timeframe),
			// FOLLOWED that are public. - and maybe LOTS of followers.
			public: (x) => x.isFollowing && !x.isPrivate,
			// FOLLOWED that aren't producing. (limit this to lazy-public?)
			lazy: (x) => x.isFollowing && withinLast(x.lastVisit,2*storageTime.MONTHS) && !withinLast(x.lastGood,1*storageTime.YEARS),
		},
		tracked:{ // AKA - not following
			//	- ALL tracked
			all: (x) => !x.isFollowing,
			//	- TRACKED that have not been visited in a while
			stale: (timeframe) => (x) => !x.isFollowing && !x.isPrivate && !withinLast(x.lastVisit,timeframe),
			//	- PRIVATE that might be public now.
			private: (x) => !x.isFollowing && x.isPrivate,
		},
		//	- SCORED that have not been visited in a while (stale)
		scored:{
			all: (x) => x.score !== undefined,
			stale: (x) => x.score !== undefined && getRefreshTime(x) < loadTimeMs,
			// stale: (timeframe) => (x) => x.score!==undefined && !withinLast(x.lastVisit,timeframe),
		}
	}

	class UserReports{
		constructor({userRepo,iiLookup}){
			function showUsers(filter){ return userRepo.values().filter(filter); }
			this.followed={
				stale: (notVisitedDays=60)=>showUsers(filters.followed.stale(notVisitedDays*storageTime.DAYS)).sort(by(x=>x.lastVisit||0)),
				public: ()=>showUsers(filters.followed.public),
				lazy: ()=>showUsers(filters.followed.lazy).sort(by(x=>x.lastGood||0)),
			};
			this.tracked={
				stale: (notVisitedDays=60)=>showUsers(filters.tracked.stale(notVisitedDays*storageTime.DAYS)).sort(by(x=>x.lastVisit||0)),
				all: (notVisitedDays=60)=>showUsers(filters.tracked.all).sort(by(x=>x.username)),
				private: (notVisitedDays=60)=>showUsers(filters.tracked.private).sort(by(x=>x.username)),
			};
			this.scored={
				all: ()=>showUsers(filters.scored.all).sort(by(getRefreshTime)),
				stale: ()=>showUsers(filters.scored.stale).sort(by(getRefreshTime)),
				//stale: (notVisitedDays=7)=>showUsers(filters.scored.stale(notVisitedDays*storageTime.DAYS)).sort(by(x=>x.lastVisit||0)),
			}
			this.dayOfWeek=function(){
				const counts = [0,0,0,0,0,0,0];
				const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
				const imageDays = Object.values(iiLookup._dict)
					.filter(x=>x.image != null && x.image.date!=null)
					.map(x=>x.date.getDay());
				for(const day of imageDays) counts[day]++;
				return counts.map((count,idx)=> [dayNames[idx],count]);
			}
		}
	}

	class Gallery{

		// Model portion
		lookup; // dictionary: sanitirzedUrl => PicGroup
		constructor(lastVisit){
			this.lookup = {};
			this.lastVisit = lastVisit;
			this.strartWatchingThumbs();
		}
		monitorLastBatch( basePicExtractors ){
			for(let ex of basePicExtractors){
				ex.listen('lastBatch',({lastBatch}) => {
					for(let picGroup of lastBatch)
						this.lookup[picGroup.sanitizedImgUrl] = picGroup;
				})
			}
		}

		// View portion
		strartWatchingThumbs() { setInterval(()=>this.decorateThumbs(),1000); }

		decorateThumbs(){
			const thumbSelector = 'div._ac7v';
			const rows = document.querySelectorAll(thumbSelector); // for profile page
			if(rows.length==0) {
				// console.log(`no thumbs found matching selector:${'div._ac7v'}`);
				return;
			}

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
					const img = cell.querySelector('img');
					if(img == null )
						continue;

					const imgIndex = row.index*3+j;
					const sanitizedImgUrl = sanitizeImgUrl(img.src);

					let picGroup = this.lookup[sanitizedImgUrl];

					if(picGroup == null) continue;

					this.decorateThumb(img,picGroup);
					cell.decorated = true;
				}
			}
		}

		decorateThumb(img,picGroup){
			const {date,following,liked,pics} = picGroup;
			const imageMs = storageTime.toNum(date);
			const {ageText,ageColor} = msToAgeString(loadTimeMs-imageMs);

			// Store the thumbUrl we used to find the pic-group
			picGroup.thumbUrl = img.src;

			// Verify urls match
			const a = sanitizeImgUrl(img.src);
			const b = sanitizeImgUrl(picGroup.pics[0].imgUrls[0]);
			if( a != b )
				console.warn("Group urls do not match", a, b);

			// Setup host
			const host = img.parentNode;
			host.style.position='relative';

			// Add top-left text
			const isNew = this.lastVisit < imageMs; // if .lastVisit is undefined, don't override color
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
					const {width,height} = img, clipSize = width / numPerRow;

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
						newImg.setAttribute('src',si.imgUrls[0])
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

	function initLocationPage(){
		const userRepo = new SyncedPersistentDict('users');
		const snooper = buildRequestSnooper();
		const locRepo = new SyncedPersistentDict('locations');
		const iiLookup = new ImageLookupByUrl();

		// Capture Starting State before anything modifies it.
		const [,id,slug] = document.location.href.match(/instagram.com\/explore\/locations\/([^\/]+)\/([^\/]+)/);
		const location = `${slug} ${id}`;
		const isTracking = locRepo.containsKey(location);
		const startingState = isTracking 
			? structuredClone(locRepo.get(location)) // because repo will modify original object
			: {}; // leave empty so we can detect not-visited
		console.log(location,JSON.stringify(startingState,null,'\t'))
		reportLast(startingState.lastVisit,'Visit');

		const gallery = new Gallery(startingState.lastVisit);

		reportMissingImages({iiLookup,snooper});

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

		// snoop
		const batchSnoopers = [
			new Location1Posts({startingState,locRepo}),
			new Location2Posts(),
			new GraphQLEdgeFinder('PolarisLocationPageTabContentQuery_connection'), // used: 2025-04-06
			new GraphQLEdgeFinder('PolarisLocationPageTabContentQuery'),			// used: 2025-04-06
		];
		for(let extractor of batchSnoopers){
			if(typeof(extractor.snoop) != "function")
				throw extractor;
			snooper.addHandler( extractor.snoop );
		}

		const batchProducers = [ ...batchSnoopers, new InitialLocationPageParser() ];
		const batchConsumers = [ iiLookup, gallery, new UserUpdateService({userRepo}) ];
		for(let consumer of batchConsumers)
			consumer.monitorLastBatch(batchProducers);
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

		trackKeyPresses({iiLookup});
	}

	class UserPage {
		constructor(){
			this.userRepo = new SyncedPersistentDict('users');
			this.followingTracker = new FollowingScrollerTracker();
			this.snooper = buildRequestSnooper();
			this.iiLookup = new ImageLookupByUrl();
		}

		init(){
			const {userRepo,snooper,iiLookup} = this;
			const {pageOwner,isTracking,startingState} = this.captureStartingState();

			const reports = new UserReports({userRepo,iiLookup});
			const gallery = new Gallery(startingState.lastVisit);

			window.onload = ()=>{
				// UI - Next links
				const linkHost = document.createElement('DIV'); 
				Object.assign(linkHost.style,{position:"fixed",top:0,right:0,background:"#ddf",padding:"5px"});
				document.body.appendChild(linkHost)
				this.oldestScoredLink(reports).appendTo(linkHost);
				this.oldestTrackedLink(reports).appendTo(linkHost);
				addCopyButton(pageOwner);

				// # post in title
				const id = setInterval(function(){
					const span = document.querySelectorAll('span.html-span')[1];
					if(span===undefined) return;
					const c = span.innerText-0;
					const a=[20,50,100,200,400,1000];for(var i=0;i<a.length;++i) if(c<a[i]) break;
					document.title = i + ' ' + document.title;
					clearInterval(id);
				},1000)
			}

			reportMissingImages({iiLookup,snooper});

			const batchSnoopers = [
				new GraphQLExtractor(),
				new SavedPosts(),			// used: 2025-04-04
				new UserPosts(),  			// used: 2025-04-06
				new TaggedPopupWindow(),	// used: 2025-04-06
			];
			const snoopers = [
				...batchSnoopers,
				this.followingTracker,
				new UnfollowTracker(userRepo),
				new VisitingUserTracker(userRepo),
				new IdentifyUnhandledRequests() // always snoop this last
			];
			for( let extractor of snoopers )
				snooper.addHandler( extractor.snoop );

			const batchConsumers = [ iiLookup, gallery, new UserUpdateService({userRepo}) ];
			for( let consumer of batchConsumers)
				consumer.monitorLastBatch(batchSnoopers);

			this.followingTracker.listen('foundLeaders',({newValue})=>this.savePeopleIAmFollowing(newValue));

			this.ctx = unsafeWindow.cmd = {
				// global
				snoopLog:snooper._loadLog,
				userRepo,
				iiLookup,
				reports,
				page:this,

				next:() => this.oldestTrackedLink(reports).goto(),
				nextScored: () => this.oldestScoredLink(reports).goto(),
				mark: () => userRepo.update(pageOwner,x=>x.special=true),

				// owner/user based
				pageOwner,
				gallery,
				startingState,
			};

			if(isTracking)
				this.initTrackedUser({pageOwner,startingState});
			else
				this.initUntrackedUser({pageOwner});

			trackKeyPresses({iiLookup,pageOwner});

			this.logStartingState(startingState);
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

		// Capture Starting State before anything modifies it.
		captureStartingState(){
			const {userRepo} = this;
			const pageOwner = document.location.href.match(/instagram.com.([^\/]+)/)[1];
			const isTracking = userRepo.containsKey(pageOwner);
			const startingState = isTracking 
				? structuredClone(userRepo.get(pageOwner)) // because repo will modify original object
				: {}; // leave empty so we can detect not-visited
			return {pageOwner,isTracking,startingState};
		}

		logStartingState(startingState){
			console.print(JSON.stringify(startingState,null,'\t'))
			reportLast(startingState.lastVisit,'Visit');
			reportLast(startingState.lastUpload,'Upload');
			reportLast(startingState.lastGood,'Good');
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
			ctx.score = (score) => userRepo.update(pageOwner,x=>x.score=score);
		}

		initUntrackedUser({pageOwner}){
			const {userRepo,ctx} = this;
			ctx.stop = function(){ console.log('Tracking was previously stopped.'); }
			ctx.score = function(score){ userRepo.update(pageOwner,u=>{
				u.username=pageOwner;
				u.lastVisit=loadTimeMs;
				if(score!=null)
					u.score=score;
			}); }
		}

		// Link to periodically visit pages that have been scored
		oldestScoredLink(reports){ return NextLink.forFirstUser("stale scored", reports.scored.stale()); }

		// used to find un-scored people, that aren't being periodically visited
		oldestTrackedLink(reports){ return NextLink.forFirstUser("stale unscored", reports.followed.stale()); }

	}

	// Capture Starting State before anything modifies it.
	const loadTimeMs = storageTime.now();

	if(window.location.pathname.startsWith("/explore/locations"))
		initLocationPage();
	else if(window.location.pathname != "/")
		new UserPage().init();

	console.print('%cInstagram2.js loaded','background-color:#DFD'); // Last line of file

})();

// !!! For accounts that are private, need to differentiate lastVisited from lastViewed

// Tracking...
// * Notes: Don't Follow, Followed and removed, 
// * When following or unfollowing someone, update Repo

// == Next ==
//	Top - Find users missing .lastUpload or .lastVisit
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

//	For Private: Yellow should be anything newer than ***lastUpload*** and lastVisit
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
