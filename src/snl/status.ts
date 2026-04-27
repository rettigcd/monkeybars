
export class Status {
	constructor(
		public success: boolean,
		public text: string,
	) {}

	static pass(text: string): Status {
		return new Status(true, text);
	}

	static fail(text: string): Status {
		return new Status(false, text);
	}
}