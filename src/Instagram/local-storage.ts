import { SyncedPersistentDict } from "~/lib/storage";

// Users
export type LocalStorageUserEntity = {

	// important!
	lastVisit?: number;
	dl?: {
		[key: string]: number;
	}

	// helpful
	isPrivate? : boolean;
	isFollowing?: boolean;

	// why?
//	username? : string; // why is this here???
//	fullName? : string;
//	id?: number,

}

export const userRepo = new SyncedPersistentDict<LocalStorageUserEntity>("users");

// Locations
export type LocalStorageLocationEntity = {
	lastVisit?: number;
	slug: string;
	id: string;
}
