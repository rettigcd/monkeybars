import { SyncedPersistentDict } from "~/utils/storage";

// Users
export type UserEntity = {
	id?: number,
	username? : string;
	fullName? : string;
	isPrivate? : boolean;

	lastVisit?: number;
	isFollowing?: boolean;
	dl: {
		[key: string]: number;
	}
}

export type UserRepo = SyncedPersistentDict<UserEntity>;



// Locations
export type LocationEntity = {
	lastVisit?: number;
	slug: string;
	id: string;
}

export type LocationRepo = SyncedPersistentDict<LocationEntity>;
