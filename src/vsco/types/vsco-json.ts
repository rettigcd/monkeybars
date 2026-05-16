export type SiteState = {
	medias: SmallMedia[]; // What are these used for?	
	nextCursor? : string | null;
}

export type SmallMedia = {
	type: "image"; // | "video" ???
	image?: string; // guid
}

// =========
// Preloaded
// =========

// Entire Preloaded State
export type PreloadedState = {
	users: {
		currentUser: {
			tkn: string; // token
		}
	}
	medias: {
		bySiteId: Record<string,SiteState>;
	}
	entities: {
		images: Record<string,PreloadImageEntity>;
		videos?: Record<string,unknown>; // ??? does this exist?  do we use it?
	}
	errorMessage: string;
}

export type PreloadImageEntity = {
	permaSubdomain: string; // owner
	height: number;
	width: number;
	responsiveUrl: string;
	videoUrl?: string;
	captureDate: number;
	uploadDate: number;
}

// =======
// Fetched
// =======

export type FetchProfileResponse = {
	next_cursor?: string;
	media: { image: FetchImageEntity; }[];
};

export type FetchImageEntity = {
	perma_subdomain: string; // owner
	height: number;
	width: number;
	responsive_url: string;
	capture_date: number;
	upload_date: number;
}
