// A 'repository' is where items are saved and loaded from.

import { setClipboard } from "~/lib/gm";
import { codeCss } from "./css";
import type { Row } from "./types";

// LocalStorage is where we are saving these items.
export class LocalStorageRepository{

	constructor(
		private readonly key:string
	){}

	load():Row[]{ return JSON.parse(this.raw() || '[]'); }

	save(rows:Row[]){ localStorage[this.key] = '[\r\n' + rows.map((x)=>JSON.stringify(x)).join(",\r\n") + '\r\n]'; }

	clear(){
		if(prompt("Type the word 'clear' to clear all history.")=='clear')
			this.save([]);
		else
			console.log('Clear History - canceled.');
	}

	raw(){ return localStorage[this.key]; }

	help(){
		console.group('Repository');
		console.log( 'to view, type: %crepo.load()', codeCss );
		console.log( 'to clear, type: %crepo.clear()', codeCss );
		console.log( 'to copy to clipboard, type: %crepo.copy()', codeCss);
		console.groupEnd();
	}

	// this is not really a repository-like method
	copy(){ setClipboard(this.raw(), "text", () => console.log("History saved to clipboard!")); }
}
