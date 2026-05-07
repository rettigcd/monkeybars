
export type UserStatusType = "following" | "new" | "queued" | "notFollowing" | "failed";


export interface ILinkedUser{
	username: string;
	status: UserStatusType;
	open: () => void;
	save: () => void;
	mask: () => void;
}

// Different than FetchImageEntity & PreloadedImageEntity
export type LocalStorageImageEntity = {
	owner: string; // perma_subdomain
	height: number;
	width: number;
	responsiveUrl: string;
	videoUrl?: string;
	captureDate: number;
	uploadDate: number;
}

export type StarType = 1 | 2 | 3 | 4 | 5 | 'scan' | null | undefined;

// UserRepo
export type LocalStorageUserEntity = {
	stars?: StarType;
	viewDate?: number; // storing seconds since epoch / Unix time
	dl?: Record<string,number>;
	failure?: {
		count: number;
		first: number;
	}
}

// Image Repo
export type LocalStorageImageDict = Record<string,LocalStorageImageEntity>; // Key'd on image ID to prevent duplicates

// LinkRepo
export type LocalStorageUserLinks = string[]