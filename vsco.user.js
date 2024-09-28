// ==UserScript==
// @name         VSCO Gallery
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Efficient VSCO Gallery surfer
// @author       Dean Rettig
// @match        http*://vsco.co/*/gallery
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      file://C:/Users/rettigcd/src/monkeybars/observable.js
// @require      file://C:/Users/rettigcd/src/monkeybars/storage.js
// @require      file://C:/Users/rettigcd/src/monkeybars/vsco.user.js
// @icon         https://www.google.com/s2/favicons?sz=64&domain=vsco.co
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

(function() {
	'use strict';

	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	function throwExp(msg){ console.trace(); throw msg; } 

	function replaceArrayValues(target,source){
		target.length=0;
		target.push.apply(target,source);
	}
	function rnd(i){ return Math.floor(Math.random() * i); }

	const light = {
		winter:'#ddf', spring:'#9ab895', summer:'#d48e8e', fall:'#b3a174', old:'white',
		attribute:'black', galleryRowBg:'white'
	};
	const dark = {
		winter:'#668', spring:'#373', summer:'#844', fall:'#663', old:'#444',
		attribute:'white', galleryRowBg:'#333'
	};
	const colors = dark;

	const msgCss           = 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;';
	const importantCss     = 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;';
	const downloadCountCss = 'color:red; font-weight:bold; font-size:1.5rem;';

	const winter='#ddf',fall='#b3a174',spring='#9ab895',summer='#d48e8e'; 
	const monthColors = [colors.winter,colors.winter,colors.spring,colors.spring,colors.spring,colors.summer,colors.summer,colors.summer,colors.fall,colors.fall,colors.fall,colors.winter];
	const monthNames = "Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec".split(',');

	// ===== LINQ =====
	function makeCompareFunction(){
		const subCompareFuncs = [];
		const f = function(a,b){
			for(const comp of subCompareFuncs){
				var result = comp(a,b);
				if(result != 0) break;
			}
			return result;
		};
		function appendSubCompareFunc(proj,rtn){
			subCompareFuncs.push( function(a,b){ a=proj(a); b=proj(b); return a<b?(-rtn):(a==b?0:rtn); } );
			return f; // so we can chain them
		};
		f.thenBy = function(proj) { return appendSubCompareFunc(proj,1); }
		f.thenByDesc = function(proj) { return appendSubCompareFunc(proj,-1); }
		return f;
	}

	function by(proj){ return makeCompareFunction().thenBy(proj); }
	function byDesc(proj){ return makeCompareFunction().thenByDesc(proj); }

	// ========== Groups/sets/arrays ==========
	function onlyUnique(value, index, self) { return self.indexOf(value) === index; } // use with [..].fiter(onlyUnique);

	function groupBy(items,keyFinder){
		let groups = {};
		items.forEach(item=>{
			let key=keyFinder(item);
			if(!(key in groups)) groups[key] = [];
			groups[key].push(item);
		});
		return groups;
	}

	// ===== Promises =====

	function executePromisesInParallel(actions,parallelCount=8){
		const deferred = $.Deferred();
		const status = {loaded:0,total:actions.length};
		actions=actions.slice();
		async function process(){
			while(actions.length>0){
				try{ await (actions.shift())(); } catch (error) { console.log(error); }
				++status.loaded;
				deferred.notify(status);
			}
			if(status.loaded == status.total) deferred.resolve();
		}
		while(parallelCount--) process();
		return deferred;
	}

	// ===== ::ui  =====
	class Layout{
		constructor(){
			const css = {
				top			: {position:"fixed",top:"0px",left:'0px',width:'100%',height:"40px",'z-index':'3000',background:'rgba(255,255,255,0.9)',overflow:"auto"},
				leftPanel	: {margin:0,padding:0,display:'inline-block'},
				star		: {display:'inline-block'},
				userLink	: {display:'inline-block'},
				calendar	: {position:'fixed',right:'2px',top:'0',background:"white",border:"thin solid gray"},
				next		: {position:'absolute',right:'400px',top:'0'},
				counts		: {display:'inline-block'},
				progress	: {display:'inline-block', width:"150px", height:"15px","font-size":"12px", padding:'2px',color:'#060'},
			};

			this.$top = $('<div>').prependTo('body').css(css.top);
			this.$leftPanel = $('<div>').appendTo(this.$top).css(css.leftPanel);
				this.$userStatusDiv = $('<div>').appendTo(this.$leftPanel).css(css.star);
				this.$userDownloadCountsDiv = $('<div>').appendTo(this.$leftPanel).css(css.counts);
				this.$scanNewImagesDiv = $('<div>').appendTo(this.$leftPanel).css(css.userLink);
				this.$visibleRowProgress = $('<div>').appendTo(this.$leftPanel).css(css.progress);

			this.$calendar = $('<div>').appendTo(this.$top).css(css.calendar);
			this.$scanNext = $('<div>').appendTo(this.$top).css(css.next);
			this.$thumbDiv = $('<div>').insertAfter(this.$top);
			let $spacer = $('<div>').prependTo('body').css("height",css.top.height);
			setInterval(()=>$spacer.css('height',this.$top.height()),2000); // !!! ? does top height change?

			this.$import = $('<input>').appendTo('body').attr('type','file').attr('multiple',true);
		}
	}

	// ===== ::Gallery    (UI component, container div that holds image rows)
	class Gallery {
		rows; // ImageRowView[]
		constructor( $thumbDiv, $progressDiv ){
			new HasEvents(this);
			this.$thumbDiv = $thumbDiv;
			this.$progressDiv = $progressDiv;
		}
		loadRows(rowData){

			this.$thumbDiv.empty();
			window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
			this.rows = rowData.map(x=>{ 
				return new ImageRowView(x,this.$thumbDiv);
			});

			this.visibleRowCount = 0;
			this.totalRowCount = this.rows.length;
			this._adjustCounts(0,0); // trigger change event
			this.rows.forEach(row=>{
				row.on('loaded',()=>this._adjustCounts(1,0) );
				row.on('closed',()=>this._adjustCounts(-1,-1) );
			});

			this._showCloseButton();
			return this.loadRowsSequentially();
		}
		closeFirst(){
			// interact with model instead of view
			const visibleModels = (this.rows||[]).map(x=>x.model)
				.filter(m=>m && m.isVisible);
			if(visibleModels.length) visibleModels[0].isVisible=false;
		}
		openLast(){
			// interact with model instead of view
			const visibleModels = (this.rows||[]).map(x=>x.model)
				.filter(m=>m && !m.isVisible)
				.reverse();
			if(visibleModels.length) visibleModels[0].isVisible=true;
		}
		_adjustCounts(deltaVisible,deltaTotalRowCount){
			this.visibleRowCount += deltaVisible;
			this.totalRowCount += deltaTotalRowCount;
			if(this.totalRowCount == 0)
				this._$closeButton.remove();
			this.$progressDiv.text(`${this.visibleRowCount} of ${this.totalRowCount} rows`);
		}

		// Load the images, 1 row at a time, from top to bottom so we can work with top row while bottom rows are loading.
		loadRowsSequentially(){
			// !!! seems like this could be rewritten generically as RunPromises in sequence.
			let rows = this.rows.slice();
			let $deferred = $.Deferred();
			let progress = { loaded:0, total:rows.length };

			function showNextRow(){
				if(rows.length){
					const loadComplete = rows.shift().load();
					loadComplete.then(function(){ progress.loaded++; $deferred.notify(progress); })
					loadComplete.then(showNextRow);
				} else
					$deferred.resolve(); // .reject()
			}
			showNextRow();
			return $deferred.promise();
		}
		_showCloseButton(){
			const buttonCss = {'border':'3px outset black','padding':'3px','margin':'2px','background':'gray'}
			this._$closeButton = $('<button>').appendTo(this.$thumbDiv).text('close all').css(buttonCss)
				.on('click',()=>this._closeAllRows());
		}
		_closeAllRows() {
			window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
			this.rows.forEach( x=>x.model.isVisible = false );
			this.rows = [];
		}
	}

	class ImageRowModel{
		labelText;
		images;
		actions; // optional
		constructor({labelText,images,actions={}}){
			Object.assign(this,{labelText,images,actions});
			new Observable(this).define('isVisible',true);
		}
	}

	// ::ImageRow     (synchronously appends to $container)
	class ImageRowView {

		constructor(imageRowModel,$container){
			new HasEvents(this);
			this.model = imageRowModel;

			const rowCss = { "display":"flex","flex-direction":"row","justify-content":"flex-start", background:colors.galleryRowBg};
			this.$rowDiv = $('<div>').css(rowCss).appendTo($container);
			const $closeTab = $('<div>').css({'width':'30px','border-top':'thin solid #808'}).appendTo(this.$rowDiv);
			const $subContainer = $('<div>').appendTo(this.$rowDiv).css({'width':'100%'});
			const label = new ImageRowLabelView( $subContainer, this.model.labelText );
			this.$imgContainer = $('<div>').appendTo($subContainer);

			this.model.listen('isVisible',({isVisible})=>{
				if(isVisible)
					this.$rowDiv.show()
				else{
					this.$rowDiv.hide()
					this.trigger('closed');
				}
			})

			// Events
			this.on('loaded',()=>{
				label.enable();
				$closeTab
					.css({"cursor":"pointer","background":"#CCF"})
					.on('click',()=> this.close())
			});

			// add buttons
			for(let text in imageRowModel.actions)
				label.addButton(text,imageRowModel.actions[text]);
		}
		close(){
			this.model.isVisible = false;
		}
		load(){
			// construct all of the image-thumb containers now
			const thumbs = this.model.images.map(imgModel =>
				new ImageThumbControl( imgModel, this.$imgContainer )
			);

			// load them later
			return executePromisesInParallel( thumbs.map( t=>(()=>t.load()) ), 10 )
				.then( ()=>{ this.trigger('loaded'); } );
		}
	}

	class ImageRowLabelView {
		constructor($container,text){
			new HasEvents(this);
			const labelCss = {
				"font-size":"20px",
				"font-family":
				"sans-serif",
				"background":"#ACC",
				"text-align":"left",
				"width":"100%",
				"padding":"2px 10px"};
			this.$labelDiv = $('<div>').text( text ).css(labelCss).addClass('imageRowLabel').appendTo($container);
			this._buttons=[];
		}
		enable(){
			this._buttons.forEach(btn=>this._enableButton(btn));
		}
		_enableButton(btn){
			const buttonCss = {'cursor':'pointer','border':'outset','margin':'10px','display':'inline-block','font-size':'10px'};
			$('<span>').text(btn.text).appendTo(this.$labelDiv).css(buttonCss)
				.on('click',(e)=>{e.stopPropagation();this.trigger(btn.eventName);} );
		}
		addButton(text,onClickHandler){
			let eventName=text+'_clicked';
			this._buttons.push({text,eventName}); // trigger the event
			this.on(eventName,onClickHandler); // handle it
		}
	}

	class DownloadCountsControl{
		constructor($div){
			this.$div = $div;
			this.$div.css({padding:"2px",border:"thin solid green"});
		}
		bind(user){
			this.update(user.data);
			user.on( 'imageDownloaded',()=>this.update(user.data) );
		}
		update(data){
			this.$div.html( "&#x2193 "+data.downloadsInLastYear );
			const byYear = Object.entries(data.byYear).sort(byDesc(x=>x[0])).map(x=>x[0]+':'+x[1]);
			if( byYear.length > 0)
				this.$div.attr('title',byYear.join(' '));
		}
	}

	// ===== ::Progress (displays % and text) =====
	class ProgressBar{ // ui element
		constructor($container,initialColor='#aaf',finalColor='#ccf'){
			$container.css('position','relative');
			this.initialColor = initialColor; this.finalColor=finalColor;
			this.$progress = $('<div>').appendTo($container).hide()
				.css({position:'absolute',top:'0',left:'-'+$container.css('left-margin'),height:"16px",width:'100%',margin:$container.css('margin')})
				.css({'text-align':'right','vertical-align':'middle',padding:'1px 4px','font-family':'Verdana','font-size':'10px','white-space':'nowrap'});
		}
		set text(value){ this.$progress.text( value ); }
		set percent(pct){ // 0..100
			let fc=this.finalColor,ic=this.initialColor;
			this.$progress.css({'background-image':`repeating-linear-gradient(to right, ${fc}, ${fc} ${pct}%, ${ic} ${pct}%, ${ic})`,'display':'block'});
		}
		close(){ this.$progress.remove(); }
	}

	// displays generic progress-object on a ProgressBar using custom text and % complete bar
	class ProgressMonitor{
		constructor(bar,textFormatter){
			this._bar = bar;
			this._textFormatter = textFormatter;
		}
		monitor($deferred){ // binds to a deferred object.
			this._bar.percent = 0;
			this._bar.text = '...';
			$deferred.then(
				()=>this._bar.close(), // complete
				()=>this._bar.close(), // fail
				progress=>this._progress(progress)
			);
		}
		monitor2(imageModel){
			this._bar.percent = 0;
			this._bar.text = '...';
			imageModel.listen('downloadProgress', ({downloadProgress})=>{
				switch(downloadProgress.status){
					case 'timeout':
					case 'errored':
						console.log( `download: ${status}`);  // fall thru
					case 'complete':
						this._bar.close();
						break;
					case 'downloading':
						const {downloaded,total} = downloadProgress;
						this._progress({downloaded,total}); 
						break;
					default: console.log('well this is akward...'); break;
				}
			});
		}
		_progress(progress){
			this._bar.percent = ProgressMonitor.progressToPercent(progress);
			this._bar.text = this._textFormatter(progress);
		}
		static progressToPercent({loaded,total}) { 
			return Math.floor((loaded/total*100)+0.5);
		}
	}

	// displays file-download progress on a ProgressBar
	class FileDownloadMonitor extends ProgressMonitor{
		constructor(bar){ super(bar,progress=>Math.floor(progress.loaded/1000+0.5)+' of '+Math.floor(progress.total/1000+0.5)+'KB'); }
	}

	// displays x of y on a bar element
	class StepMonitor extends ProgressMonitor{
		constructor(bar){ super(bar,progress=>progress.loaded+' of '+progress.total); }
	}

	function isDueToScanNewImages(data){ // predicate - not a fundamental part of UserData nor Counts
		if( data.status!=UserStatus.following && data.status!=UserStatus.failed) return false;
		const effectiveDownloadsInLastYear = data.downloadsInLastYear || 1;
		const daysBetweenScans = Math.max( 0.75, 365/effectiveDownloadsInLastYear*0.35); // 35% of wait duration
		const nextScanDate = Math.floor( daysBetweenScans*24*60*60*1000 ) + data._info.viewDate;
		return nextScanDate < new Date().valueOf();
	}

	// ===== ::ScanNewImagesMenu =====
	class ScanNewImagesMenu{
		constructor($div){ this.$div = $div; }

		setUsersByStar( userAccess ){
			this._userAccess = userAccess;

			this.$div.empty();
			const css={
				normal:{border:'thin dashed white',cursor:"pointer"},
				hover:{border:'thin dashed gray'},
			}

			this._$ready = $('<span>').appendTo(this.$div).css(css.normal)
				.hover(
					function(){$(this).css(css.hover);},
					function(){$(this).css(css.normal);}
				)
				.on('click',()=>this.scanReady());
			$('<span> / </span>').appendTo(this.$div);
			this._$newImages = $('<span>').appendTo(this.$div).css(css.normal)
				.hover(
					function(){$(this).css(css.hover);},
					function(){$(this).css(css.normal);}
				)
				.on('click',()=>this._showNewImages());

			this._refreshReadyCount();
			this._refreshNewImageCount();
		}

		_refreshReadyCount(){
			this._readyToScanUsers = this._userAccess.allUsers
				.filter( user=>user.isDueToScanNewImages );
			this._$ready.text('due:'+this._readyToScanUsers.length);
		}

		_refreshNewImageCount(){
			const dayWaitMap = [,,7,2,1,0];
			const now = new Date().valueOf();

			function waitToDisplayNewImages(data){ // predicate, not inherant property of UserData
				return 0; // don't wait for anyone
				// const dily = data.downloadsInLastYear;
				// const days = dily > 30 ? 0 : dily > 20 ? 1 : dily > 5 ? 2 : 7;
				// return days*1000*60*60*24;
			}
			function displayNewImages(user){
				const imgs = user.newImages;
				return imgs.length>=4
					|| Math.min(...imgs.map(x=>x.uploadDate)) + waitToDisplayNewImages( user.data ) < now;
			}
			this._newImageUsers = this._userAccess.newImageUsers
				.filter( displayNewImages );
			this._displayNewImageCount();
		}
		_displayNewImageCount(){
			this._$newImages.text('images:'+this._newImageUsers.length);
		}
		scanReady(){
			const toScan = this._readyToScanUsers
				.sort(by(user=>user.data.viewDate))
				.slice(0,100); // only scan 200 oldest
			const unexecutedPromiseGenerators = toScan
				.map( user => ( ()=>user.scanForNewImagesAsync() ) );
			const $all = executePromisesInParallel( unexecutedPromiseGenerators );
			new StepMonitor(new ProgressBar(this._$ready)).monitor($all);

			const refreshThis = () => {
				this._refreshReadyCount();
				this._refreshNewImageCount();
			}
			$all.then(refreshThis,refreshThis);
		}

		_clearNewImages(username){
			this._userAccess.get(username).clearNewImages();
			this._newImageUsers = this._newImageUsers.filter(user=>user.username != username);
			this._displayNewImageCount();
		}

		_showNewImages(){
			const pageSize=25;
			const users = this._newImageUsers;
			const tmp = users.length%pageSize, take = tmp<5?tmp+pageSize:tmp;

			const self = this;

			const rowData = users
				.sort(byDesc(user=>user.data.downloadsInLastYear).thenBy(user=>user.username))
				.slice(0,take)
				.map( user => { 
					const irm = new ImageRowModel({
						labelText : user.username + ' ' + user.data.downloadsInLastYear,
						images : user.newImages,
						actions : { 
							open: function(){window.open(user.fetch.galleryUrl, '_blank');},
						}
					});
					irm.listen('isVisible',({isVisible})=>{
						if(!isVisible){
							self._clearNewImages(user.username);
							console.print(`closing row [${user.username}]`);
						}
					})
					return irm;
				});
			thumbs.loadRows(rowData);
		}

	}

	let formatDate = {
		YMD : function (date)  { return formatDate.parts(date).slice(0,3).join('-'); },
		YM : function (date)  { return formatDate.parts(date).slice(0,2).join('-'); },
		YMDHM : function (date){ let p=formatDate.parts(date); return p[0]+'/'+p[1]+'/'+p[2]+' '+p[3]+':'+p[4]; },
		forFilename : function(date){ return formatDate.parts(date).join(''); },
		parts : function (date) {
			let pad = i=> (i<10?'0':'')+i;
			return [date.getFullYear(),pad(date.getMonth()+1),pad(date.getDate()),pad(date.getHours()),pad(date.getMinutes()),pad(date.getSeconds())];
		}
	};

	/// ::StarRow
	class UserStatusControl{
		constructor($div){
			this.$select = $('<select>').appendTo($div)
				.on('click', ()=> this.user.status = this.$select.val() );
			Object.entries(UserStatus)
				.filter(([text,value])=>value!=UserStatus.failed)
				.forEach(([text,value])=>this.$select.append(`<option value="${value}">${text}</option>`));
		}
		bindToUser(user){
			this.user = user; // here, user is interactor

console.log('status', this.user.status );

			this.$select.val( this.user.status );
		}
	}

	function findStringBetween(src,prefix,suffix){
		let startIndex = src.indexOf(prefix)+prefix.length;
		if(startIndex==-1) return null;
		let endIndex = src.indexOf(suffix,startIndex);
		if(endIndex==-1) return null;
		return src.substring(startIndex,endIndex);
	}

	// ==========================
	// ==========================
	// ==========================

	// https://vsco.co/marygaigals/gallery

	class ImageThumbControl{ // single image
		constructor(imgProps,$container){

			const boxSize = 250;
			this.model = imgProps;

			const imgDate = this.model.imgDate;

			const bgColor = (() => {
				if(this.model.videoUrl) return 'purple';
				if(new Date().valueOf()-imgDate.valueOf() > 1000 * 60 * 60 * 24 * 365) return colors.old;
				return monthColors[imgDate.getMonth()];
			})();
			const containerCss = { width:boxSize+'px',	display:'inline-block','text-align':'center',margin:'5px',position:'relative',background:bgColor };
			const markCss = {'cursor':'pointer','color':'white', 'padding-left':'5px'};
			const imageSizeCss = {'font-size':'10px','font-weight':'bold','margin-right':'5px',color:colors.attribute};
			const dateCss = {color:colors.attribute}
			this._imgProps = imgProps;

			// wrapper
			this._$wrapper = $('<div>').appendTo($container).css(containerCss);

			// metadata caption
			function makeDateString(ticks){ return (ticks===null) ? 'N/A' : formatDate.YMD( new Date(ticks) ); }
			this._$wrapper.append(
				$('<br>'),
				$('<span>').html(imgProps.width+' x '+imgProps.height).css(imageSizeCss),
				$('<span>').html(makeDateString(imgProps.uploadDate)).css(dateCss).attr('title','Taken: '+makeDateString(imgProps.captureDate)), // date
			);

			const $link = $('<a>')
				.attr('href',this.model.url)
				.on('click',(event)=>this.onClick(event))
				.prependTo(this._$wrapper);

			this.$img = $('<img>')
				.css((imgProps.height > imgProps.width) ? {'height':boxSize+'px'} : {'width':boxSize+"px"})
				.data('src',imgProps.getResponsiveLink(boxSize))
				.appendTo( $link );

			if(this.model.downloadProgress.status=='complete')
				this._showCheckmark();

		}
		load(){ // load image
			const $imgLoaded = $.Deferred();
			const retrySuffix = this.failures ? ('f='+this.failures) : '';
			this.$img.on('load',() => { delete this.failures; $imgLoaded.resolve(); })
				.on('error',(err)=>{ this.failures = (this.failures || 0)+1; $imgLoaded.reject(); })
				.attr('src',this.$img.data('src') + retrySuffix )
			return $imgLoaded.promise();
		}
		onClick(event){
			event.preventDefault();
			this.download();
		}
		async download(){
			const monitor = new FileDownloadMonitor( new ProgressBar(this._$wrapper) );
			monitor.monitor2(this.model);

			try{
				await this.model.downloadAsync();
			} catch(x){
				console.log('error downloading '+ this.model.localFileName + ': ' + JSON.stringify(x));
				return;
			}

			/* GLOBAL */ 
			userAccess.get(this.model.owner).logDownloadImage(this.model);
			this._showCheckmark();
			CMD.downloads.push(this.model);
			console.print('Image saved.');
		}
		_showCheckmark(){
			$('<span>').html('&check;')
				.css({position:'absolute',top:'0',right:'10px',display:'inline-block','background-color':'white',border:'thin solid black',padding:'3px'})
				.appendTo(this._$wrapper.css({position:'relative'}));
		}
	}

	//-------------------------------------
	// ::UserAccess
	class UserAccess {
		constructor(){
			this.repo = new SyncedPersistentDict('users');
			this.newImageRepo = new SyncedPersistentDict('newImages');
			this.linkRepo = new SyncedPersistentDict('graph',()=>[]);
			this.commonRepo = new CachedPersistentArray('common');
			this._cache = {}; // so we return same user object -> so we can add events to it.
		}

		// helper
		findLinksTo(needle){ return this.linkRepo.entries()
			.filter(([username,links])=>links.indexOf(needle)!=-1)
			.map(([username,links])=>username);
		}

		get newImageUsers(){ return this.newImageRepo.keys().map(username=>this.get(username)); }
		get allUsers(){ return this.repo.keys().map(username => this.get(username)); }
		// main user
		get(username){ return this._cache.hasOwnProperty(username) ? this._cache[username] : (this._cache[username]=new UserCtx(username,this)); }
		get currentUsername(){ return unsafeWindow.location.href.match(/(?<=vsco.co\/).*(?=\/gallery)/)[0]; }

		// Higher level
		needsReview(){
			const currentUsername = this.currentUsername;
			const users = this.allUsers
				.filter(user=>user.username!=currentUsername && user.data.status==UserStatus.shouldReview);
			return new NextLink({
				label:'for review',
				count: users.length,
				nextUrl: users.length ? users[rnd(users.length)].fetch.galleryUrl : undefined
			})
		}
		missingViewDate(sortLongestOutageFirst=false){
			// this.repo.sync(); // save viewDate before we scan
			const currentUsername = this.currentUsername;
			const users = Object.entries(JSON.parse(localStorage.users))
				.filter(([u,v])=>2<=v.stars&&v.stars<=5 // 1 is 'ignored'
						&& v.viewDate==undefined
						&& u != currentUsername // this may be called before current .viewDate is set.
					)
				.map(x=>new LastYear(x))
				.sort(sortLongestOutageFirst
					? by(x=>x.lastYear).thenBy(x=>x.lastCount)
					: byDesc(x=>x.lastYear).thenByDesc(x=>x.lastCount)
				);
			return new NextLink({
				label: 'missing view-date',
				count: users.length,
				nextUrl: users.length ? `/${users[0].username}/gallery` : undefined,
			});
		}
		toPrune(yearsWithoutDownload=4){
			const currentUsername = this.currentUsername;
			// userAccess.repo.sync(); // save viewDate before we scan
			const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;
			const toPrune = Object.entries(JSON.parse(localStorage.users))
				.filter(([u,v])=>2<=v.stars&&v.stars<=5 // 1 is 'ignored'
					&& v.viewDate !== undefined // was viewed
					&& u != currentUsername // this may be called before current .viewDate is set.
				)
				.map(x=>new LastYear(x))
				.filter( ({lastYear}) => lastYear<earliestEmptyYear )
				.sort(by(x=>x.lastYear).thenBy(x=>x.lastCount).thenBy(x=>x.username));
			return new NextLink({
				label:'prune',
				count:toPrune.length,
				nextUrl:toPrune.length ? `/${toPrune[0].username}/gallery` : undefined
			});
		}
	}

	class UserCtx {
		constructor(username,userAccess){
			this.username = username;
			this._access = userAccess;
			new HasEvents(this);
		}

		get links(){ return new UserLinks(this.username,this._access,this.fetch); }
		get data(){ return new UserData(this.username,this._access.repo.get(this.username)); }

		get newImages(){ // uses responsiveUrl as key to prevent duplicates, only need values
			return Object.values( this._access.newImageRepo.get(this.username) )
				.map(i=>new ImageModel(i));
		} 
		clearNewImages(){ this._access.newImageRepo.remove(this.username); }

		save(){ if(this.status != UserStatus.following) this.status = UserStatus.shouldReview;}
		open(){ this.save(); window.open(this.fetch.galleryUrl, '_blank'); }
		mask(){ this._access.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

		// status
		get status(){ return this.data.status; }
		set status(status){ 
			// when we follow someone, assume everything has been viewed.
			if(status=='following')
				this._update( data => data._info.viewDate = new Date().valueOf() )
			return this._update( data => data.status=status);
		}

		// Counts
		logDownloadImage(imgProps){
			const imageYear = new Date(imgProps.captureDate||imgProps.uploadDate).getFullYear();
			this._update( data=>{ data.trackImage( imageYear ); } );
			this.trigger('imageDownloaded');
		}

		// ui items
		rename(newName){ this._access.repo.rename(this.username,newName); this.username=newName; }

		get fetch(){ return new Fetcher(this.username); }

		async scanForNewImagesAsync(){
			try{
				const newImages = await this._fetchNewImagesAsync();
				this._update( data=>data.scanForNewImagesComplete() );
				if(newImages.length>0)
					this._access.newImageRepo.update(this.username,newImageGroup=>{
						newImages.forEach( img => newImageGroup[img.responsiveUrl]=img ); // adds each image to the group
					});
			} catch( error ){
				console.error(error,'Failed to load '+this.username);
				this._update( data => data.loadFailed() );
			}
		}

		async _fetchNewImagesAsync(){ // move into fetcher?
			let result = [];

			const info = this.data._info;
			const before = JSON.stringify(this.data._info);
			const lastViewDate = this.data._info.viewDate;
			if(lastViewDate !== undefined)
				for await(let img of this.fetch.fetchGalleryImagesAsync()){
					if(img.uploadDate<lastViewDate) break;
					result.push(img);
				}
			return result;
		}

		get isDueToScanNewImages(){ return isDueToScanNewImages(this.data); }

		_update(action){
			return this._access.repo.update( this.username, 
				info => action( new UserData(this.username,info) ) 
			);
		}

	}

	class LastYearTracker{
		constructor(){
			const pageLoadDate = new Date();
			this.thisYear = pageLoadDate.getFullYear();
			const startNext = new Date(this.thisYear+1, 0, 0);
			this.percentYearLeft = (startNext-pageLoadDate) / (1000*60*60*24*365);
		}
		downloadsInLastYear(byYear){ return (byYear[this.thisYear]||0) + Math.round( (byYear[this.thisYear-1]||0)*this.percentYearLeft ); }
	}

	// ::UserData - read-only fascade around user info
	class UserData {
		constructor(username,info){
			if(info.dl==null) info.dl={};
			this.username = username;
			this._info = info;
		}
		// read
		get status(){
			if( !(this._info.failure==null) ) return UserStatus.failed;
			return convert.toStatus(this._info.stars);
		}

		get downloadsInLastYear() { return UserData._lastYearTracker.downloadsInLastYear(this.byYear); }
		get byYear(){ return this._info.dl; }
		trackImage(imageYear){
			// !!! BUG - until this.byYear is written back to storage,
			// this can be called multiple times and will keep using
			// 0 instead of the incrementing value.
			this.byYear[imageYear] = (this.byYear[imageYear]||0) + 1;
		}

		get viewDate(){ return this._info.viewDate||0; }
		get firstFailure(){ return this._info.failure.first; }
		toFailureString(){
			const failure = this._info.failure;
			return [ formatDate.YMD( new Date(failure.first)), failure.count, this.username, this.status].join('\t');
		}
		// Write / Modify
		set status(value){ this._info.stars = convert.toStars(value); }
		loadFailed(){
			if(this._info.hasOwnProperty('failure')) this._info.failure.count++;
			else this._info.failure = {count:1,first:new Date().valueOf()};
		}
		scanForNewImagesComplete(){
			this._info.viewDate = new Date().valueOf();
			delete this._info.failure;
		}
	}
	UserData._lastYearTracker = new LastYearTracker();

	const UserStatus = {
		following : "following",
		new : "new",
		shouldReview : "queued",
		ignore : "notFollowing",
		failed : "failed"
	};

	const convert = {
		toStars : function(status){
			switch(status){
				case UserStatus.shouldReview: return 'scan';
				case UserStatus.ignore: return 1;
				case UserStatus.following: return 3;
				case UserStatus.new: return null;
				default: throwExp( "Invalid status:"+status );
			}
		},
		toStatus : function(stars){
			switch(stars){
				case 'scan': return UserStatus.shouldReview;
				case 1: return UserStatus.ignore;
				case 2: case 3: case 4: case 5: return UserStatus.following;
				default: return UserStatus.new; // null
			}
		}
	}

	class UserLinks {
		constructor(username,userAccess,fetcher){
			this.username=username;
			this._access =userAccess;
			this._fetcher=fetcher;
		}
		cached(){
			return this._access.linkRepo.containsKey(this.username)  // in cache?
				? Promise.resolve( this._access.linkRepo.get(this.username) ) // use cache
				: this._scanAndSaveToCache();  // else scan
		}
		async list(){ this._listUsers( await this.cached() ); }
		async refresh(){ this._listUsers( await this._scanAndSaveToCache() ); }
		async show(){
			const newUsers = (await this.cached())
				.map( username => this._access.get(username) )
				.filter( user=>user.status == UserStatus.new );
			console.log(`Scanning 1st page of ${newUsers.length} users.`);

			const firstPageWithUsernameArray = await fetchFirstPageOfEachUser( newUsers ); // array of {user,images}
			firstPageWithUsernameArray.sort(byDesc(x=>x.images.length).thenBy(x=>x.user.username));

			const rowData = firstPageWithUsernameArray
				.map(({user,images})=>{
					const irm = new ImageRowModel({
						labelText:user.username,
						images:images,
						actions:{
							open: ()=>user.open(),
							save: ()=>user.save(),
							X:    ()=>user.mask(),
						}
					});
					irm.listen('isVisible',({isVisible}) => {
						if(!isVisible)
							console.print(`closing row [${user.username}]`);
					})
					return irm;
				});
			thumbs.loadRows(rowData);
		}

		async _scanAndSaveToCache(){
			const collectionImages = await this._fetcher.fetchCollectionImages();
			const linkedUsers = collectionImages.map(i=>i.owner)
				.filter(onlyUnique)
				.filter(u=>!this._access.commonRepo.includes(u)); // exclude anything in the commonRepo
			console.log(`Collection scan of [${this.username}] found ${linkedUsers.length} links.`); // log
			this._access.linkRepo.update(this.username,arr=>replaceArrayValues(arr,linkedUsers.sort()));
			return linkedUsers;
		}
		_listUsers(usernames){
			const x = usernames.map(u=>this._access.get(u)).sort(by(u=>u.status)).map(user=>user.username+'\t'+user.status);
			console.log(x.join('\r\n'));
		}
	}

	// =============================
	// ::Fetching

	class Fetcher {
		constructor(username){
			this.username = username;
			this._useDocumentBody = username == currentUser.username;
		}

		get galleryUrl(){ return 'https://vsco.co/'+this.username+'/gallery'; }
		collectionUrl(page){ return 'https://vsco.co/'+this.username+'/collection/'+page; }

		async fetchCollectionImages(){
			const maxImagesPerPage=20;
			const allImages=[];
			let pageNum = 0;
			let imgs;
			do{
				imgs = await this._fetchCollectionImagesOnPage(++pageNum);
				allImages.push(...imgs);
			} while(imgs.length==maxImagesPerPage);
			return allImages;
		}

		async fetchFirstPageImages(){ // return them as an array
			const html = await this._fetchGalleryPageHtml();
			return Fetcher._getPageImages( html );
		}

		// returns ImageModel objects
		async * fetchGalleryImagesAsync(){ // $$$
			const startingHtml = await this._fetchGalleryPageHtml();
			const preloadedState = Fetcher.extractPreloadedStateFromHtml(startingHtml);
			const token = preloadedState.users.currentUser.tkn;
			const [siteId,siteMedia] = Object.entries(preloadedState.medias.bySiteId)[0];
			const result = Fetcher.extractImagesFromPreloadedState(preloadedState).sort(byDesc(x=>x.uploadDate));
			for(let img of result)
				yield img;

			let nextCursor = siteMedia.nextCursor;
			while(nextCursor){
				let response = await fetch(
					'https://vsco.co/api/3.0/medias/profile?'+$.param({site_id:siteId,limit:14,show_only:0,cursor:nextCursor}),
					{headers:{"Authorization":"Bearer "+token}}
				);
				let json = await response.clone().json();
				let newImgs = json.media
					.map(({image:i}) => new ImageModel({
						owner : i.perma_subdomain,
						height : i.height,
						width : i.width,
						responsiveUrl : i.responsive_url,
						captureDate : i.capture_date,
						uploadDate : i.upload_date,
					}))
					.sort(byDesc(x=>x.uploadDate));
				for(let img of newImgs) yield img;
				nextCursor = json.next_cursor;
			}
		}

		static _getPageImages(html){
			let preloadedState = Fetcher.extractPreloadedStateFromHtml(html);
			if(preloadedState.errorMessage =="site_not_found") { throw "site_not_found"; }
			let result = Fetcher.extractImagesFromPreloadedState(preloadedState);
			return result;
		}

		async _fetchGalleryPageHtml(){
			return this._useDocumentBody
				? document.querySelector('body').outerHTML
				: await $.ajax({url: this.galleryUrl });
		}

		_fetchCollectionPageHtml(pageNum){
			return $.ajax({url: this.collectionUrl(pageNum) });
		}

		async _fetchCollectionImagesOnPage(pageNum){
			return Fetcher._getPageImages( await this._fetchCollectionPageHtml(pageNum) );
		}

		static extractPreloadedStateFromHtml(html){
			let json = findStringBetween(html,'window.__PRELOADED_STATE__ = ','</script>'); // because string.match(regex) does not match unicode characters!
			if(json == null){ console.log('Unable to find preloaded state in:',html); throw 'no preloaded state found'; }
			json = json.replaceAll(":undefined,",":null,");
			return JSON.parse(json);
		}

		// returns array of ImageModel objects.
		static extractImagesFromPreloadedState(preloadedState){
			let images = Object.values(preloadedState.entities.images)
				.map(img=> new ImageModel({
						owner: img.permaSubdomain,
						height: img.height,
						width: img.width,
						responsiveUrl:img.responsiveUrl,
						videoUrl: img.videoUrl,
						captureDate: img.captureDate,
						uploadDate: img.uploadDate
					}));
			let videos = preloadedState.entities.videos;
			return images;
		}

	}

	class ImageModel{
		owner; height; width; 
		responsiveUrl; videoUrl; url;
		captureDate; uploadDate; imgDate;
		constructor({owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate}){
			Object.assign(this,{owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate});

			this.imgDate = new Date(captureDate||uploadDate);
			this.localFileName = owner+' '+formatDate.forFilename(this.imgDate)+".jpg";

			this.url = videoUrl&&('https://'+videoUrl) 
				|| this.getResponsiveLink();

			// status: notStarted, downloading, complete, errored, timeout
			new Observable(this).define('downloadProgress',{status:'notStarted'});
		}

		toJSON(){
			// only use the data we need for the constructor
			const {owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate}=this;
			return {owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate};
		}

		getResponsiveLink( boxSize ){
			let match = this.responsiveUrl.match(/im.vsco.co\/aws-us-west-2\/(.*)/);
			if( match !== null )
				return boxSize
					? 'https://im.vsco.co/aws-us-west-2/'+match[1]+'?w='+boxSize+'&amp;dpr=1' // !!! sometimes this has a size already in the url and then it redirects
					: 'https://image-aws-us-west-2.vsco.co/'+match[1];

			match = this.responsiveUrl.match(/im.vsco.co\/1\/(.*)/);
			if( match !== null ) 
				return 'https://im.vsco.co/1/'+match[1];

			if( this.responsiveUrl.endsWith('?width=120') ) 
				return this.responsiveUrl;

			throw 'unable to rewrite Image Url for image: ' + orig;
		}

		downloadAsync(){
			return new Promise((resolve,reject) => {
				GM_download({ url:this.url, name:this.localFileName,
					onprogress : ({loaded,total}) => {
						console.log('%cPROGRESS','color:red;font-weight:bold;font-size:18px;');
						this.downloadProgress = {status:'downloading',loaded,total};
					},
					onload : (x) => {
						this.downloadProgress = {status:'complete'};
						resolve(x)
					},
					onerror : (x) => { 
						this.downloadProgress = {status:'errored',error:x};
						reject(x)
					},
					ontimeout : x => {
						this.downloadProgress = {status:'timeout'};
						reject({"error":"timeout"});
					}
				}); // GM_download
			}); // new Promise
		} // downloadAsync

	}

	class YearModel {
		year;
		sparse; // array 0..11, with possible undefineds
		months; // array with only the months we have
		constructor(year,byMonth){
			this.year = year;
			this.sparse = []; 
			for(var i=1;i<=12;++i){
				const monthKey = year+(i<10?"-0":"-")+i;
				this.sparse.push( byMonth[ monthKey ] )
			}
			this.months = this.sparse.filter(x=>x!=undefined);
			new Observable(this).define('hasFocus',undefined);
		}
	}

	class MonthModel {
		key; // "yyyy-mm"
		images; // ImageModel[]
		constructor(yearMonth,images=throwExp('mm images')){
			this.key = yearMonth;
			this.images = images;
			new Observable(this).define('hasFocus',undefined);
		}
		toImageRow(){ 
			const [year,month] = this.key.split('-');
			return new ImageRowModel({
				labelText:`${this.key} (${monthNames[month-1]})`,
				images:this.images
			});
		}
	}

	class CalendarModel{
		username;
		byMonth; // { yearMonth: MonthModel, }
		byYears; // { year: YearModel[], }
		constructor( user ){
			this.user = user;
			this.title = user.username;
			new Observable(this)
				.define('selectedMonths',[])
				.define('isLoading',undefined);
		}
		async loadAsync(){

			this.isLoading = true;  // observable

			const imageStream = this.user.fetch.fetchGalleryImagesAsync();
			const allImages = await Array.fromAsync( imageStream );

			// group images by Month and build a Month Model
			// byMonth = {'2010-06':ImageModel[], '2010-06':ImageModel[]}
			const groups = groupBy(allImages, img => formatDate.YM(new Date(img.uploadDate)) )
			this.byMonth ={};
			for(let yearMonth in groups){
				const mm = new MonthModel(yearMonth,groups[yearMonth]);
				mm.listen('hasFocus',(x) => this._syncFocusMonth(x));
				this.byMonth[yearMonth] = mm;
			}

			this._sortedMonthKeys = Object.keys(this.byMonth).sort();
			this._count = this._sortedMonthKeys.length;

			let monthsByYear = groupBy( Object.keys(this.byMonth), x=>x.split('-')[0] ); // grouped by year
			this.byYear = {};
			for(let year in monthsByYear){
				const ym = new YearModel(year,this.byMonth); // !!!
				ym.listen('hasFocus',({host,hasFocus}) => {
					if(!hasFocus) return;
					this._blurFocusYear();
					this._focusYear = host;
					this._selectMonths(host.months);
				} )
				this.byYear[year] = ym;
			}

			this.isLoading = false; // observable

		}
		selectAll(){ this._selectMonthByKeyFilter( k => true, true ); }
		selectYear(year){ 
			this._selectMonthByKeyFilter( k=>k.startsWith(year) );
		}
		selectMonthOfEveryYear(month){ 
			this._selectMonthByKeyFilter( k=>k.endsWith(month), true );
		}
		_selectMonthByKeyFilter(keyFilter,reverse=false){ 
			const months = this._sortedMonthKeys.filter(keyFilter).map(k=>this.byMonth[k])
			if(reverse) months.reverse();
			this._selectMonths(months); 
		}
		_selectMonths(months){
			this._blurFocusMonth();
			this._focusMonth = undefined;
			for(let mm of months) mm.hasFocus = false; // hack - show it as visited
			this.selectedMonths = months;
		}
		prev(){
			const oldFocusIndex = (this._focusMonth === undefined)
				? this._count
				: this._sortedMonthKeys.indexOf(this._focusMonth.key);
			this._setFocus( oldFocusIndex-1 );
		}
		next(){
			const oldFocusIndex = (this._focusMonth === undefined)
				? -1
				: this._sortedMonthKeys.indexOf(this._focusMonth.key);
			this._setFocus( oldFocusIndex+1 );
		}
		_setFocus( focusIndex ){
			if(focusIndex < 0 || this._count <= focusIndex){
				console.log('off end');
				return;
			}
			const focusKey = this._sortedMonthKeys[focusIndex];
			this.byMonth[ focusKey ].hasFocus = true;
		}
		// called by listener when hasFocus is changed.
		_syncFocusMonth({host,hasFocus}){
			if(!hasFocus) return;
			this._blurFocusMonth();
			this._focusMonth = host;
			this.selectedMonths = [host];
		}
		_blurFocusMonth(){
			if(this._focusMonth != null)
				this._focusMonth.hasFocus = false;
		}
		_blurFocusYear(){
			if(this._focusYear != null)
				this._focusYear.hasFocus = false;
		}
	}

	// Displays 1 month cell in the CalendarView
	function makeMonthView(model) { // MonthModel
		const cellCss = {width: "30px", "padding":"2px","text-align":"center"};
		const focusCss = {'background':'lightgray', 'border':'2px solid red'};
		const blurCss  = {'background':'lightgray', 'border':'none'};
		const $cell = $('<td>').css(cellCss);
		if( model ){
			$cell.text(model.images.length)
				.data('yearMonth',model.key)
				.attr('data-yearMonth',model.key)
				.css({"cursor":"pointer"})
				.on('click',()=>{ model.hasFocus = true; });
			model
				.listen('hasFocus', ({hasFocus}) => {
					$cell.css(hasFocus ? focusCss : blurCss);
				})
		}
		return $cell;
	}

	function makeHeaderRow(calendarModel){ // CalendarModel
		let $row = $('<tr>').addClass('label');
		const headerCss = {
			cursor:'pointer',
			"font-weight":"bold",
			"text-align":"center",
			width:"30px",
		};
		$('<td>').appendTo($row).text('*')
			.css(headerCss)
			.css({color:"black",'background':'white'})
			.on('click',()=>calendarModel.selectAll() );
		monthNames
			.forEach((m,idx)=>$('<td>').appendTo($row).text(m)
				.css(headerCss)
				.css({color:colors.attribute,'background':monthColors[idx]})
				.on('click', ()=>calendarModel.selectMonthOfEveryYear(idx+1))
			)
		return $row;
	}

	function makeYearView(yearModel) {
		const {year,sparse} = yearModel;
		const $year = $('<tr>').addClass('year');
		$('<td>').text(year).appendTo($year)
			.on('click', () => yearModel.hasFocus = true )
			.css({width: "30px", "padding":"2px","font-weight":"bold",'cursor':'pointer'});// label
		sparse.forEach( mm => makeMonthView(mm).appendTo($year) );
		return $year;
	}

	class CalendarView {
		constructor( model ){

			// bind model
			this.model = model;
			this.model.listen('selectedMonths',({selectedMonths}) => {
				scrollToTop(); setTimeout(scrollToTop, 2000);
				let rowData = selectedMonths.map(mm => mm.toImageRow());
				thumbs.loadRows( rowData );
			})
			this.model.listen('isLoading',({isLoading}) => {
				if(isLoading){
					this.dataStatus = 'loading';
					this._showSpinner();
				} else {
					this._generateResultRows();
				}
			})

			// build view
			$("<style type='text/css'> @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } </style>").appendTo("head");
			// create table
			this.$table = $('<table>').css({"font-size":"10px","table-collapse":"collapse"});
			// top row
			this.$topRow = $('<tr>').appendTo(this.$table).on('click',this._headerClick.bind(this))
				.css({background:'#AAA'});
			$('<td>').attr('colspan','12').html(model.title).appendTo( this.$topRow )
				.css({width:'360px',height:'10px','text-align':'center',color:'white',"font-weight":"bold","font-size":"14px"});
			this.$icon = $('<td>').appendTo( this.$topRow ).css({'text-align':"center",'width':'30px'});
			this._showExpand();

			return this.$table;
		}

		_showSpinner(){ this.$topRow.css('cursor','auto'); this.$icon.empty(); $('<div>').appendTo( this.$icon ).css({ 'display':'inline-block','border':'2px solid #CCC', 'border-top-color':'#08A', 'border-radius': '50%', 'width':'10px','height':'10px', 'animation':'spin 1s linear infinite'}); }
		_showCollapse(){ this.$topRow.css('cursor','pointer'); this.$icon.html("-"); }
		_showExpand(){ this.$topRow.css('cursor','pointer'); this.$icon.html("+"); }
		_headerClick(){
			switch(this.dataStatus){
				case 'hidden': 
					this.$table.find('tr.year,tr.label').show(); 
					this.dataStatus='visible'; 
					this._showCollapse();
					break;

				case 'visible': 
					this.$table.find('tr.year,tr.label').hide(); 
					this.dataStatus='hidden'; 
					this._showExpand();
					break;

				case 'loading': /* do nothing */ break;

				default: this.model.loadAsync(); break;
			}
		}
		_generateResultRows(){
			this._showCollapse(); 
			this.dataStatus = "visible";
			this.$table.append( makeHeaderRow( this.model ) );

			Object.keys(this.model.byYear).sort().reverse()
				.forEach( year => {
					const ym = this.model.byYear[year];
					makeYearView(ym).appendTo(this.$table);
				});
		}
	}
	function scrollToTop(){document.body.scrollTop = document.documentElement.scrollTop = 0;}

	function fetchFirstPageOfEachUser(users){ // !! this might be more link-related than fetch-related
		let userImages = [];
		var threads = users.map(function(user){
			return () => user.fetch.fetchFirstPageImages()
				.then( images => userImages.push({ user, images }) );
		});
		return executePromisesInParallel(threads).then(x=>userImages); // when all threads are done, return the updated list
	}

	class NextLink{ 
		label; nextUrl; count;
		constructor({label,nextUrl,count}){
			Object.assign(this,{label,nextUrl,count});
		}
		goto(){
			const {label,count,nextUrl} = this;
			const msg = `${count} ${label}.`;
			console.print(msg);
			saveNotification(msg);
			if(nextUrl)
				setTimeout(()=>window.location.href=nextUrl,2000);
		}
		// UI stuff
		appendTo($host){
			const {label,nextUrl,count} = this;
			if(!count) return;
			$('<div>')
				.text(`${label}: ${count}`)
				.css({'text-decoration':'underline','cursor':'pointer','font-size':'12px'})
				.on('click',() => document.location.href = nextUrl )
				.appendTo($host)
		}
	}

	class Importer{
		constructor($import){
			const self=this;
			$import.on('change',function (evt) {
				for(const file of this.files){
					switch(file.name){
						case 'localStorage.users.json': self.importLocalStorageFromFile(file,'users'); break;
						case 'localStorage.graph.json': self.importLocalStorageFromFile(file,'graph'); break;
						case 'localStorage.common.csv': self.importLocalStorageFromFile(file,'common'); break;
						default: alert('Unexpected file: '+file.name ); break;
					}
				}
			})
		}
		async importLocalStorageFromFile(file,key){
			localStorage[key] = await this.readFileAsync(file);
			console.log(`${key} loaded from file.`);
		}
		readFileAsync(file) {
			var dfd = jQuery.Deferred();
			var reader = new FileReader();
			reader.onload = e => dfd.resolve( e.target.result );
			reader.onerror = e => dfd.reject( 'sorry there was an error reading file.');
			reader.readAsText(file);
			return dfd.promise();
		}
	}

	function saveNotification(msg){
		const lines = getNotifications();
		lines.push(msg);
		sessionStorage.msgs = lines.join("\r\n");
	}
	function getNotifications(){
		return (sessionStorage.msgs || '').split('\r\n').filter(x=>x.length>0);
	}
	for(let msg of getNotifications()) console.print(`%c${msg}`,msgCss)
	sessionStorage.msgs = '';


	class LastYear{
		constructor([u,v]){
			this.username = u;
			this.lastYear = LastYear.calcLastYear(v,1980);
			this.lastCount = this.lastYear==1980 ? 0 : v.dl[this.lastYear];
			this.viewDate = v.viewDate;
		}
		static calcLastYear({dl},defaultYear=1980){ 
			const keys = Object.keys(dl||{});
			return (keys.length==0)  ? defaultYear : Math.max(...(keys));
		}
	}
	function goToFirstUser(users){
		if(users.length>0)
			setTimeout(()=>window.location.href=`/${users[0].username}/gallery`,2000);
	}


	// Services / repositories / models
	const userAccess = new UserAccess();
	const currentUser = userAccess.get( userAccess.currentUsername );
	const calendar = new CalendarModel( currentUser )
	const startingState = structuredClone(currentUser.data._info);
	const loadTimeMs = new Date().valueOf();

	// build the UI / Views
	const ui = new Layout();
	const thumbs = new Gallery( ui.$thumbDiv, ui.$visibleRowProgress );
	const starRow = new UserStatusControl( ui.$userStatusDiv );
	const scanNewImagesMenu = new ScanNewImagesMenu( ui.$scanNewImagesDiv );
	ui.$calendar.append( new CalendarView( calendar ) );

	const downloadCounts = new DownloadCountsControl(ui.$userDownloadCountsDiv);
	const importer = new Importer( ui.$import );

	// == Blue Console.log() ==
	function logStartingState(){
		console.print('starting state => %c'+JSON.stringify(startingState,null,'\t'),'color:blue;');
	}

	// bind
	downloadCounts.bind(currentUser);
	starRow.bindToUser(currentUser);
	scanNewImagesMenu.setUsersByStar( userAccess );
	

	// links
	userAccess.needsReview().appendTo(ui.$scanNext);
	userAccess.missingViewDate().appendTo(ui.$scanNext);
	userAccess.toPrune().appendTo(ui.$scanNext);

	// enter(13) shift(16) ctl(17) alt(18) capslock(20) esc(27)
	// pgup(33) pgdwn(34) end(35) home(36) left(37) up(38) right(39) down(40) ins(45) del(46)
	// 0(48)..9(57), numpad: 0(96)..9(105)
	// A(65)
	// F2(113), F4(115) F7(118) F9(120), numlock(144)
	unsafeWindow.addEventListener('keydown',function({which,repeat,ctrlKey,altKey,shiftKey}){
		if(repeat) return;
		// 37 left, 38 up, 39 right, 40 down
		switch(which){
			case 36: /*home*/ scrollToTop(); break;
			case 37: /*left*/ calendar.prev(); break;
			case 38: /*up*/ break;
			case 39: /*right*/ calendar.next(); break;
			case 40: /*down*/ break;
			case 79: /*O*/ thumbs.openLast(); break;
			case 88: /*X*/ thumbs.closeFirst(); break;
			default: console.debug('which:',which); break; 
		}
	});

	// Init page
	(async function(){
		switch( currentUser.status ){
			case UserStatus.new:
			case UserStatus.shouldReview:
				logStartingState();
				// show First Page
				const firstPageImages = await currentUser.fetch.fetchFirstPageImages();
				if(firstPageImages.length>0)
					thumbs.loadRows([new ImageRowModel({ 
						labelText: 'galley page-1 images',
						images:firstPageImages
					})])
				calendar.loadAsync();
				break;

			case UserStatus.following:
				logStartingState();
				// Show New Images !
				if(startingState.viewDate===undefined){
					console.print('%cNo View Date found',importantCss);
					const lastYear = Object.keys(startingState.dl).reverse()[0]||new Date(loadTimeMs).getYear();
					console.print(`Downloads for ${lastYear}: %c${startingState.dl[lastYear]}`,downloadCountCss);
					calendar.loadAsync();
				}
				await currentUser.scanForNewImagesAsync(); // Sets the View Date which we NEED

				if(currentUser.newImages.length>0){
					const newImagesRow = new ImageRowModel({ labelText : 'new images', images:currentUser.newImages })
					thumbs.loadRows([newImagesRow])
					currentUser.clearNewImages();
				}
				break;

			case UserStatus.ignore:
				logStartingState();
				console.print(`%cstatus=Ignored`,importantCss);
				break;

			case UserStatus.failed:
				logStartingState();
				console.print(`%cstatus=Failed`,importantCss);
				break;

			default:
				logStartingState();
				console.print(`%cUnknown status [${currentUser.status}]`,'color:#F88;background-color:black;');
				break;
		}

	})();

	// ::unsafeWindow
	unsafeWindow.users = userAccess;
	unsafeWindow.user = currentUser;
	unsafeWindow.report = {
		status : function(status=throwExp('must supply status')){
			return userAccess.allUsers
				.filter(u=>u.data.status==status)
				.sort(by(user=>user.username))
				.map( user=>[user.username,user.data.status].join('\t') )
				.join('\r\n');
		},
		failures : function(){
			return userAccess.allUsers
				.filter(u=>u.data.status==UserStatus.failed)
				.sort(by(user=>user.data.firstFailure))
				.map(user => user.data.toFailureString() )
				.join("\r\n")
		},
		toReview : function(){ console.log(userAccess.allUsers.filter(u=>u.data.status==UserStatus.shouldReview).map(user=>user.username).join("\r\n")); },
		findLinksTo: function(needle){ console.log(userAccess.findLinksTo(needle).join("\r\n")); }
	}

	const CMD = unsafeWindow.cmd = {
		owner: document.location.href.match(/vsco.co.([^\/]+)/)[1],
		currentUser,
		missingViewDate: function(sortLongestOutageFirst=false){
			userAccess.missingViewDate( sortLongestOutageFirst ).goto();
		},
		nextToPrune(yearsWithoutDownload=4){
			userAccess.toPrune( yearsWithoutDownload ).gotogo();
		},
		downloads: []
	}

})();

/*

Performance
	If user under-performing (not upload photo 6 photos in last year) then archive them

*/