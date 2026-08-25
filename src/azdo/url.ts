export type AzureDevOpsLocation = {
	project: string;
	repository: string;
};

export function parseAzureDevOpsUrl(value: string | URL): AzureDevOpsLocation | null {
	const url = typeof value === "string" ? new URL(value) : value;
	const path = url.pathname.split("/").filter(Boolean);
	const gitIndex = path.indexOf("_git");

	if (gitIndex < 1 || gitIndex + 1 >= path.length)
		return null;

	return {
		project: decodeURIComponent(path[gitIndex - 1]),
		repository: decodeURIComponent(path[gitIndex + 1]),
	};
}

// Returns { project, repository }
export const projectRepo = parseAzureDevOpsUrl(window.location.href);
