// ====================================
// Snippet for showing employees photos
// ====================================

// =========================
// ====  Generic Stuff  ====
// =========================

// Extend HTMLElement
const extend = (proto, methods, name = proto.constructor.name) => {
	for (const [prop, fn] of Object.entries(methods)) {
		if (prop in proto) throw new Error(`${name} already contains ${prop}`);
		Object.defineProperty(proto, prop, { value: fn, writable: true, configurable: true, enumerable: false });
	}
};

extend(HTMLElement.prototype, {
	css(style) { Object.assign(this.style, style); return this; },
	txt(value) { if(arguments.length === 0) return this.textContent; this.textContent = value; return this; },
	html(value) { if(arguments.length === 0) return this.innerHTML; this.innerHTML = value; return this; },
	prop(name, value) { if(arguments.length === 1) return this[name]; this[name] = value; return this; },
	attr(name, value) { if(arguments.length === 1) return this.getAttribute(name); this.setAttribute(name, value); return this; },
	cls(...names) { this.classList.add(...names); return this; },
	removeClass(name) { this.classList.remove(name); return this; },
	toggleClass(name, force) { this.classList.toggle(name, force); return this; },
	data(key, value) { if(arguments.length === 1) return this.dataset[key]; this.dataset[key] = value; return this; },
	on(eventName, handler, options) { this.addEventListener(eventName, handler, options); return this; },
	off(eventName, handler, options) { this.removeEventListener(eventName, handler, options); return this; },
	appendTo(host) { host.appendChild(this); return this; },
	withChildren(...children) { this.append(...children.flat(Infinity).filter(x => x != null)); return this; },
	do(action) { action(this); return this; },
});

const el = (x) => document.createElement(x);
const input = (type = "text") => el("input").attr("type", type);
const sel = () => el("select");
const opt = (text, value = text) => new Option(text, value);
const addStyleSheet = (cssText) => el("style").attr("type", "text/css").txt(cssText).appendTo(document.head);
const $q = (css) => document.querySelector(css);
const $qAll = (css) => [...document.querySelectorAll(css)];


// Loading Image - async
async function loadImageAsync(img,src,timeoutMs=500) {
	return new Promise((resolve, reject) => {
		const timerId = setTimeout(()=>reject('timeout'),timeoutMs);
		img.onload = () => { clearTimeout(timerId); resolve(img); }
		img.onerror = (err) => { clearTimeout(timerId); reject(err); }
		img.src = src;
	});
}

// Delay
async function delayAsync(ms){ return new Promise((resolve,reject)=>{ setTimeout(resolve,ms); }) }


async function downloadImageAsync(source, filename) {
	const url = (typeof source === "string") ? source
		: (source instanceof HTMLImageElement) ? (source.currentSrc || source.src)
		: (()=>{throw new Error("Unsupported image source.");})();

	filename ??= (function(url) {
		try { return new URL(url).pathname.split("/").pop(); } catch { return null; }
	})(url);

	// Fetch image as a blob to support cross-origin downloads
	const response = await fetch(url);
	if (!response.ok) throw new Error("Failed to fetch image");
	const blob = await response.blob();
	const objectUrl = URL.createObjectURL(blob);

	// Create a temporary download link
	const a = document.createElement("a");
	a.href = objectUrl;
	a.download = filename || "image";
	document.body.appendChild(a);
	a.click();

	// Cleanup
	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}

//=============================
//====  Employee-Specific  ====
//=============================

// quit: 38079, 44448, 65219, 66362, 67565, 72384, 73952, 74412, 75372, 76151

