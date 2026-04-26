
// On Users profile / tagged page
export interface InstagramProfileResponse {
	data: {

		// PolarisProfilePostsQuery
		// PolarisProfilePostsTabContentQuery_connection
		xdt_api__v1__feed__user_timeline_graphql_connection?: { edges: Edge[]; };

		// PolarisProfileTaggedTabContentQuery
		// PolarisProfileTaggedTabContentQuery_Connection
		xdt_api__v1__usertags__user_id__feed_connection?: { edges: Edge[]; };
	};
	errors?: unknown[]
}

// On the location page
export interface InstagramLocationResponse {
	data: {
		xdt_location_get_web_info_tab: {
			edges: Edge[];
		};
	};
	errors?: unknown[]
}

// When you click on an image and it pops up.
export type DetailsPopupResponse = {
	items:MediaNode[]
}


export interface Edge {
	node: MediaNode;
	cursor: string | null;
}

export interface TaggedImageMedia {
	usertags: UserTags | null;
	image_versions2: ImageVersions2;
}

export interface CarouselMedia extends TaggedImageMedia {
}

export interface MediaNode extends TaggedImageMedia {
	caption: Caption | null;
	taken_at: number;
	user: User;
	has_liked: boolean;
	carousel_media?: CarouselMedia[];
}

// == Saved Posts ==
export interface SavedPostItem {
	media: MediaNode;
}

export interface SavedPostsResponse {
	items: SavedPostItem[];
}

export interface UserTagUser {
	id: string;
	pk: string;
	username: string;
	full_name: string;
	profile_pic_url: string;
	is_verified: boolean;
}

export type UserTagPosition = [number, number];

export interface UserTag {
	user: UserTagUser;
	position: UserTagPosition;
}

export interface UserTags {
	in: UserTag[];
}
export interface Caption {
	pk: string;
	text: string;
	created_at: number;
	has_translation: boolean | null;
}

export interface ImageVersions2 {
	candidates: ImageCandidate[];
}

export interface ImageCandidate {
	url: string;
	width: number;
	height: number;
}

export interface User {
	id: string;
	pk: string;
	username: string;

	profile_pic_url: string;

	is_private: boolean;
	is_verified: boolean;

	friendship_status: { following: boolean; };

	// tons of nullable fields — keep loose unless needed
	[key: string]: unknown;
}


export interface Location {
	pk: string;
	name: string;
	lat: number;
	lng: number;
	profile_pic_url: string | null;
}

