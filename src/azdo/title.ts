// Azure DevOps titles work item pages "User Story 12345: Story title - Boards".
// Drop the "User Story " / "Feature " prefix so the tab starts with the number.
const typePrefix = /^(User Story|Feature) (?=\d)/;

export function stripTypePrefix(title: string): string {
	return title.replace(typePrefix, "");
}

// Stripping removes the type from the title, so remember it for the favicon.
let currentIsFeature = false;

export function isFeatureWorkItem(): boolean {
	return currentIsFeature;
}

let onTitleChange: (() => void) | undefined;

function fixTitle() {
	const title = document.title;
	const match = typePrefix.exec(title);
	if (match) {
		currentIsFeature = match[1] === "Feature";
		document.title = stripTypePrefix(title);
	} else if (!/^\d+:/.test(title)) {
		currentIsFeature = false; // not a (stripped) work item title
	}
	onTitleChange?.();
}

// The SPA rewrites document.title on every navigation/load, so watch for changes.
// Re-assigning a stripped title no longer matches the prefix, so this can't loop.
export function watchTitle(onChange?: () => void): void {
	onTitleChange = onChange;
	fixTitle();
	new MutationObserver(fixTitle).observe(document, {
		subtree: true,
		childList: true,
		characterData: true,
	});
}