// Known IDs (non-missing)
const activeIds = [122,839,4569,6882,8465
	,12009,14146,14110,15733,15880,16353,16553,18724
	,20168,20605,20645,20737,21764,21665,22305,22173,22591,22376,22688,23095,23540,23666,23600,25533,25614,25987,27187,28990,29422
	,30712,31237,33034,33121,33577,33904,33913,34111,34377,34334,34753,34800,35205,35883,36054,36061,36261,36488,36482,36671,36790,36794,36809,36970,37038,37160,37539,38422,38707,38637,38722,39540
	,40103,40149,40191,40179,40174,40521,40908,40936,40962,40931,41359,41444,41896,41921,42042,42425,42443,42464,42659,42755,42967,43119,43741,43728,44036,44238,44242,44298,44425,44559,44621,45051,45228,45254,45666,45846,45914,45920,46083,46192,46222,46596,46883,46915,46975,47045,47098,47360,47927,48069,48042,48115,48245,48678,49263,49512,49857,49947
	,50141,50346,50552,50917,5702,51056,51171,51425,51642,52571,52796,53123,53280,54220,54800,54839,54913,54982,54983,55047,55123,55432,55733,55895,56138,56318,56512,56779,56802,56804,57125,57214,57167,57358,57404,57448,57686,57697,57723,57931,57940,58297,58499,58511,58542,58577,58600,58978,59183,59115,59591,59595,59729
	,60092,60267,60499,60505,60551,60594,60600,60865,60956,60965,60966,61102,61130,61154,61176,61187,61262,61414,61668,61800,62017,62226,62267,62362,62610,62878,63188,63605,63791,64092,64105,64400,64436,64545,64718,64723,64817,65016,65029,65099,65169,65397,65439,65794,65860,66154,66312,66364,66361,66395,66400,66510,66765,66867,66893,67354,67457,67501,67670,67660,67699,68021,68058,68133,68215,68503,68509,68693,68897,69012,69034,69173,69201,69243,69236,69251,69250,69280,69331,69394,69535,69604,69641,69727,69862,69865,69884,69888,69896,69911
	,70111,70183,70237,70295,70297,70301,70343,70401,70751,70803,70874,70881,70936,70994,71011,71300,71376,71400,71425,71489,71632,71674,71705,71790,71806,71842,71876,71920,71936,72137,72155,72157,72162,72193,72241,72256,72300,72306,72326,72398,72421,72445,72452,72493,72567,72658,72646,72705,72771,72830,72875,72956,72987,73007,73019,73123,73122,73162,73166,73217,73233,73280,73398,73389,73379,73358,73349,73449,73511,73537,73551,73558,73571,73579,73596,73599,73019,73600,73620,73622,73635,73714,73736,73745,73754,73770,73780,73778,73797,73850,73862,73911,73925,73924,73950,73959,73993,74000,74073,74086,74099,74103,74128,74168,74171,74197,74201,74202,74211,74278,74345,74356,74361,74383,74386,74452,74500,74501,74506,74541,74564,74596,74597,74626,74650,74657,74658,74825,74826,74834,74877,74897,74904,74913,74953,74975,74983,75014,75053,75224,75234,75253,75257,75301,75308,75335,75339,75362,75382,75445,75448,75449,75451,75455,75460,75470,75486,75497,75499,75502,75516,75544,75566,75567,75603,75635,75657,75688,75690,75691,75702,75756,75765,75799,75809,75814,75819,75847,75850,75867,75874,75893,75902,75908,75924,75944,75957,75971,76007,76011,76027,76052,76054,76072,76123,76132,76186,76189,76191,76206,76229,76261,76269,76290,76299,76309,76314,76406,76428,76479,76479,76511,76831,77247
];
// subset of activeIds that is at IVY01x location
const ivy2f3_marketing = [35205,47927,49947,51642,55047,61800,66154,69884,73537,839,37038,60551,70297,75635]; // IVY-Bld-2 / 3rd floor  (I L - Marketing)
const ivy2f3_it = [16353,36671,42425,48069,50346,59729,43110,72875]; // IVY-Bld-2 / 3rd floor  (G H J K - IT/Marketting)
const ivy1f4 = [25614,45254,57404,58499,58600,70111,74099]; // IVY-Bld-1 / 4th floor
const activeIvyIds = [20605,20645,21764,23095,25987,27187,33121,34753,35883,36488,36794,37160,39540,40103,40908,40936,40962,42443,42659,43119,44298,44425,45051,45846,46192,46222,46915,47098,48115,50141,5702,51171,52796,55123,55733,56138,57167,57686,58511,58577,60092,60267,60505,60594,60965,60966,62362,65169,65397,65794,66312,69012,69250,69394,70343,71876,72452,72567,72705,72771,72830,72956,73558,73599,73600,73620,73745,73850,73925,74073,74356,74500,74501,74506,74596,74626,74650,74658,74904,74975,75339,75362,75470,75497,75874,76027,76052,76299,76309,76831,77247
	,...ivy1f4,...ivy2f3_it,...ivy2f3_marketing
];
// IVY011 > Ivy, Floor 1
// IVY012 > Ivy, Floor 2
// IVY013 > Ivy, Floor 3
// IVY014 > Ivy, Floor 4

// ___Active___
// Morgan DeBell			44298	IVY011 / L20

// Mollie OBrien			28089	IVY013 / H5		513-833-3280
// Allison 'Allie' Hall		48069	IVY013 / H31	502-550-7554	***
// Emily Morgan				42425	IVY013 / H32	513-373-1659	***
// Sarah Bernstein			76808	IVY013 / H36	513-476-1149	**

// Laurin McNulty			72875	IVY013 / K1		440-420-2546	**

// Emily Ragle Gamble		49947	IVY013 / I12	513-504-3961	*	(Marketing)
// Kylie Develen			55047	IVY013 / I16	513-257-3198	**	(Marketing)

// Lauren Williams			76831	IVY013 / I13	513-882-6406	**		(Marketing-red head)
// Samantha Holloway		66154	IVY013 / I17	513-335-8064	****	(Marketing)
// Madeline Gregoire		47927	IVY013 / I19	440-384-7417	**		(Marketing)

