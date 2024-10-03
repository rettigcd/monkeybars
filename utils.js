// -----------------------------------
// ---- Snooping on HTTP Requests ----
// -----------------------------------

function throwExp(msg){ console.trace(); throw msg; } // C# throw expression

// ================
// ===== SORT =====
// ================
// Example usage: myArray.sort( byDesc( item=>item.h ).thenBy( item=>item.w ) )
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


// ==================
// Date / Time
// ==================
const mS = 1;
const SECONDS = 1000*mS;
const MINUTES = 60*SECONDS;
const HOURS = 60*MINUTES;
const DAYS = 24*HOURS;
const [WEEKS,MONTHS,YEARS] = [7*DAYS,30*DAYS,365*DAYS];

// =================
// DOM
// =================
// Promise that waits for element to become available, then returns it.
function querySelectorAsync(cssSelector,timeout=10000){
	return new Promise((resolve,reject)=>{
		const step = 500;
		const timerId = setInterval(function(){
			const el = document.querySelector(cssSelector);
			timeout -= step;
			if(0<timeout && el==null) return;
			if(el!=null) resolve(el); else reject(`timeout searching for ${cssSelector}`);
			clearInterval(timerId);
		},step);
	});
}


// ================
//  Console 
// ================

unsafeWindow.console.image = function(url, height = 100) {
	const image = new Image();
	image.crossOrigin='anonymous';
	image.onload = function() {
		// build a data url
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		canvas.height = height || image.naturalHeight;
		canvas.width = canvas.height * image.naturalWidth / image.naturalHeight;
		ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
		const dataUrl = canvas.toDataURL();
		const style = [
			'font-size: 1px;',
			`padding: ${canvas.height}px ${canvas.width}px;`,
			`background: url(${dataUrl}) no-repeat;`,
			'background-size: contain;'
		].join(' ');
		unsafeWindow.console.log('%c ', style);
	};
	image.src = url;
};

console.print = function (...args) { queueMicrotask (console.log.bind (console, ...args)); },
unsafeWindow.JSON.format = function(s){ return JSON.stringify(JSON.parse(s),null,'\t'); }

// const { get, set, update, createStore } = await import('https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm');
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import

console.debug('%cutils.js loaded','background-color:#DFD'); // Last line of file