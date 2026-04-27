import { type HasConsole } from "~/lib/console";
import { type SnoopedWindow } from "~/lib/snoop";
import { type MouseMoveSource } from "./screen-image-actions";

// Contains all the types that we are adding to the normal unsage-Window
export type InstagramWindow = SnoopedWindow 
	& MouseMoveSource 
	& HasConsole & {
	// cmd?: unknown;
	// snooper?: unknown;
}
