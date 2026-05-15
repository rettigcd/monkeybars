import { con } from "~/lib/console";
import { $ } from "~/lib/dom3";
import { UserCtx } from "../user-ctx";
import { pageOwnerName } from "../vscoDom";

// since links are generated before we init the user page,
// we need to grab this early and not wait

export class NextLink{ 

	private label!: string;
	private count!: number;
	private tooltip!: string;
	private nextUrl?: string;
	
	constructor({label,tooltip,users}:{label:string,tooltip:string,users:UserCtx[]}){
		const otherUsers = users.filter(ctx=>ctx.username != pageOwnerName);
		const count = otherUsers.length;
		const nextUrl = count ? otherUsers[0]!.fetch.galleryUrl : undefined;
		Object.assign(this,{label,nextUrl,count,tooltip});
	}

	// used by Window.CMD....
	public goto(){
		const {label,count,nextUrl} = this, msg = `${label}: ${count}`;
		con.print(msg);
		// saveNotification(msg);
		if(nextUrl)
			setTimeout(()=>window.location.href=nextUrl,2000);
	}

	public makeDiv(): HTMLDivElement | undefined {
		const {label,nextUrl,count,tooltip} = this;
		if(!nextUrl) return;
		return $('div')
			.txt(`${label}: ${count}`)
			.attr('title',tooltip)
			.css({textDecoration:'underline',cursor:'pointer',fontSize:'12px'})
			.on('click',() => document.location.href = nextUrl )
			.el;
	}
}
