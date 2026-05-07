import { HotkeyManager } from "~/lib/hotkey-manager";
import { EventHost, makeEventHost, MyEventSource, ObservableBase } from "~/lib/observable";
import { groupBy } from "~/lib/sorting";
import { formatDate, YearStr, YYYYMM } from "../format-date";
import { UserCtx } from "../user-ctx";
import { ImageModel } from "./image-model";
import { MonthModel } from "./month-model";
import { YearModel } from "./year-model";

type CalendarEvents = {
	monthAdded: [month: MonthModel];
	loadFailed: [error: unknown];
	loadCompleted: [];
};

// builds a calendar/gallery view-model for one user’s images
export class CalendarModel 
	extends ObservableBase<CalendarModel>
	implements MyEventSource<CalendarEvents> {

	public readonly title: string; // read by view
	public byYear: Partial<Record<YearStr,YearModel>> = {}; // read by view

	public isLoading:boolean = false; // observable
	public selectedMonths: MonthModel[] = []; // observable

	public on!: EventHost<CalendarEvents>["on"];
	private trigger!: EventHost<CalendarEvents>["trigger"]; // !!! make private

	private readonly _user: UserCtx;
	private _byMonth: Partial<Record<YYYYMM,MonthModel>> = {}; // keyed on yearMonth
	private _sortedMonthKeys: YYYYMM[] = [];
	private _monthCount: number = 0;
	private _focusMonth?: MonthModel;
	private _focusYear?: YearModel;

	constructor( user: UserCtx ){
		super();
		makeEventHost<CalendarModel, CalendarEvents>(this);
		this._user = user;
		this.title = user.username;
	}

	registerHotkeys(hotkeys:HotkeyManager){
		hotkeys.register("ArrowLeft", () => this.prev());
		hotkeys.register("ArrowRight", () => this.next());
		// ArrowUp & ArrrowDown => calendar: Up/Down
	}

	async loadAsync2(){

		this.isLoading = true;  // observable

		const imageStream = this._user.fetch.fetchGalleryImagesAsync() as AsyncIterable<ImageModel>;
		const allImages: ImageModel[] = await Array.fromAsync( imageStream );

		// group images by Month and build a Month Model
		// byMonth = {'2010-06':ImageModel[], '2010-06':ImageModel[]}
		const groups: Record<YYYYMM,ImageModel[]> = groupBy(allImages, img => 
			formatDate.YM( new Date(img.uploadDateMs) )
		);
		this._byMonth ={};
		for (const [yearMonth, images] of Object.entries(groups) as [YYYYMM, ImageModel[]][]) {
			const mm = new MonthModel(yearMonth, images);
			mm.listen("hasFocus", x => this._syncFocusMonth(x));
			this._byMonth[yearMonth] = mm;
		}
		this._sortedMonthKeys = Object.keys(this._byMonth).sort() as YYYYMM[];
		this._monthCount = this._sortedMonthKeys.length;

		let monthsByYear = groupBy( Object.keys(this._byMonth), x=>x.split('-')[0]! ); // grouped by year
		this.byYear = {};
		for(let year in monthsByYear){
			const ym = new YearModel(year as YearStr);
			ym.loadMonths(this._byMonth);
			ym.listen('hasFocus',({host,newValue:hasFocus}) => {
				if(!hasFocus) return;
				this._blurFocusYear();
				this._focusYear = host;
				this._selectMonths(host.months);
			} )
			this.byYear[year as YearStr] = ym;
		}

		this.isLoading = false; // observable

	}

	async loadAsync() {
		try{
			this.isLoading = true;

			let currentYearMonth: YYYYMM | undefined;
			let currentImages: ImageModel[] = [];

			const flushMonth = () => {
				if (currentYearMonth === undefined || currentImages.length === 0) return;

				// create new month model
				const month = new MonthModel(currentYearMonth, currentImages);
				month.listen("hasFocus", (x) => this._syncFocusMonth(x));

				// add to month-lookup
				this._byMonth[currentYearMonth] = month;
				this._sortedMonthKeys.push(currentYearMonth); // currently reverse order

				// create new year
				const year = currentYearMonth.slice(0,4) as YearStr;
				let yearModel = this.byYear[year];
				if (yearModel === undefined) {
					yearModel = new YearModel(year);
					yearModel.listen("hasFocus", (x)=>this._syncFocusYear(x));
					this.byYear[year] = yearModel;
				}
				// add to year
				yearModel.months.push(month);

				currentImages = [];

				this.trigger("monthAdded", month);
			};

			const imageStream = this._user.fetch.fetchGalleryImagesAsync() as AsyncIterable<ImageModel>;

			for await (const image of imageStream) {
				const imageYearMonth = formatDate.YM(new Date(image.uploadDateMs));

				if (currentYearMonth !== undefined && imageYearMonth !== currentYearMonth)
					flushMonth();

				currentYearMonth = imageYearMonth;
				currentImages.push(image);
			}

			flushMonth();

			this._monthCount = this._sortedMonthKeys.length;
		} catch( error ){
			console.log(error);
		} finally {
			this._sortedMonthKeys.sort();
			this.isLoading = false;
		}
	}

	selectAll(){ this._selectMonthByKeyFilter( () => true, true ); }

	selectYear(year:string){ 
		this._selectMonthByKeyFilter( (k:string)=>k.startsWith(year) );
	}

	selectMonthOfEveryYear( month: number ){
		const monthStr = (month<10?'0':'') + month;
		this._selectMonthByKeyFilter( (k:string)=>k.endsWith(monthStr), true );
	}

	_selectMonthByKeyFilter(keyFilter:(x:string)=>boolean,reverse=false){ 
		const months = this._sortedMonthKeys.filter(keyFilter).map((k:YYYYMM)=>this._byMonth[k]!)
		if(reverse) months.reverse();
		this._selectMonths(months); 
	}

	_selectMonths(months:MonthModel[]){
		this._blurFocusMonth();
		this._focusMonth = undefined;
		for(let mm of months) mm.hasFocus = false; // hack - show it as visited
		this.selectedMonths = months;
	}

	prev(){
		const oldFocusIndex = (this._focusMonth === undefined)
			? this._monthCount
			: this._sortedMonthKeys.indexOf(this._focusMonth.yearMonth);
		this._setFocus( oldFocusIndex-1 );
	}

	next(){
		const oldFocusIndex = (this._focusMonth === undefined)
			? -1
			: this._sortedMonthKeys.indexOf(this._focusMonth.yearMonth);
		this._setFocus( oldFocusIndex+1 );
	}
	_setFocus( focusIndex: number ){
		if(focusIndex < 0 || this._monthCount <= focusIndex){
			console.log('off end');
			return;
		}
		const focusKey = this._sortedMonthKeys[focusIndex]!;
		this._byMonth[ focusKey ]!.hasFocus = true;
	}
	// called by listener when hasFocus is changed.
	private _syncFocusMonth({host,newValue:hasFocus}:{host:MonthModel,newValue:boolean|undefined}){
		if(!hasFocus) return;
		this._blurFocusMonth();
		this._focusMonth = host;
		this.selectedMonths = [host];
	}
	private _syncFocusYear({host, newValue: hasFocus}:{host:YearModel,newValue:boolean}){
		if (!hasFocus) return;
		this._blurFocusYear();
		this._focusYear = host;
		this._selectMonths(host.months);
	}
	private _blurFocusMonth(){
		if(this._focusMonth != null)
			this._focusMonth.hasFocus = false;
	}
	private _blurFocusYear(){
		if(this._focusYear !== undefined)
			this._focusYear.hasFocus = false;
	}
}
