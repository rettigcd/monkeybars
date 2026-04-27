import { $ } from "~/utils/dom3";
import { ConfigService } from "../config";
import { Waiter } from "../waiting/waiter";
import { configView } from "./config-view";
import { css } from "./css";
import { submitterStatusView, type SubmitterStatusViewModel } from "./submitter-status-view";
import { waiterView } from "./waiter-view";

export function generateView({myConfig, waiter, submitterStatus} 
	: {myConfig:ConfigService, waiter: Waiter, submitterStatus:SubmitterStatusViewModel}
) : void {
	const topBar = $('div').css(css.topBar).withChildren(
		configView(myConfig),
		waiterView(waiter),
		submitterStatusView(submitterStatus)
	);

	// wait for body to appear
	const id = setInterval(function(){
		if(document.body){
			topBar.appendTo(document.body);
			clearInterval(id);
		} else 
			console.log('nobody');

	}, 200);
}
