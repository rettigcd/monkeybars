type Logger = {
	log: (msg: unknown) => void;
};

export class Reloader{

	private logger: Logger;

	constructor(logger: Logger){
		this.logger = logger;
	}

	public reload(reason = ""): void {
		this.logger.log({ action: "reload()", reason });
		location.reload();
	}
	
	// for testing on pages that are not SNL
	public stubReload(): this {
		this.reload = function () {
			console.log(
				"%cRELOAD",
				"background:red;color:white;border:2px solid black;",
			);
		};

		return this;
	}
}