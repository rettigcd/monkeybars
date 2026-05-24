import type { HasConsole } from "~/lib/console";
import type { ISnoopedWindow, } from "~/lib/snoop";
import type { Gallery } from "../models/gallery-model";
import type { UserStore } from "../user-store";
import type { UserCtx } from "../user/user-ctx";

// Contains all the types that we are adding to the normal unsafeWindow
export type VscoWindow = Window
	& ISnoopedWindow 
	& HasConsole 
	& {
		cmd?: {
			userStore: UserStore;
			reports: Record<string,unknown>;
			gallery: Gallery;
			// missingViewDate: (b:boolean) => void;
			// nextToPrune: (years:number)) => void;{
			// showLinks: () => Promise<void>;

			// user-page specific
			pageOwnerCtx?: UserCtx;
			pageOwnerName?: string;
			downloads?: unknown[];

			groups?:() => unknown;
		}
	};

declare const unsafeWindow: Window | undefined;

export const win: VscoWindow = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window) as VscoWindow;
