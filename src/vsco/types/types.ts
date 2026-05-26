
export type UserStatusType = "following" | "new" | "queued" | "notFollowing" | "failed";


export interface ILinkedUser{
	username: string;
	status: UserStatusType;
	openInNewTab: () => void;
	markAsQueued: () => void;
	maskAsCommon: () => void;
}
