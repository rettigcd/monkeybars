import { $ } from "~/utils/dom3";
import { formatSeconds } from "../time-format";
import type { Waiter, WaitStatus } from "../waiting/waiter";
import { css } from "./css";

// Adds UI to status bar and updates it when .delay is changed.
export function waiterView(waiter: Waiter): HTMLElement {
	const statusBar = $("p").css(css.subBar).el;
	const timeEl = $("span").css(css.status).appendTo(statusBar).el;
	const tMinusEl = $("span").css(css.status).appendTo(statusBar).el;
	const refreshEl = $("span").css(css.status).appendTo(statusBar).el;
	const watchEl = $("span").css(css.status).txt("Shows: ?").appendTo(statusBar).el;

	$("button")
		.css(css.reloadButton)
		.txt("RELOAD")
		.on("click", () => waiter.reload("button click"))
		.appendTo(statusBar);

	waiter.listen("waitStatus", ({ newValue, oldValue }) => {
		if (oldValue === undefined)
			watchEl.style.backgroundColor = "#8F8";
		const { attempt, count } = newValue as WaitStatus;
		watchEl.innerText = `Shows: ${count} (${attempt})`;
		watchEl.style.backgroundColor = count === 0 ? "#F88" : "#8F8";
	});

	// update delay
	setInterval(() => {
		// Current Time
		timeEl.innerText = `Time: ${new Date().toLocaleTimeString()}`;

		// T-(Time remaining) until Target
		const offsetFromTarget = waiter.getOffsetFromTarget();
		const targetStr = formatSeconds(offsetFromTarget);
		tMinusEl.innerText = `Target: ${targetStr}`;
		tMinusEl.style.color = offsetFromTarget !== undefined && offsetFromTarget < 0 ? "green" : "red";

		// Refresh
		const { delay } = waiter.getDelay();
		refreshEl.innerText = `Refresh: ${formatSeconds(-delay)}`;
	}, 100);

	return statusBar;
}