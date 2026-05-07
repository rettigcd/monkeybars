import { con } from "~/lib/console";
import { $ } from "~/lib/dom3";

export class NextLink{ 
	label!: string;
	count!: number;
	tooltip!: string;
	nextUrl?: string;
	constructor({label,nextUrl,count,tooltip}:{label:string,nextUrl?:string,count:number,tooltip:string}){
		Object.assign(this,{label,nextUrl,count,tooltip});
	}
	goto(){
		const {label,count,nextUrl} = this, msg = `${label}: ${count}`;
		con.print(msg);
		// saveNotification(msg);
		if(nextUrl)
			setTimeout(()=>window.location.href=nextUrl,2000);
	}
	// UI stuff
	appendTo(host:HTMLDivElement){
		const {label,nextUrl,count,tooltip} = this;
		if(!nextUrl) return;
		$('div')
			.txt(`${label}: ${count}`)
			.attr('title',tooltip)
			.css({textDecoration:'underline',cursor:'pointer',fontSize:'12px'})
			.on('click',() => document.location.href = nextUrl )
			.appendTo(host)
	}
}
