
export type UserStatusType = "following" | "new" | "queued" | "notFollowing" | "failed";


export interface ILinkedUser{
	username: string;
	status: UserStatusType;
	open: () => void;
	save: () => void;
	mask: () => void;
}
