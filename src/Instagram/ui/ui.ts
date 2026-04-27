import { $, $qAsync } from "~/lib/dom3";

// Adds a clickable button to copy the page owner's name to clipboard.
// Used as a quick UI utility for copying usernames.
export async function addCopyButton(pageOwnerName:string) {
	const button = $("div")
		.txt("📋")
		.css({ margin: "3px", padding: "2px", cursor: "pointer", color: "black" })
		.on("click", async () => {
			await navigator.clipboard.writeText(pageOwnerName);
		});

	const bob = await $qAsync("h2");
	const referenceEl = bob.parentNode;
	referenceEl!.parentNode!.insertBefore(button.el, referenceEl);
}
