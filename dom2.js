
// Extend HTMLElement
function $el(tag){ return document.createElement(tag); }
function $q(css){ return [...document.querySelectorAll(css)]; }
for(const [prop,fn] of Object.entries({
	init: function(action){ action(this); return this; },
	css: function(style){ Object.assign(this.style,style); return this; },
	setText: function(text){ this.innerText = text; return this; },
	attr: function(name,val){ this.setAttribute(name,val); return this; },
	addClass: function(className){ this.classList.add(className); return this; },
	setData: function(key,value){ this.dataset[key] = value; return this; },
	on: function(eventName,handler){ this.addEventListener(eventName,handler); return this;},
	appendTo: function(host){ host.appendChild(this); return this; },
	appendMany: function(...children){ this.append(...children); return this; },
}))
	Object.defineProperty(HTMLElement.prototype, prop, { value:fn , writable: true, configurable: true });

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
		: (()=>{throw new Error(msg);})();

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
	a.download = filename || extractFilename(url) || "image";
	document.body.appendChild(a);
	a.click();

	// Cleanup
	document.body.removeChild(a);
	URL.revokeObjectURL(objectUrl);
}
