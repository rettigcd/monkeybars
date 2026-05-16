import { type HasConsole } from "~/lib/console";
import { type ISnoopedWindow, } from "~/lib/snoop";
import type { MouseMoveSource } from "../screen-image-actions";

// Contains all the types that we are adding to the normal unsage-Window
export type InstagramWindow = Window
	& ISnoopedWindow 
	& MouseMoveSource 
	& HasConsole 
	& {
		// cmd?: unknown;
		// snooper?: unknown;
	}

declare const unsafeWindow: Window;

export const win: InstagramWindow = (typeof unsafeWindow !== "undefined" ? unsafeWindow : window) as InstagramWindow;
