// Azure DevOps titles work item pages "User Story 12345: Story title - Boards".
// Drop the "User Story " prefix so the tab starts with the number.
const userStoryPrefix = /^User Story (?=\d)/;

export function stripUserStoryPrefix(title: string): string {
	return title.replace(userStoryPrefix, "");
}

export function isFeatureTitle(title: string): boolean {
	return /^Feature \d/.test(title);
}

let onTitleChange: (() => void) | undefined;

function fixTitle() {
	const fixed = stripUserStoryPrefix(document.title);
	if (fixed !== document.title)
		document.title = fixed;
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
