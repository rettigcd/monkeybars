import { type SnoopedWindow } from "~/lib/snoop";

// Contains all the types that we are adding to the normal unsafe-Window
export type InstagramWindow = SnoopedWindow & {
	cmd?: unknown;
	snooper?: unknown;
}
