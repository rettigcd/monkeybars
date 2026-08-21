import { $ } from "~/lib/dom3";
import { instaDom } from "../services/instaDom";

const fadeOutMs = 1000;

const toastCss: Partial<CSSStyleDeclaration> = {
	position: "fixed",
	top: "10px",
	left: "50%",
	transform: "translateX(-50%)",
	zIndex: "10000",
	background: "rgba(0, 0, 0, 0.85)",
	color: "white",
	padding: "10px 20px",
	borderRadius: "6px",
	fontFamily: "Tahoma",
	fontSize: "20px",
	pointerEvents: "none",
	transition: `opacity ${fadeOutMs}ms ease-out`,
	opacity: "1",
};

// Shows a message in the top-center of the screen for `durationMs`, then fades it out over 1 second.
// Resolves once the fade-out completes and the element has been removed.
export async function showToast(message: string, durationMs: number): Promise<void> {
	const toast = $("div")
		.txt(message)
		.css(toastCss)
		.appendTo(instaDom.body);

	await delay(durationMs);

	toast.css({ opacity: "0" });

	await delay(fadeOutMs);

	toast.el.remove();
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
