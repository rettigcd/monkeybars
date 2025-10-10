// ==UserScript==
// @name         VSCO Gallery
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Efficient VSCO Gallery surfer
// @author       Dean Rettig
// @match        http*://vsco.co/*
// @match        http*://vsco.com/*
// @require      file://C:/[monkeyBarsFolder]/dom.js
// @require      file://C:/[monkeyBarsFolder]/epoch_time.js
// @require      file://C:/[monkeyBarsFolder]/observable.js
// @require      file://C:/[monkeyBarsFolder]/storage.js
// @require      file://C:/[monkeyBarsFolder]/vsco.user.js
// @icon64       https://www.google.com/s2/favicons?sz=64&domain=vsco.co
// @grant        GM_download
// @grant        GM_setClipboard
// @grant        GM_log
// @grant        unsafeWindow
// ==/UserScript==

(function() {
	'use strict';

	const storageTime = EpochTime.UnixTime;

	const formatDate = (function(){
		function pad(i){ return (i<10?'0':'')+i; }
		const y=x=>x.getFullYear(), m=x=>pad(x.getMonth()+1), d=x=>pad(x.getDate());
		const h=x=>pad(x.getHours()), n=x=>pad(x.getMinutes()), s=x=>pad(x.getSeconds());
		return {
			YMD :         (x) => `${y(x)}-${m(x)}-${d(x)}`, // img caption, failure date
			YM :          (x) => `${y(x)}-${m(x)}`, // grouping images by month
			forFilename : (x) => [y(x),m(x),d(x),h(x),n(x),s(x)].join(''),
		};
	})();

	console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); }

	function throwExp(msg){ console.trace(); throw msg; } 

	// ===== CSS =====
	class Colors {

		static makeLight(){ return new Colors({
			winter:'#ddf', spring:'#9ab895', summer:'#d48e8e', fall:'#b3a174', old:'white',
			attribute:'black', galleryRowBg:'white'
		});}
		static makeDark(){ return new Colors({
			winter:'#668', spring:'#373', summer:'#844', fall:'#663', old:'#444',
			attribute:'white', galleryRowBg:'#333'
		});}

		forMonth;
		old;
		attribute;
		galleryRowBg;
		video = 'purple';

		constructor({winter,spring,summer,fall,old,attribute,galleryRowBg}){
			Object.assign(this,{attribute,galleryRowBg,old});
			this.forMonth = [winter,winter,spring,spring,spring,summer,summer,summer,fall,fall,fall,winter];
		}
	}
	const colors = Colors.makeDark();

	const css = {
		spinner: { border:"8px solid", "border-color":"blue lightgray", 'border-radius':'50%', width:'16px',height:'16px', animation:'spin 2s linear infinite' },
		imageRow: { "display":"flex","flex-direction":"row","justify-content":"flex-start", background:colors.galleryRowBg},
		monthName: idx => ({color:colors.attribute,'background':colors.forMonth[idx]}),
	};

	const consoleCss = {
		msg : 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;',
		important : 'color:#F88; background:black; font-size:1rem; padding:0.3rem 0.7rem;border-radius:8px;',
		downloadCount : 'color:red; font-weight:bold; font-size:1.5rem;'
	}

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

	function executePromisesInParallelAsync(asyncActions,parallelCount=8,progressCallback=function(){}){
		const status = {loaded:0,total:asyncActions.length};
		progressCallback(status);
		asyncActions=asyncActions.slice(); // make copy so we can modify
		async function processAsync(){
			while(0<asyncActions.length){
				try{ await (asyncActions.shift())(); } catch (error) { console.log(error); }
				++status.loaded;
				progressCallback(status);
			}
		}
		return Promise.all( Array.from({length:parallelCount},()=>processAsync()) );
	}

	// =====  Begin: Models  =====
	// =====  Begin: Models  =====
	// =====  Begin: Models  =====

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
			const groups = groupBy(allImages, img => formatDate.YM(storageTime.toDate(img.uploadDate)) )
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
			if(month<10) month = '0'+month; // so '2' doesn't include '12'
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

	class Gallery{
		rows; // ImageRowModel[]
		constructor(){
			new Observable(this).define('rows',[]);
		}
		closeFirst(){
			// interact with model instead of view
			const visibleModels = this.rows
				.filter(m=>m && m.isVisible);
			if(visibleModels.length) visibleModels[0].isVisible=false;
		}
		openLast(){
			// interact with model instead of view
			const visibleModels = this.rows
				.filter(m=>m && !m.isVisible)
				.reverse();
			if(visibleModels.length) visibleModels[0].isVisible=true;
		}
	}

	class ImageModel{
		owner; height; width; 
		responsiveUrl; videoUrl; url;
		captureDate; uploadDate; imgDate;
		constructor({owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate}){
			Object.assign(this,{owner,height,width,responsiveUrl,videoUrl,captureDate,uploadDate});

			this.imgDate = storageTime.toDate(captureDate||uploadDate);
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
			if( match !== null ){
				this.urlStyle = 1;
				return boxSize
					? 'https://im.vsco.co/aws-us-west-2/'+match[1]+'?w='+boxSize+'&amp;dpr=1' // !!! sometimes this has a size already in the url and then it redirects
//					: 'https://image-aws-us-west-2.vsco.co/'+match[1]; // the full images used to be stored at this alternative host
					: 'https://im.vsco.co/aws-us-west-2/'+match[1]; // but now they are the same server as resposneive URL
			}

			match = this.responsiveUrl.match(/im.vsco.co\/1\/(.*)/);
			if( match !== null ){
				this.urlStyle = 2;
				return 'https://im.vsco.co/1/'+match[1];
			}

			if( this.responsiveUrl.endsWith('?width=120') ){
				this.urlStyle = 3;
				return this.responsiveUrl;
			}

			this.urlStyle = 4;
			throw 'unable to rewrite Image Url for image: ' + orig;
		}

		// Downloads image to "Downloads" folder
		downloadAsync(){
			return new Promise((resolve,reject) => {
				const id = setTimeout(()=>{
					this.downloadProgress = {status:'timeout'};
					reject('timeout');
				},5000);
				function cancelTimeout(){ clearTimeout(id); }

				GM_download({ url:this.url, name:this.localFileName,
					onprogress : ({loaded,total}) => {
						console.log('%cPROGRESS','color:red;font-weight:bold;font-size:18px;');
						this.downloadProgress = {status:'downloading',loaded,total};
					},
					onload : (x) => {
						cancelTimeout();
						this.downloadProgress = {status:'complete'};
						resolve(x)
					},
					onerror : (x) => { 
						cancelTimeout();
						this.downloadProgress = {status:'errored',error:x};
						x.urlStyle = this.urlStyle;
						x.origUrl = this.responsiveUrl;
						x.dlUrl = this.url;
						reject(x)
					},
					ontimeout : x => {
						cancelTimeout();
						this.downloadProgress = {status:'timeout'};
						reject({"error":"timeout"});
					}
				}); // GM_download
			}); // new Promise
		} // downloadAsync

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

	// =====  Begin: Views  =====
	// =====  Begin: Views  =====
	// =====  Begin: Views  =====

	class Layout{
		gallery;
		constructor(userAccess,galleryModel){
			const css = {
				top			: {position:"fixed",top:"0px",left:'0px',width:'100%',height:"50px",'z-index':'3000',background:'rgba(255,255,255,0.9)',overflow:"auto"},
				leftPanel	: {margin:0,padding:0,display:'inline-block'},
				star		: {display:'inline-block'},
				userLink	: {display:'inline-block'},
				calendar	: {position:'fixed',right:'2px',top:'0',background:"white",border:"thin solid gray"},
				next		: {position:'absolute',right:'400px',top:'0'},
				counts		: {display:'inline-block'},
				progress	: {display:'inline-block', width:"150px", height:"15px","font-size":"12px", padding:'2px',color:'#060'},
			};

			// prependTo, appendTo, insertAfter

			const top = newEl('div').css(css.top);
			const leftPanel = newEl('div').css(css.leftPanel).appendTo(top);

			this.userStatusDiv = newEl('div').css(css.star).appendTo(leftPanel);
			this.userDownloadCountsDiv = newEl('div').css(css.counts).appendTo(leftPanel);

			const scanNewImagesDiv = newEl('div').css(css.userLink).appendTo(leftPanel);
			const visibleRowProgress = newEl('div').css(css.progress).appendTo(leftPanel);

			this.calendarEl = newEl('div').css(css.calendar).appendTo(top);
			this.scanNextEl = newEl('div').css(css.next).appendTo(top);
			const thumbDiv = newEl('div');

			const spacerEl = newEl('div').css({"height":css.top.height});
			setInterval(()=>spacerEl.css({'height':top.style.height}),2000); // !!! ? does top height change?
			const fileImport = newEl('input').appendTo(document.body).attr('type','file').attr('multiple',true);

			document.body.prepend(spacerEl,top,thumbDiv);

			// bind to model
			new ScanNewImagesMenu( scanNewImagesDiv, userAccess );
			this.gallery = new GalleryView( thumbDiv, visibleRowProgress, galleryModel );
			new Importer( fileImport );

			// next links
			for(let link of [userAccess.needsReview(), userAccess.missingViewDate(), userAccess.toPrune()])
				link.appendTo(this.scanNextEl);
		}
		// If page is a user-page, this binds to their models.
		showCurrentUser(userCtx, calendar){
			this.userStatusDiv.append( makeUserStatusControl( userCtx ) );
			this.userDownloadCountsDiv.append( makeDownloadCountsControl(userCtx) );
			this.calendarEl.appendChild( new CalendarView( calendar ) );
		}
		appendButton(button){
			this.scanNextEl.appendChild(button);
		}
	}

	class GalleryView {
		rows; // ImageRowView[]
		model; // GalleryModel;
		constructor( thumbDiv, progressDiv, model ){
			new HasEvents(this);
			this.thumbDiv = thumbDiv;
			this.progressDiv = progressDiv;
			this.model = model;
			this.model.listen('rows',({rows}) => this._showRowViewsAsync(rows) );
		}
		loadRows(rowData){ this.model.rows = rowData; }

		async _showRowViewsAsync(rowData){

			this.thumbDiv.innerHTML='';
			window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
			this.rows = rowData.map(x=>{ 
				return new ImageRowView(x,this.thumbDiv);
			});

			this.visibleRowCount = 0;
			this.totalRowCount = this.rows.length;
			this._adjustCounts(0,0); // trigger change event
			this.rows.forEach(row=>{
				row.on('loaded',()=>this._adjustCounts(1,0) );
				row.on('closed',()=>this._adjustCounts(-1,-1) );
			});

			this._showCloseButton();
			for(let rowView of this.rows)
				await rowView.loadAsync();
		}

		_adjustCounts(deltaVisible,deltaTotalRowCount){
			this.visibleRowCount += deltaVisible;
			this.totalRowCount += deltaTotalRowCount;
			if(this.totalRowCount == 0)
				this._closeButton.remove();
			this.progressDiv.innerText = `${this.visibleRowCount} of ${this.totalRowCount} rows`;
		}

		_showCloseButton(){
			const buttonCss = {'border':'3px outset black','padding':'3px','margin':'2px','background':'gray'}
			this._closeButton = newEl('button').appendTo(this.thumbDiv).setText('close all').css(buttonCss)
				.on('click',()=>this._closeAllRows());
		}
		_closeAllRows() {
			window.scrollTo(0,0); // incase scrolled to bottom, scroll back to top
			this.rows.forEach( x=>x.model.isVisible = false );
			this.rows = [];
		}
	}

	class ImageRowView {

		constructor(imageRowModel,container){
			new HasEvents(this);
			this.model = imageRowModel;

			const rowDiv = newEl('div').css(css.imageRow).appendTo(container);
			const closeTab = newEl('div').css({'width':'30px','border-top':'thin solid #808'}).appendTo( rowDiv );
			const subContainer = newEl('div').css({'width':'100%'}).appendTo(rowDiv);
			const label = new ImageRowLabelView( subContainer, this.model.labelText );
			this.imgContainer = newEl('div').appendTo(subContainer);

			this.model.listen('isVisible',({isVisible})=>{
				if(isVisible)
					rowDiv.style.display=rowCss.display;
				else{
					rowDiv.style.display="none";
					this.trigger('closed');
				}
			})

			// Events
			this.on('loaded',()=>{
				label.enable();
				closeTab
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
		async loadAsync(){
			// construct all of the image-thumb containers now
			const thumbNames = this.model.images.map(imgModel =>
				new ImageThumbControl( imgModel, this.imgContainer )
			);

			// load them later
			await executePromisesInParallelAsync( thumbNames.map( t=>(()=>t.loadAsync()) ), 10 );
			this.trigger('loaded');
		}
	}

	class ImageRowLabelView {
		constructor(container,text){
			new HasEvents(this);
			const labelCss = {
				"font-size":"20px",
				"font-family":
				"sans-serif",
				"background":"#ACC",
				"text-align":"left",
				"width":"100%",
				"padding":"2px 10px"};
			this.labelDiv = newEl('div').setText( text ).css(labelCss).addClass('imageRowLabel').appendTo(container);
			this._buttons=[];
		}
		enable(){
			this._buttons.forEach(btn=>this._enableButton(btn));
		}
		_enableButton(btn){
			const buttonCss = {'cursor':'pointer','border':'outset','margin':'10px','display':'inline-block','font-size':'10px'};
			newEl('span').setText(btn.text).appendTo(this.labelDiv).css(buttonCss)
				.on('click',(e)=>{e.stopPropagation();this.trigger(btn.eventName);} );
		}
		addButton(text,onClickHandler){
			let eventName=text+'_clicked';
			this._buttons.push({text,eventName}); // trigger the event
			this.on(eventName,onClickHandler); // handle it
		}
	}

	// Displays 1 month cell in the CalendarView
	function makeMonthView(model) { // MonthModel
		const cellCss = {width: "30px", "padding":"2px","text-align":"center"};
		const focusCss = {'background':'lightgray', 'border':'2px solid red'};
		const blurCss  = {'background':'lightgray', 'border':'none'};
		const cell = newEl('td').css(cellCss);
		if( model ){
			cell.setText(model.images.length)
				.css({"cursor":"pointer"})
				.on('click',()=>{ model.hasFocus = true; });
			model
				.listen('hasFocus', ({hasFocus}) => {
					cell.css(hasFocus ? focusCss : blurCss);
				})
		}
		return cell;
	}

	function makeHeaderRow(calendarModel){ // CalendarModel
		let row = newEl('tr').addClass('label');
		const headerCss = {
			cursor:'pointer',
			"font-weight":"bold",
			"text-align":"center",
			width:"30px",
		};
		newEl('td').appendTo(row).setText('*')
			.css(headerCss)
			.css({color:"black",'background':'white'})
			.on('click',()=>calendarModel.selectAll() );
		monthNames
			.forEach((m,idx)=>newEl('td').appendTo(row).setText(m)
				.css(headerCss)
				.css(css.monthName(idx))
				.on('click', ()=>calendarModel.selectMonthOfEveryYear(idx+1))
			)
		return row;
	}

	function makeYearView(yearModel) {
		const {year,sparse} = yearModel;
		const yearEl = newEl('tr').addClass('year');
		newEl('td').setText(year).appendTo(yearEl)
			.on('click', () => yearModel.hasFocus = true )
			.css({width: "30px", "padding":"2px","font-weight":"bold",'cursor':'pointer'});// label
		sparse.forEach( mm => makeMonthView(mm).appendTo(yearEl) );
		return yearEl;
	}

	class CalendarView {
		constructor( model ){

			// bind model
			this.model = model;
			this.model.listen('selectedMonths',({selectedMonths}) => {
				scrollToTop(); setTimeout(scrollToTop, 2000);
				gallery.rows = selectedMonths.map(mm => mm.toImageRow());
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
			addStyleSheet('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');

			// create table
			this.table = newEl('table').css({"font-size":"10px","table-collapse":"collapse"});
			// top row
			this.topRow = newEl('tr').appendTo(this.table).on('click',()=>this._headerClick()).css({background:'#AAA'});
			newEl('td').attr('colspan','12').setText(model.title).appendTo( this.topRow )
				.css({width:'360px',height:'10px','text-align':'center',color:'white',"font-weight":"bold","font-size":"14px"});
			this.iconTd = newEl('td').css({'text-align':"center",'width':'30px'}).appendTo( this.topRow );
			this._showExpand();

			return this.table;
		}

		_headerClick(){
			switch(this.dataStatus){
				case 'hidden':  this._displayRows(true); this.dataStatus='visible'; this._showCollapse(); break;
				case 'visible': this._displayRows(false); this.dataStatus='hidden'; this._showExpand(); break;
				case 'loading': /* do nothing */ break;
				default: this.model.loadAsync(); break;
			}
		}
		_displayRows(shouldDisplay){ const display=shouldDisplay?"":"none"; [...this.table.querySelectorAll('tr.year,tr.label')].forEach(x=>x.style.display=display); }
		_showSpinner(){ this.topRow.css({'cursor':'auto'}); this.iconTd.innerHTML=''; newEl('div').appendTo( this.iconTd ).css(css.spinner);}
		_showCollapse(){ this.topRow.css({'cursor':'pointer'}); this.iconTd.innerText="➖"; } // 🔺➖
		_showExpand(){ this.topRow.css({'cursor':'pointer'}); this.iconTd.innerText="➕"; } // 🔻➕
		_generateResultRows(){
			this._showCollapse(); 
			this.dataStatus = "visible";
			makeHeaderRow( this.model ).appendTo( this.table );

			Object.keys(this.model.byYear).sort().reverse()
				.forEach( year => {
					const ym = this.model.byYear[year];
					makeYearView(ym).appendTo(this.table);
				});
		}
	}

	function makeDownloadCountsControl(userCtx){
		const div = newEl('div').css({padding:"2px",border:"thin solid green"});
		function updateUi() {
			const {data} = userCtx;
			div.innerText = `↓ ${data.downloadsInLastYear}`;
			const byYear = Object.entries(data.byYear).sort(byDesc(x=>x[0])).map(x=>x[0]+':'+x[1]);
			if( byYear.length > 0)
				div.setAttribute('title',byYear.join(' '));
		}
		updateUi();
		userCtx.on( 'imageDownloaded', updateUi );
		return div;
	}
	
	class ProgressBar{ // ui element
		constructor(container,initialColor='#aaf',finalColor='#ccf'){
			const $container = newEl(container).css({'position':'relative'});
			this.initialColor = initialColor; this.finalColor=finalColor;

			const css = {
				position:'absolute', top:'0', 
				height:"16px",width:'100%',
				'text-align':'right', 'vertical-align':'middle',
				padding:'1px 4px',
				'font-family':'Verdana','font-size':'10px',
				'white-space':'nowrap',
				display:'none',

				left:'-'+$container.style['left-margin'],
				margin:$container.style['margin']
			};

			this.progressDiv = newEl('div').appendTo($container).css(css);
		}
		set text(value){ this.progressDiv.innerText = value; }
		set percent(pct){ // 0..100
			const fc=this.finalColor,ic=this.initialColor;
			this.progressDiv.css({'background-image':`repeating-linear-gradient(to right, ${fc}, ${fc} ${pct}%, ${ic} ${pct}%, ${ic})`,'display':'block'});
		}
		close(){ this.progressDiv.remove(); }
	}

	// displays generic progress-object on a ProgressBar using custom text and % complete bar
	class ProgressMonitor{
		constructor(bar,textFormatter){
			this._bar = bar;
			this._textFormatter = textFormatter;
		}
		monitorImageModel(imageModel){
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
						const {loaded,total} = downloadProgress;
						this._progress({loaded,total}); 
						break;
					default: console.log('well this is akward...'); break;
				}
			});
		}
		_progress({loaded,total,error}){
			this._bar.percent = ProgressMonitor.progressToPercent({loaded,total});
			this._bar.text = this._textFormatter({loaded,total});
			if(loaded == total || error)
				this._bar.close();
		}
		static progressToPercent({loaded,total}) { 
			return Math.floor((loaded/total*100)+0.5);
		}
	}

	// ===== ::ScanNewImagesMenu =====
	class ScanNewImagesMenu{
		constructor(div,userAccess){ 
			this.div = div;
			this._setUsersByStar(userAccess);
		}

		_setUsersByStar( userAccess ){
			this._userAccess = userAccess;

			this.div.innerHtml='';
			addStyleSheet('.scanButton{cursor:pointer;} .scanButton:hover{border: thin dashed gray;}');

			this._readySpan = newEl('span').addClass('scanButton').on('click',()=>this.scanReadyAsync()).appendTo(this.div);
			newEl('span').setText(' / ').appendTo(this.div);
			this._newImagesSpan = newEl('span').addClass('scanButton').on('click',()=>this._showNewImages()).appendTo(this.div);

			this._refreshReadyCount();
			this._refreshNewImageCount();
		}

		_refreshReadyCount(){
			this._readyToScanUsers = this._userAccess.allUsers.filter( user=>user.isDueToScanNewImages );
			this._readySpan.innerText = 'due:'+this._readyToScanUsers.length;
		}

		_refreshNewImageCount(){
			const dayWaitMap = [,,7,2,1,0];
			const now = storageTime.now();

			function displayNewImages(user){
				const imgs = user.newImages;
				return imgs.length>=4
					|| Math.min(...imgs.map(x=>x.uploadDate)) < now;
			}
			this._newImageUsers = this._userAccess.newImageUsers
				.filter( displayNewImages );
			this._displayNewImageCount();
		}
		_displayNewImageCount(){
			this._newImagesSpan.innerText='images:'+this._newImageUsers.length;
		}
		async scanReadyAsync(){
			const numToScan = 100;
			const toScan = this._readyToScanUsers
				.sort(by(user=>user.data.viewDate))
				.slice(0,numToScan); // only scan 200 oldest
			const unexecutedPromiseGenerators = toScan
				.map( user => ( ()=>user.scanForNewImagesAsync() ) );

			const monitor = new ProgressMonitor( new ProgressBar(this._readySpan), ({loaded,total})=>loaded+' of '+total );
			try{
				await executePromisesInParallelAsync( unexecutedPromiseGenerators, 1, (x)=>monitor._progress(x) );
			} catch(err){
				console.log(err);
			}
			this._refreshReadyCount();
			this._refreshNewImageCount();
		}

		_clearNewImages(username){
			this._userAccess.get(username).clearNewImages();
			this._newImageUsers = this._newImageUsers.filter(user=>user.username != username);
			this._displayNewImageCount();
		}

		_showNewImages(){
			const pageSize=25,allowOverflow=5;
			const users = this._newImageUsers;
			const countOnPage = users.length%pageSize; 
			const take = countOnPage < allowOverflow ? countOnPage + pageSize : countOnPage;

			const self = this;

			gallery.rows = users
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
		}

	}

	/// ::User Status (following,ignore,etc)
	function makeUserStatusControl(userCtx){
		return newSelect()
			.on('click', function(){ userCtx.status = this.value; } )
			.chain(x=>{
				Object.entries(UserStatus)
					.filter(([,value])=>value!=UserStatus.failed)
					.forEach(([text,value])=>x.addOption(newOption(text,value)));
				x.value = userCtx.status;
			});
	}

	class ImageThumbControl{ // single image
		constructor(imgProps,container){

			const boxSize = 250;
			this.model = imgProps;

			const imgDate = this.model.imgDate;

			const bgColor = (() => {
				if(this.model.videoUrl) return colors.video;
				if(storageTime.now()-storageTime.toNum(imgDate) > 365 * storageTime.DAYS) return colors.old;
				return colors.forMonth[imgDate.getMonth()];
			})();
			const containerCss = { width:boxSize+'px',	display:'inline-block','text-align':'center',margin:'5px',position:'relative',background:bgColor };
			const markCss = {'cursor':'pointer','color':'white', 'padding-left':'5px'};
			const imageSizeCss = {'font-size':'10px','font-weight':'bold','margin-right':'5px',color:colors.attribute};
			const dateCss = {color:colors.attribute}
			this._imgProps = imgProps;

			this.img = newEl('img')
				.css((imgProps.height > imgProps.width) ? {'height':boxSize+'px'} : {'width':boxSize+"px"})
				.attr('data-src',imgProps.getResponsiveLink(boxSize));
			// wrapper
			function makeDateString(x){ return (x===null) ? 'N/A' : formatDate.YMD( storageTime.toDate(x)); }
			this._wrapperDiv = newEl('div').appendTo(container).css(containerCss);

			this._wrapperDiv.append(
				newEl('a')
					.attr('href',this.model.url)
					.on('click',(event)=>this.onClick(event))
					.chain(l=>l.appendChild(this.img)),
				newEl('br'),
				// metadata caption
				newEl('span').css(imageSizeCss).setText(imgProps.width+' x '+imgProps.height),
				newEl('span').css(dateCss).attr('title','Taken: '+makeDateString(imgProps.captureDate))
					.setText( makeDateString(imgProps.uploadDate) )
			);

			if(this.model.downloadProgress.status=='complete')
				this._showCheckmark();

		}
		loadAsync(){ // load image
			return new Promise((resolve,reject)=>{
				const retrySuffix = this.failures ? ('f='+this.failures) : '';
				const timerId = setTimeout(function(){reject("timeout");}, 5000);
				this.img
					.on('load',() => { delete this.failures; resolve(); clearTimeout(timerId); })
					.on('error',(err)=>{ this.failures = (this.failures || 0)+1; reject(); clearTimeout(timerId); })
					.attr('src',this.img.getAttribute('data-src') + retrySuffix );
			});
		}
		onClick(event){
			event.preventDefault();
			this.download();
		}
		async download(){

			// displays file-download progress on a ProgressBar
			const monitor = new ProgressMonitor( 
				new ProgressBar(this._wrapperDiv), 
				({loaded,total})=>Math.floor(loaded/1000+0.5)+' of '+Math.floor(total/1000+0.5)+'KB'
			);
			monitor.monitorImageModel(this.model);

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
			newEl('span').setText('✓')
				.css({position:'absolute',top:'0',right:'10px',display:'inline-block','background-color':'white',border:'thin solid black',padding:'3px'})
				.appendTo(this._wrapperDiv);
		}
	}

	class Importer{
		constructor($import){

			const importFileAsync = async (file,key) => {
				localStorage[key] = await this.readFileAsync(file);
				console.log(`${key} loaded from file.`);
			}

			$import.on('change',function(evt) {
				for(const file of this.files){
					switch(file.name){
						case 'localStorage.users.json': importFileAsync(file,'users'); break;
						case 'localStorage.graph.json': importFileAsync(file,'graph'); break;
						case 'localStorage.common.csv': importFileAsync(file,'common'); break;
						default: alert('Unexpected file: '+file.name ); break;
					}
				}
			})
		}
		readFileAsync(file) {
			return new Promise((resolve,reject)=>{
				var reader = new FileReader();
				reader.onload = () => resolve( reader.result );
				reader.onerror = (error) => reject( error );
				reader.readAsText(file);
			})
		}
	}

	// =====  Begin: Services  =====
	// =====  Begin: Services  =====
	// =====  Begin: Services  =====

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
		get pageOwner(){ return (unsafeWindow.location.href.match(/(?<=vsco.co\/).*(?=\/gallery)/)||[])[0]; }

		// Higher level
		needsReview(){
			const pageOwner = this.pageOwner;
			const users = this.allUsers
				.filter(user=>user.username!=pageOwner && user.data.status==UserStatus.shouldReview);
			function rnd(i){ return Math.floor(Math.random() * i); }
			return new NextLink({
				label:'for review',
				count: users.length,
				tooltip: 'These pages have not yet been evaluated to keep or ignore.',
				nextUrl: users.length ? users[rnd(users.length)].fetch.galleryUrl : undefined
			})
		}
		missingViewDate(sortLongestOutageFirst=false){
			// this.repo.sync(); // save viewDate before we scan
			const pageOwner = this.pageOwner;
			// !!! TODO - go through SyncedPersistentDict, !DON'T access localStorage.users directly
			const users = Object.entries(JSON.parse(localStorage.users||'{}'))
				.filter(([u,v])=>2<=v.stars&&v.stars<=5 // 1 is 'ignored'
						&& v.viewDate==undefined
						&& u != pageOwner // this may be called before current .viewDate is set.
					)
				.map(x=>new LastYear(x))
				.sort(sortLongestOutageFirst
					? by(x=>x.lastYear).thenBy(x=>x.lastCount)
					: byDesc(x=>x.lastYear).thenByDesc(x=>x.lastCount)
				);
			return new NextLink({
				label: 'missing view-date',
				count: users.length,
				tooltip: 'No view-date recorded.',
				nextUrl: users.length ? `/${users[0].username}/gallery` : undefined,
			});
		}
		toPrune(yearsWithoutDownload=4){
			const pageOwner = this.pageOwner;
			const earliestEmptyYear = new Date().getFullYear() - yearsWithoutDownload;
			const toPrune = Object.entries(JSON.parse(localStorage.users||'{}'))
				.filter(([u,v])=>2<=v.stars&&v.stars<=5 // 1 is 'ignored'
					&& v.viewDate !== undefined // was viewed
					&& u != pageOwner // this may be called before current .viewDate is set.
				)
				.map(x=>new LastYear(x))
				.filter( ({lastYear}) => lastYear<earliestEmptyYear )
				.sort(by(x=>x.lastYear).thenBy(x=>x.lastCount).thenBy(x=>x.username));
			return new NextLink({
				label:'to prune',
				count:toPrune.length,
				tooltip:`No downloads in last ${yearsWithoutDownload} years.`,
				nextUrl:toPrune.length ? `/${toPrune[0].username}/gallery` : undefined
			});
		}
	}

	class UserCtx {
		constructor(username,userAccess){
			this.username = username;
			this._access = userAccess; // class: UserAccess
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
		open(){ 
			this.save();
			this._access.repo.sync(); // flush 'save' before we open the next page.
			window.open(this.fetch.galleryUrl, '_blank');
		}
		mask(){ this._access.commonRepo.add(this.username); console.log(`${this.username} masked!`); }

		// status
		get status(){ return this.data.status; }
		set status(status){ 
			// when we follow someone, assume everything has been viewed.
			if(status=='following')
				this._update( data => data._info.viewDate = storageTime.now() )
			return this._update( data => data.status=status);
		}

		// Counts
		logDownloadImage(imgProps){
			const imageYear = storageTime.toDate(imgProps.captureDate||imgProps.uploadDate).getFullYear();
			this._update( data=>{ data.trackImage( imageYear ); } );
			this.trigger('imageDownloaded');
		}

		get isPageOwner(){ return this._access.pageOwner == this.username; }

		// ui items
		rename(newName){ this._access.repo.rename(this.username,newName); this.username=newName; }

		get fetch(){ return new Fetcher(this.username, this.isPageOwner ); }

		async scanForNewImagesAsync(){

			await new Promise(resolve => setTimeout(resolve, 300)); // rate-limit - do 100/minute

			try{
				const newImages = await this._fetchNewImagesAsync();
				this._update( data=>data.setViewDateAsCurrent() );
				if(newImages.length>0)
					this._access.newImageRepo.update(this.username,newImageGroup=>{
						newImages.forEach( img => newImageGroup[img.responsiveUrl]=img ); // adds each image to the group
					});
			} catch( error ){
				console.log('Failed to load '+this.username);
				console.error(error);
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

		get isDueToScanNewImages(){ 
			const {data} = this;
			if( data.status!=UserStatus.following && data.status!=UserStatus.failed) return false;
			const effectiveDownloadsInLastYear = data.downloadsInLastYear || 1;
			const daysBetweenScans = Math.max( 5, 365/effectiveDownloadsInLastYear*0.6); // 60% of wait duration
			const nextScanTime = Math.floor( daysBetweenScans*storageTime.DAYS ) + data._info.viewDate;
			return nextScanTime < storageTime.now();
		}

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
			this.percentYearLeft = (storageTime.toNum(startNext)-storageTime.toNum(pageLoadDate)) / (365*storageTime.DAYS);
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
			return [ formatDate.YMD( storageTime.toDate(failure.first)), failure.count, this.username, this.status].join('\t');
		}

		// Write / Modify
		set status(value){ this._info.stars = convert.toStars(value); }
		loadFailed(){
			if(this._info.hasOwnProperty('failure')) this._info.failure.count++;
			else this._info.failure = {count:1,first:storageTime.now()};
		}

		setViewDateAsCurrent(){
			// Save the old View Date in case we got logged out and are only scanning 8 images
			const oldViewDates = JSON.parse(sessionStorage["oldViewDates"]||"{}");
			oldViewDates[this.username] = this._info.viewDate;
			sessionStorage["oldViewDates"] = JSON.stringify(oldViewDates,null,'\t');

			this._info.viewDate = storageTime.now();
			delete this._info.failure;
		}
		static _lastYearTracker = new LastYearTracker();
	}

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

			const firstPageWithUsernameArray = await fetchFirstPageOfEachUserAsync( newUsers ); // array of {user,images}
			firstPageWithUsernameArray.sort(byDesc(x=>x.images.length).thenBy(x=>x.user.username));

			gallery.rows = firstPageWithUsernameArray
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
		}

		async _scanAndSaveToCache(){
			const collectionImages = await this._fetcher.fetchCollectionImages();
			const linkedUsers = collectionImages.map(i=>i.owner)
				.filter(onlyUnique)
				.filter(u=>!this._access.commonRepo.includes(u)); // exclude anything in the commonRepo
			console.log(`Collection scan of [${this.username}] found ${linkedUsers.length} links.`); // log
			this._access.linkRepo.update(this.username,arr=>{ arr.length=0; arr.push(...linkedUsers.sort()); });
			return linkedUsers;
		}
		_listUsers(usernames){
			const x = usernames.map(u=>this._access.get(u)).sort(by(u=>u.status)).map(user=>user.username+'\t'+user.status);
			console.log(x.join('\r\n'));
		}
	}

	class Fetcher {
		constructor(username,useDocumentBody){
			this.username = username;
			this._useDocumentBody = useDocumentBody;
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
				console.log('links...',pageNum,imgs.length,imgs.length==maxImagesPerPage);
			} while(imgs.length==maxImagesPerPage);
			return allImages;
		}

		async fetchFirstPageImages(){ // return them as an array
			const html = await this._fetchGalleryPageHtml();
			return Fetcher._getPageImages( html );
		}

		// returns ImageModel objects
		async * fetchGalleryImagesAsync(){
			const startingHtml = await this._fetchGalleryPageHtml();
			const preloadedState = Fetcher.extractPreloadedStateFromHtml(startingHtml);
			const { users:{currentUser:{tkn:token}}, medias:{bySiteId:siteMedias} } = preloadedState;
			const [firstSitePair] = Object.entries(siteMedias);
			if(!firstSitePair) return;

			const [siteId,siteMedia] = firstSitePair;
			const result = Fetcher.extractImagesFromPreloadedState(preloadedState).sort(byDesc(x=>x.uploadDate));
			for(let img of result)
				yield img;

			let nextCursor = siteMedia.nextCursor;
			while(nextCursor){

				let response = await fetch(
					'https://vsco.co/api/3.0/medias/profile?'+new URLSearchParams({site_id:siteId,limit:14,show_only:0,cursor:nextCursor}).toString(),
					{headers:{"Authorization":"Bearer "+token}}
				);

				let json = await response.clone().json(); // ??? can we remove the .clone() ?
				let newImgs = json.media
					.map(({image:i}) => new ImageModel({
						owner : i.perma_subdomain,
						height : i.height,
						width : i.width,
						responsiveUrl : i.responsive_url,
						captureDate : storageTime.toNum(i.capture_date),
						uploadDate : storageTime.toNum(i.upload_date),
					}))
					.sort(byDesc(x=>x.uploadDate));
				// json.media.forEach(x=>{ if(x.image.responsive_url.includes('62b262bb4dac692d146dbab9')){ console.log(123,x); } })

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
				: await (await fetch( this.galleryUrl )).text();
		}

		async _fetchCollectionPageHtml(pageNum){
			const resp = await fetch( this.collectionUrl(pageNum) );
			return await resp.text();
		}

		async _fetchCollectionImagesOnPage(pageNum){
			return Fetcher._getPageImages( await this._fetchCollectionPageHtml(pageNum) );
		}

		static extractPreloadedStateFromHtml(html){
			let json = Fetcher.findStringBetween(html,'window.__PRELOADED_STATE__ = ','</script>'); // because string.match(regex) does not match unicode characters!
			if(json == null){ console.debug('Unable to find preloaded state in:',html); throw 'no preloaded state found'; }
			json = json.replaceAll(":undefined",":null");
			return JSON.parse(json);
		}
		static findStringBetween(src,prefix,suffix){
			let startIndex = src.indexOf(prefix)+prefix.length;
			if(startIndex==-1) return null;
			let endIndex = src.indexOf(suffix,startIndex);
			if(endIndex==-1) return null;
			return src.substring(startIndex,endIndex);
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
						captureDate: storageTime.toNum(img.captureDate),
						uploadDate: storageTime.toNum(img.uploadDate)
					}));
			let videos = preloadedState.entities.videos;
			return images;
		}

	}

	function scrollToTop(){document.body.scrollTop = document.documentElement.scrollTop = 0;}

	async function fetchFirstPageOfEachUserAsync(users){ // !! this might be more link-related than fetch-related
		let userImages = [];
		var threads = users.map(function(user){
			return () => user.fetch.fetchFirstPageImages()
				.then( images => userImages.push({ user, images }) );
		});
		await executePromisesInParallelAsync(threads)
		return userImages;
	}

	class NextLink{ 
		label; nextUrl; count;
		constructor({label,nextUrl,count,tooltip}){
			Object.assign(this,{label,nextUrl,count,tooltip});
		}
		goto(){
			const {label,count,nextUrl} = this, msg = `${label}: ${count}`;
			console.print(msg);
			saveNotification(msg);
			if(nextUrl)
				setTimeout(()=>window.location.href=nextUrl,2000);
		}
		// UI stuff
		appendTo(host){
			const {label,nextUrl,count,tooltip} = this;
			if(!nextUrl) return;
			newEl('div')
				.setText(`${label}: ${count}`)
				.attr('title',tooltip)
				.css({'text-decoration':'underline','cursor':'pointer','font-size':'12px'})
				.on('click',() => document.location.href = nextUrl )
				.appendTo(host)
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

	for(let msg of getNotifications()) console.print(`%c${msg}`,consoleCss.msg)
	sessionStorage.msgs = '';

	class LastYear{
		constructor([username,rawData]){
			this.username = username;
			this.lastYear = LastYear.calcLastYear(rawData,1980);
			this.lastCount = this.lastYear==1980 ? 0 : rawData.dl[this.lastYear];
			this.viewDate = rawData.viewDate;
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

	function saveTextToFile({text,filename}){
		const a = document.createElement("a");
		a.href = URL.createObjectURL(new Blob([text])); // old way that doesn't handle '#' a.href = "data:text,"+text;
		a.download = filename;
		a.click();
	}

	// Services / repositories / models
	const userAccess = new UserAccess();
	const loadTimeNum = storageTime.now();
	const gallery = new Gallery();

	// UI / Views - general
	const uiLayout = new Layout( userAccess, gallery );

	const keyPressActions = {
		"79": /* o */ () => gallery.openLast(),
		"88": /* x */ () => gallery.closeFirst(),
		"36": /* home */ () => scrollToTop(),
		"85": /* u */ function({ctrlKey,shiftKey}){ // Save Users
			if(ctrlKey && shiftKey){
				const filename = `vsco.localStorage.users ${formatDate.forFilename(new Date())}.json`;
				saveTextToFile({text:localStorage.users,filename});
				console.log("localStorage.users save to "+filename);
			}
		}
	};
	unsafeWindow.addEventListener('keydown',function({which,repeat,ctrlKey,altKey,shiftKey}){
		if(!repeat)
			(keyPressActions[which] || (() => console.debug('which',which)))({ctrlKey,shiftKey});
	});

	// ::unsafeWindow
	unsafeWindow.users = userAccess;
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
		owner: document.location.href.match(/vsco.com?.([^\/]+)/)[1],
		missingViewDate: function(sortLongestOutageFirst=false){
			userAccess.missingViewDate( sortLongestOutageFirst ).goto();
		},
		nextToPrune: function(yearsWithoutDownload=4){
			userAccess.toPrune( yearsWithoutDownload ).goto();
		},
		downloads: []
	}

	// Removes Google Ad
	setInterval(function(){
		[...document.querySelectorAll("ins[data-google-query-id]")]
			.forEach(x=>x.remove());
	},5000);

	function addCopyUsernameUiElement(){
		// !! Sometimes the matching element is inside a tree that is hidden so maybe we should put it someplace else.
		// !! sometimes the element does not contain the Page owner, but some other name.
		const pageOwner = userAccess.pageOwner;
		function addCopyElInterval(){
			const markerClass = 'name-copy-marker';
			const els = [...document.querySelectorAll('h1.css-1u3pn9l.e19mt3zn0')].filter(x=>!x.classList.contains(markerClass));
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

	// -----  Init User  -----
	const matchesUser = unsafeWindow.location.href.match(/(?<=vsco.com?\/).*(?=\/gallery)/);
	if(matchesUser){
		// Current User
		const currentUser = userAccess.get( userAccess.pageOwner );
		const calendar = new CalendarModel( currentUser );
		const startingState = structuredClone(currentUser.data._info);

		// UI / view - currentUser
		uiLayout.showCurrentUser(currentUser, calendar);

		addCopyUsernameUiElement();

		Object.assign(keyPressActions,{
			"37": /*left*/ () => calendar.prev(),
			"39": /*right*/ () => calendar.next(),
			// "38": /*up*/ break;
			// "40": /*down*/ break;
		});

		// Init page - assume we have a user
		function logStartingState(){ console.print('starting state => %c'+JSON.stringify(startingState,null,'\t'),'color:blue;'); }
		(async function(){
			switch( currentUser.status ){
				case UserStatus.new:
				case UserStatus.shouldReview:
					logStartingState();
					// show First Page
					const firstPageImages = await currentUser.fetch.fetchFirstPageImages();
					if(firstPageImages.length>0){
						const imageRow = new ImageRowModel({ 
							labelText: 'galley page-1 images',
							images:firstPageImages
						});
						gallery.rows = [imageRow];
					}
					calendar.loadAsync();
					break;

				case UserStatus.following:
					logStartingState();
					// Show New Images !
					if(startingState.viewDate===undefined){
						console.print('%cNo View Date found',consoleCss.important);
						const lastYear = Object.keys(startingState.dl).reverse()[0]||storageTime.toDate(loadTimeNum).getYear();
						console.print(`Downloads for ${lastYear}: %c${startingState.dl[lastYear]}`,consoleCss.downloadCount);
						calendar.loadAsync();
					} else {
						// Check if user should be pruned
						const lastYearInfo = new LastYear([userAccess.pageOwner,startingState]);
						const earliestEmptyYear = new Date().getFullYear() - 4;
						if( lastYearInfo.lastYear<earliestEmptyYear ){
							uiLayout.appendButton(newEl('button').setText('Prune').on('click',function(){
								userAccess.repo.remove(userAccess.pageOwner);
								console.print(`[${userAccess.pageOwner}] pruned`);
								this.remove();
							}));
							calendar.loadAsync();
						}
					}

					await currentUser.scanForNewImagesAsync(); // Sets the View Date which we NEED

					if(currentUser.newImages.length>0){
						const newImagesRow = new ImageRowModel({ labelText : 'new images', images:currentUser.newImages })
						gallery.rows = [newImagesRow];
						currentUser.clearNewImages();
					}
					break;

				case UserStatus.ignore:
					logStartingState();
					console.print(`%cstatus=Ignored`,consoleCss.important);
					break;

				case UserStatus.failed:
					logStartingState();
					console.print(`%cstatus=Failed`,consoleCss.important);
					break;

				default:
					logStartingState();
					console.print(`%cUnknown status [${currentUser.status}]`,'color:#F88;background-color:black;');
					break;
			}

		})();

		unsafeWindow.user = currentUser;
		CMD.user = currentUser;
	}

})();

// Counts: 1: 2284 > ignore, 2: 1842, 3: 4853 > follow, 4: 372, 5: 151, null > 59, undefined > 681
// TODO:
// Surface # of failures and make easy to resolve.
// determine where null and undefined scores came from, and get rid of them
	// Maybe undefined, the status never got set and null were set to 'new'?
	// Should we merge null/undefined/ignore(score=1) ?

// == How To ==
// delete/remove the current user:   users.repo.remove(cmd.owner)