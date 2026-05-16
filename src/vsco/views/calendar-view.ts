import { $, addStyleSheet, ElementBuilder } from "~/lib/dom3";
import { type YearStr } from "../format-date";
import { CalendarModel } from "../models/calendar-model";
import { MonthModel } from "../models/month-model";
import { YearModel } from "../models/year-model";
import { monthNames } from "../month-names";
import { css } from "./css";

export function scrollToTop(){document.body.scrollTop = document.documentElement.scrollTop = 0;}

export class CalendarView {

	public table: HTMLTableElement;
	public dataStatus: 'notLoaded' | 'hidden' | 'loading' | 'visible' = 'notLoaded';

	private iconTd: ElementBuilder<HTMLTableCellElement>;
	private topRow: ElementBuilder<HTMLTableRowElement>;
	private model: CalendarModel;
	private yearRows: Partial<Record<YearStr, HTMLTableRowElement>> = {};

	constructor( model:CalendarModel ){

		// bind model
		this.model = model;

		this.model.on("monthAdded", (month) => {
			this._addMonth(month);
		});

		model.listen('selectedMonths',() => { scrollToTop(); setTimeout(scrollToTop, 2000); });

		this.model.listen('isLoading',({newValue:isLoading}) => {
			if(isLoading){
				this.dataStatus = 'loading';
				this._showSpinner();
				this._ensureHeaderRow();
			} else {
				this.dataStatus = "visible";
				this._showCollapse();
			}
		})

		// build view
		addStyleSheet('@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }');

		// create table
		this.table = $('table').css({"fontSize":"10px","borderCollapse":"collapse"}).el;
		// top row
		this.topRow = $('tr').appendTo(this.table).on('click',()=>this._headerClick()).css({background:'#AAA'});
		$('td').attr('colspan','12').txt(model.title).appendTo( this.topRow.el )
			.css({width:'360px',height:'10px','textAlign':'center',color:'white',"fontWeight":"bold","fontSize":"14px"});
		this.iconTd = $('td').css({'textAlign':"center",'width':'30px'}).appendTo( this.topRow.el );
		this._showExpand();
	}

	private _ensureHeaderRow() {
		if (this.table.querySelector("tr.label")) return;
		$(makeHeaderRow(this.model)).appendTo(this.table);
	}

	private _headerClick(){
		switch(this.dataStatus){
			case 'hidden':  this._displayRows(true); this.dataStatus='visible'; this._showCollapse(); break;
			case 'visible': this._displayRows(false); this.dataStatus='hidden'; this._showExpand(); break;
			case 'loading': /* do nothing */ break;
			default: this.model.loadAsync(); break;
		}
	}
	private _displayRows(shouldDisplay:boolean){ 
		const display=shouldDisplay?"":"none"; 
		this.table.querySelectorAll<HTMLElement>('tr.year,tr.label').forEach(x=>x.style.display=display);
	}
	private _showSpinner(){ this.topRow.css({'cursor':'auto'}); this.iconTd.txt(''); $('div').appendTo( this.iconTd.el ).css(css.spinner);}
	private _showCollapse(){ this.topRow.css({'cursor':'pointer'}); this.iconTd.txt("➖"); } // 🔺➖
	private _showExpand(){ this.topRow.css({'cursor':'pointer'}); this.iconTd.txt("➕"); } // 🔻➕

	// receives months going from newest to oldest.
	private _addMonth(month: MonthModel) {
		const year = month.yearMonth.slice(0, 4) as YearStr;

		let yearRow = this.yearRows[year];

		if (yearRow === undefined) {
			const yearModel = this.model.byYear[year];
			if (yearModel === undefined) return;

			yearRow = this._makeEmptyYearRow(yearModel);
			this.yearRows[year] = yearRow;

			// append older years to the bottom
			this.table.appendChild(yearRow);
		}

		const monthIndex = month.base1Num; // base-1 skips year cell
		const monthCell = yearRow.querySelectorAll("td")[monthIndex];
		if (monthCell !== undefined)
			monthCell.replaceWith(makeMonthView(month));
	}

	private _makeEmptyYearRow(yearModel: YearModel) {
		const row = $("tr").addClass("year").el;

		$("td").txt(yearModel.year).appendTo(row)
			.on("click", () => yearModel.hasFocus = true)
			.css({
				width: "30px",
				padding: "2px",
				fontWeight: "bold",
				cursor: "pointer",
			});

		for (let i = 0; i < 12; i++)
			$(makeMonthView(undefined)).appendTo(row);

		return row;
	}

}

// Displays 1 month cell in the CalendarView
function makeMonthView(model:MonthModel|undefined) { // MonthModel
	const cellCss = {width: "30px", "padding":"2px","text-align":"center"};
	const focusCss = {'background':'lightgray', 'border':'2px solid red'};
	const blurCss  = {'background':'lightgray', 'border':'none'};
	const cell = $('td').css(cellCss);
	if( model ){
		cell.txt(String(model.images.length))
			.css({"cursor":"pointer"})
			.on('click',()=>{ model.hasFocus = true; });
		model
			.listen('hasFocus', ({newValue:hasFocus}) => {
				cell.css(hasFocus ? focusCss : blurCss);
			})
	}
	return cell.el;
}


function makeHeaderRow(calendarModel:CalendarModel){ // CalendarModel
	let row = $('tr').addClass('label').el;
	const headerCss = {
		cursor:'pointer',
		"font-weight":"bold",
		"text-align":"center",
		width:"30px",
	};
	$('td').appendTo(row).txt('*')
		.css(headerCss)
		.css({color:"black",'background':'white'})
		.on('click',()=>calendarModel.selectAll() ).el;
	monthNames
		.forEach((m,idx)=>$('td').appendTo(row).txt(m)
			.css(headerCss)
			.css(css.monthName(idx))
			.on('click', ()=>calendarModel.selectMonthOfEveryYear(idx+1))
			.el
		)
	return row;
}
