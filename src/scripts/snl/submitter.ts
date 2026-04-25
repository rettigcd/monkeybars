import { con } from "~/utils/console";
import { makeObservable, type ObservableHost } from "~/utils/observable";
import { ConfigModel } from "./config";
import { Status } from "./status";

type Logger = {
	log: (message: unknown) => void;
};

type ShowService = {
	findCurrentDivs: () => Array<{
		div: Element;
		label: string;
	}>;
};

type SubmitterConfig = Pick<
	ConfigModel,
	"show" | "groupSize" | "firstName" | "lastName" | "email" | "phone"
>;

export type SubmitterStatus = {
	attempt: string;
	show: Status;
	groupSize: Status;
	bookEvent: Status;
	firstName: Status;
	lastName: Status;
	email: Status;
	mobileNumber: Status;
	cb: Status;
	submit: Status;
	stopRequested: boolean;
};

type FinderMap = Record<string, () => boolean | null | undefined>;

type ClickableElement = Element & {
	click: () => void;
	triggerHandler?: (eventName: string) => void;
	disabled?: boolean;
	checked?: boolean;
	value?: string;
	name?: string;
};

function createSubmitterStatus(): ObservableHost<SubmitterStatus> {
	return makeObservable({
		show: Status.fail(""),
		groupSize: Status.fail(""),
		bookEvent: Status.fail(""),
		firstName: Status.fail(""),
		lastName: Status.fail(""),
		email: Status.fail(""),
		mobileNumber: Status.fail(""),
		cb: Status.fail(""),
		submit: Status.fail(""),
		attempt: "",
		stopRequested: false,
	});
}

// Submitter continuously scans the page and incrementally drives a multi-step form to completion, 
// while reporting progress through an observable status model.
// TODO: break into 3 objects:
//	* Submitter				- time/orchestrator only - monitor(), onTick(), stop()
//	* SubmitterWorkflow		- retry pipeline - 
//	* submitterFormDriver	- DOM actions
//	* SubmitterStatus		- 
export class Submitter {
	private readonly config: SubmitterConfig;
	private readonly _showService: ShowService;
	private readonly _logger: Logger;

	public startMonitorTime: number;
	public readonly status: ObservableHost<SubmitterStatus>;
	
	private foundShow: boolean;
	private submittedForm: boolean;
	private finders: FinderMap;
	private inputs: HTMLInputElement[] = [];
	private attempt = 0;
	private intervalId?: number;

	public constructor(
		config: SubmitterConfig,
		showService: ShowService,
		logger: Logger,
	) {
		this.config = config;
		this._showService = showService;
		this._logger = logger;

		this.startMonitorTime = Date.now(); // record when start monitoring

		// make status observable
		this.status = createSubmitterStatus();

		this.foundShow = false;
		this.submittedForm = false;
		this.finders = {
			// Phase 1
			setGroupSize: () => this.setGroupSize(this.config.groupSize),
			validateGroupSize: () => this.validateGroupSize(this.config.groupSize),
			bookEvent: () => this.bookEvent(),

			// Phase 2
			first: () => this.setTextValue("firstName", this.config.firstName),
			last: () => this.setTextValue("lastName", this.config.lastName),
			email: () => this.setTextValue("email", this.config.email),
			mobileNumber: () => this.setTextValue("mobileNumber", this.config.phone),

			privacyAgreement: () => this.checkPrivacyAgreement(),
		};

		// Listen for view to request stop.
		this.status.listen("stopRequested", ({newValue:stopRequested}) => {
			if(stopRequested)
				this.stop();
		});
	}

	public monitor(): void {
		this._logger.log("attempting to submit form...");

		this.attempt = 0;
		this.intervalId = window.setInterval(() => this.onTick(), 200);

		// set focus on first element
		// const fn=[...document.getElementsByName('firstName')];
		// if(fn.length>0 && fn[0].focus) fn[0].focus();
	}

	private onTick(): void {
		this.inputs = [...document.querySelectorAll("input")];

		if (!this.foundShow) {
			this.foundShow = this.selectShow() === true;
		}

		// loop through finders
		const keys = Object.keys(this.finders);
		for (const key of keys) {
			if (this.finders[key]()) {
				delete this.finders[key];
			}
		}

		// if no finders are left, try to submit the form
		const submitButton = this._findSubmitButton();
		const isReadyToSubmit =
			Object.keys(this.finders).length === 0 || !submitButton?.disabled;

		if (isReadyToSubmit && !this.submittedForm) {
			this.submittedForm = this.submitForm() === true;
			if (this.submittedForm)
				this.stop();
		}

		const maxAttempts = 500;
		if (++this.attempt === maxAttempts) {
			this.stop();
			this.status.attempt = "stopped";
		} else {
			this.status.attempt = `Attempt ${this.attempt} of ${maxAttempts}`;
		}
	}

	public stop(): void {
		if (this.intervalId !== undefined) {
			clearInterval(this.intervalId);
			this.intervalId = undefined;
		}
	}

	public selectShow(): boolean | undefined {
		// return null if unsuccessful
		if (this.config.show) {
			const show = this._showService
				.findCurrentDivs()
				.find(({ label }) => label.includes(this.config.show ?? ""));

			if (show) {
				try {
					(show.div as HTMLElement).click();
				} catch (err) {
					console.error(err);
				}

				this._logger.log({ action: "selectShow()", show });
				this.status.show = Status.pass("Show selected.");
				return true;
			}
		}

		this.status.show = Status.fail(`'${this.config.show}' not found.`);
		return undefined;
	}

