// ======
// Users
// ======
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

// ========
// Images
// ========
export type LocalStorageImageEntity = {
	owner: string; // perma_subdomain
	height: number;
	width: number;
	responsiveUrl: string;
	videoUrl?: string;
	captureDate: number;
	uploadDate: number;
}

// Image Repo
export type LocalStorageImageDict = Record<string,LocalStorageImageEntity>; // Key'd on image ID to prevent duplicates

// ============
// Friend Links
// ============

// LinkRepo
export type LocalStorageUserLinks = string[]