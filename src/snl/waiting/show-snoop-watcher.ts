import { RequestSnooper, SnoopRequest } from "~/lib/snoop";
import { ShowAppearWaitResult } from "./show-appear-waiter";

// Monitors the snooper
export class ShowSnoopWatcher {

	promise: Promise<ShowAppearWaitResult>;
	resolve!: (value: ShowAppearWaitResult) => void;

	constructor(snooper:RequestSnooper){

		this.promise = new Promise<ShowAppearWaitResult>((resolve) => {
			this.resolve = resolve;
		})

		snooper.addHandler((request: SnoopRequest) => {
			const { url: { pathname }, responseText } = request;

			if (pathname.includes("/booking-widget/event/events/")) {
				const shows = JSON.parse(responseText) as unknown[];
				(request as SnoopRequest & { handled: string }).handled = "events";
				this.resolve( {reason:"snooped shoes", showCount:shows.length} );
			}
		});

	}

	watch(signal:AbortSignal) :Promise<ShowAppearWaitResult>{
		signal.addEventListener("abort", ()=>this.resolve({reason:"aborted"}) );
		return this.promise;
	}

}