	// Fills in the Form Text + triggers
	// Triggers validatio nvia events
	public setTextValue(sub: Exclude<keyof SubmitterStatus, "attempt" | "stopRequested">, value: string): boolean | undefined {
		try {
			const matches = this.inputs.filter((i) => i.name === sub);

			if (matches.length !== 1) {
				this.status[sub] = Status.fail(`'${sub}': (${matches.length})`);
				return false;
			}

			const match = matches[0];
			match.value = value;
			match.dispatchEvent(new Event("change"));
			match.dispatchEvent(new Event("blur"));

			this._logger.log({ action: "setText", sub, value });
			this.status[sub] = Status.pass(`${sub} ✔`);
			return true;
		} catch (ex) {
			console.error("setTextValue", ex);
			return undefined;
		}
	}

	// GroupSize - Part 1
	// Open Group-Size dropdown and clicks groups size
	// once it thinks it has succeeded, it stops trying - gives user the ability to intercede
	public setGroupSize(size: string | number): boolean | undefined {
		try {
			const groupSizeDiv = this.getGroupSizeDiv();

			if (groupSizeDiv == null) {
				this.status.groupSize = Status.fail("group-size not found.");
				return false;
			}

			// -----------------
			// CLICK - Open Dropdown
			if (!groupSizeDiv.classList.contains("open")) {
				const openDropDownButton = groupSizeDiv.querySelector("button.dropdown-toggle");

				if (openDropDownButton instanceof HTMLElement) {
					openDropDownButton.click();
				}
			}

			// -----------------
			// CLICK - Find option & Set it!
			const options = [
				...groupSizeDiv.querySelectorAll("div.group-size-dropdown ul.dropdown-menu li a"),
			];

			const index = Math.max(Number(size), 1) - 1; // assuming size=1 is in index=0 // missing or negative size, use 1

			if (!(index < options.length)) {
				this.status.groupSize = Status.fail(`Too few Grp-Size Options: ${options.length}`);
				return false;
			}

			const option = options[index];

			if (option instanceof HTMLElement) {
				option.click();
			}

			this._logger.log({ action: "setGroupSize()", size });
			return true;
		} catch (er) {
			console.error("setGroupSize", er);
			return undefined;
		}
	}

	// GroupSize - Part 2
	// Checks if the select-group-size action succeeded
	// Does not actually Do anything, allows user to intercede
	public validateGroupSize(size: string | number): boolean | null | undefined {
		try {
			const groupSizeDiv = this.getGroupSizeDiv();

			if (groupSizeDiv == null) {
				this.status.groupSize = Status.fail("group-size not found.");
				return null;
			}

			// check if it was set
			const btns = [...groupSizeDiv.querySelectorAll("button")];
			const changed = btns.length === 2 && btns[0].innerHTML === String(size);

			this.status.groupSize = changed
				? Status.pass("Grp-Size ✔")
				: Status.fail("Grp-Size NOT Set");

			return changed;
		} catch (er) {
			console.error("validateGroupSize", er);
			return undefined;
		}
	}

	private getGroupSizeDiv(): HTMLElement | null {
		return document.querySelector("div.group-size div.group-size-dropdown");
	}

	// Step 1 - After selecting group size
	public bookEvent(): boolean {
		const btn = document.querySelector("button.btn-book-event") as ClickableElement | null;

		if (btn == null) {
			this.status.bookEvent = Status.fail("Book-Event not found");
			return false;
		}

		if (btn.click) {
			btn.click();
		}

		if (btn.triggerHandler) {
			btn.triggerHandler("click");
		}

		this.status.bookEvent = Status.pass("Book-Event ✔");
		this._logger.log({ action: "bookEvent()" });
		return true;
	}

	public checkPrivacyAgreement(): boolean {
		try {
			const checkBox = document.querySelector("#privacy-agreement") as HTMLInputElement | null;

			if (checkBox == null) {
				this.status.cb = Status.fail("privacy-agreement not found.");
				return false;
			}

			checkBox.checked = true;
			checkBox.dispatchEvent(new Event("change"));
			checkBox.dispatchEvent(new Event("click"));

			this.status.cb = Status.pass("checked privacy-agreement");
			this._logger.log({ action: "checkPRivacyAgreement()" });
			return true;
		} catch (ex) {
			console.error("checkPrivacyAgreement", ex);
			this.status.cb = Status.fail("CB exception.");
		}

		return false;
	}

	// Step 2 - After filling out all user information.
	public submitForm(): boolean | undefined {
		const submitButton = this._findSubmitButton();

		if (submitButton == null) {
			this.status.submit = Status.fail("no submit found");
			return undefined;
		}

		if (submitButton.disabled) {
			this.status.submit = Status.fail("submit is disabled");
			return false;
		}

		this.status.submit = Status.pass("submitting ✔");
		this._logger.log("submitting form...");
		submitButton.click();
		return true;
	}

	private _findSubmitButton(): HTMLButtonElement | null {
		return document.querySelector("button.btn-complete");
	}

	// for testing:
	public stubSubmit(): void {
		con.print("%cstubbing out the form submit button.", "color:red;");

		const oldFinder = this._findSubmitButton.bind(this);

		this._findSubmitButton = function (): HTMLButtonElement {
			return {
				get disabled() {
					const btn = oldFinder();
					return btn == null || btn.disabled;
				},
				click() {
					console.log(
						"%c!!! SUBMITTED !!!",
						"background:red;font-size:16px;padding:3px;font-weight:bold;color:white;",
					);
				},
			} as HTMLButtonElement;
		};
	}
}