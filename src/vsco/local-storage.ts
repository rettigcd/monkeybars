// ======
// Users

import { CachedPersistentArray, SyncedPersistentDict } from "~/lib/storage";

// ======
export type StarType = 1 | 2 | 3 | 4 | 5 | 'scan' | null | undefined;

export type LocalStorageUserEntity = {
	stars?: StarType;
	viewDate?: number; // storing seconds since epoch / Unix time
	dl?: Record<string,number>;
	failure?: {
		count: number;
		first: number;
	}
}
export const userRepo = new SyncedPersistentDict<LocalStorageUserEntity>('users');

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
// Key'd on image ID to prevent duplicates
export type LocalStorageImageDict = Record<string,LocalStorageImageEntity>;

export const newImageRepo = new SyncedPersistentDict<LocalStorageImageDict>('newImages');

// ============
// Friend Links
// ============

// LinkRepo
export type LocalStorageUserLinks = string[]

export const linkRepo = new SyncedPersistentDict<LocalStorageUserLinks>('graph',()=>[]);


// ===========
// Common usernames to ignore
// ===========
export const commonRepo: CachedPersistentArray = new CachedPersistentArray('common');
