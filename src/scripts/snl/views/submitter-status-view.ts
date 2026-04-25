import { $ } from "~/utils/dom3";
import type { ListenFn } from "~/utils/observable";
import type { Status } from "../status";
import type { SubmitterStatus } from "../submitter";
import { css } from "./css";

export type SubmitterStatusViewModel = SubmitterStatus & {
	listen: ListenFn<SubmitterStatus>;
};

export function submitterStatusView(status: SubmitterStatusViewModel): HTMLElement {
	const statusBar = $("p").txt("").css(css.subBar).el;

	const create = (prop?: keyof SubmitterStatus): HTMLElement => {
		const span = $("span").css(css.status).appendTo(statusBar).el;

		if (prop) {
			status.listen(prop, ({ newValue }) => {
				const newStatus = newValue as Status;
				span.innerText = newStatus.text;
				Object.assign(span.style, newStatus.success ? css.success : css.fail);
			});
		}

		return span;
	};

	const attemptStatus = create();
	Object.assign(attemptStatus.style, { cursor: "pointer" });
	attemptStatus.addEventListener("click", ()=>status.stopRequested = true);

	status.listen("attempt", ({ newValue: attempt }) => {
		if (attempt === "stopped") {
			attemptStatus.innerHTML = "Stopped";
			attemptStatus.style.color = "red";
		} else {
			attemptStatus.style.color = "green";
			attemptStatus.style.backgroundColor = "white";
			attemptStatus.innerHTML = attempt;
		}
	});

	create("show");
	create("groupSize");
	create("bookEvent");
	create("firstName");
	create("lastName");
	create("mobileNumber");
	create("email");
	create("cb");
	create("submit");
	return statusBar;
}
