import { type SnoopedWindow } from "~/utils/snoop";

// Contains all the types that we are adding to the normal unsafe-Window
export type SnlWindow = SnoopedWindow & {
	cmd?: unknown;
	snooper?: unknown;
}