// Delaney Senger			73537	IVY013 / I57	513-222-2899	*	(Marketing)

// Morgan Burleigh			60551	IVY013 / L9		859-414-4763		(tall)
// Olivia Montelisciani		27895	IVY013 / L7		859-414-1174		(tall-neigbor)
// Megan Owens				71876	IVY013 / C76	513-663-0613	**	(prospecting/end)

// Ali Jones				77247	IVY011 / Q67	937-838-8426		(Alejandra Jones Sanchez)
// Zoey Evans				77300	IVY012 / K83	513-491-8840
// Bailee Foster			57686	IVY012 / G69	513-904-1869	***** (Ivy 2 - floor 2)

// Sarah Rangel				18724	TAM040 / 0		813-373-3215	**

// ___Inactive___
// Sydney Baum			71902	Columbus		***
// Victorie Neeley		62411	Houston			***
// Cloey Deglopper 		66544	Grand Rapids	*
// Erica Barnhart		60468	Georgia			*
// Shelby Vetere 		72920	Fort Worth		
// Rachel Hales 		74284	Erlanger		
// Jalyn Vogt			57821	Cincinnati
// Lucia Miller			5831	SC020



const store = {
	saveGoodId: function(num){
		const key = 'goods';
		const goods = JSON.parse(localStorage[key]||'[]');
		goods.push(num);
		localStorage[key] = JSON.stringify([...new Set(goods)]);
		console.log('savenum',num,goods.length);
	},
	set maxEmployeeId(id){ localStorage['maxEmployeeId'] = id; },
	get maxEmployeeId(){ return (localStorage['maxEmployeeId'] || 0)-0; },
}

async function appendEmployeeAsync(id) {
	const { div, img } = buildEmployeeCard(id);

	div.appendTo(document.body);

	try {
		await loadImageAsync(img, `https://intranetapps.tql.com/api/photo/photos/${id}`);
	} catch (err) {
	}
}

function buildEmployeeCard(id) {
	const img = el("img").css({ width: "120px" })
		.on("click", async (e) => {
			store.saveGoodId(id);
			await downloadImageAsync(e.currentTarget);
			e.currentTarget.style.opacity = "0.4";
		});

	const divCss = {display: "inline-block",padding: "3px",border: "thin solid gray"}
	const div = el("div").attr("id", `emp_${id}`).cls("emp").data("id", String(id)).css(divCss)
		.withChildren(img);

	const addLine = (text) =>
		el("p")
			.txt(text ?? "")
			.css({ margin: "0px", padding: "1px" })
			.appendTo(div);

	addLine(`${id}`);

	const emp = globalThis.employeeData?.[id];
	if (emp) {
		addLine(emp.fullName);
		addLine(emp.location);
		addLine(emp.mobilePhone);
		addLine(emp.startDate?.slice(0, 10));

		if (emp.lastWorkDate && emp.lastWorkDate !== "1900-01-01T00:00:00")
			addLine(emp.lastWorkDate.slice(0, 10));
	}

	return { div, img };
}

function clearEmployees(){
	$qAll('div.emp').forEach(el=>el.remove())
}

async function showEmployeesByIdAsync(ids=null){
	ids=ids || activeIvyIds;
	clearEmployees();
	for(let i of ids){
		await appendEmployeeAsync(i);
		await delayAsync(500);
	}

}

async function scanEmployeesAsync(start,count=100){
	clearEmployees();
	const end = start + count;
	for(let employeeId=start;employeeId<end;++employeeId){
		if(globalThis.employeeData[employeeId]===undefined) continue;
		if(store.maxEmployeeId < employeeId) store.maxEmployeeId = employeeId;
		await appendEmployeeAsync(employeeId);
		await delayAsync(400);
		console.debug('employee added');
	}
	console.log(`${start} .. ${start+count-1} complete`);
}

// Loads Data-Dictionary
async function getEmployeeDictAsync(){
	const resp = await fetch('https://intranetapps.tql.com/api/extensionlist/employees/list')
	const json = await resp.json();
	const dict = {};
	json.content.forEach(emp=>dict[emp.employeeId] = emp);
	return dict;
}

(async function(){
	globalThis.employeeData = await getEmployeeDictAsync();

	function foo(str){queueMicrotask (console.log.bind (console, `%c${str}`,'color:#00c;font-style:italic;font-weight:800;'));}
	foo('activeIds = [...]');
	foo('terminatedIds = [...]');
	foo('scanEmployeesAsync(start,count=100);');
	foo('showEmployeesByIdAsync(ids=null);');
	foo(`Last employee: ${Object.values(globalThis.employeeData).pop().employeeId}, Last scanned:${store.maxEmployeeId}`)

	queueMicrotask (console.log.bind (console, '%cemployee_scan.js initialized','background-color:#DFD')); // Last line of file
})()




