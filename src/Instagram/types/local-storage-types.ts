
// Users
export type LocalStorageUserEntity = {
	id?: number,
	username? : string;
	fullName? : string;
	isPrivate? : boolean;

	lastVisit?: number;
	isFollowing?: boolean;
	dl?: {
		[key: string]: number;
	}
}

// Locations
export type LocalStorageLocationEntity = {
	lastVisit?: number;
	slug: string;
	id: string;
}
