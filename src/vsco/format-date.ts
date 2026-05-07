type dp = (date:Date) => string | number;

type Digit = "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9";
export type MonthStr = "01"|"02"|"03"|"04"|"05"|"06"|"07"|"08"|"09"|"10"|"11"|"12";
type Century = '20';
export type YearStr = `${Century}${Digit}${Digit}`;
export type YYYYMM = `${YearStr}-${MonthStr}`;


export const formatDate = (function(){
	function pad(i:number):string{ return (i<10?'0':'')+i; }
	const y:dp=x=>x.getFullYear(), m:dp=x=>pad(x.getMonth()+1), d:dp=x=>pad(x.getDate());
	const h:dp=x=>pad(x.getHours()), n:dp=x=>pad(x.getMinutes()), s:dp=x=>pad(x.getSeconds());
	return {
		YMD :         (x:Date):string => `${y(x)}-${m(x)}-${d(x)}`, // img caption, failure date
		YM :          (x:Date):YYYYMM => `${y(x)}-${m(x)}` as YYYYMM, // grouping images by month
		forFilename : (x:Date):string => [y(x),m(x),d(x),h(x),n(x),s(x)].join(''),
	};
})();
