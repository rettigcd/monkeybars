// happens during the progress, no status
export type LTProgress = {
	loaded: number; // # complete
	total: number; // total
}

export type LTProgressHandler = (event: LTProgress) => void;

// Observable ProgressStatus
type Status<T extends string> = { status: T;}; // discriminator
export type NotStartedStatus = Status<'notStarted'>;
export type InProgressStatus = Status<'inProgress'> & LTProgress;
export type CompleteStatus = Status<'complete'>;
export type ErrorStatus = Status<'error'> & { error?:unknown };
export type TimeoutStatus = Status<'timeout'>;
export type TaskStatus = NotStartedStatus | InProgressStatus | CompleteStatus | ErrorStatus | TimeoutStatus;
