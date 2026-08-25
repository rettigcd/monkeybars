import type { SnoopedWindow } from "~/lib/snoop";
import type { AzureDevOpsLocation } from "./azdo.user";

export type AzureDevOpsRepository = {
	id: string;
	name: string;
	url?: string;
};

type RepositoryResponse = {
	id?: unknown;
	name?: unknown;
	url?: unknown;
};

export function createRepositoryResolver(
	win: SnoopedWindow,
	location: AzureDevOpsLocation,
): { resolve: (repositoryId: string) => Promise<AzureDevOpsRepository> } {
	return {
		async resolve(repositoryId: string): Promise<AzureDevOpsRepository> {
			const pagePath = win.location.pathname.split("/").filter(Boolean);
			const gitIndex = pagePath.indexOf("_git");
			if (gitIndex < 1)
				throw new Error("The Azure DevOps URL does not contain a project and _git segment.");

			const apiPath = [
				...pagePath.slice(0, gitIndex),
				"_apis",
				"git",
				"repositories",
				encodeURIComponent(repositoryId),
			].join("/");
			const apiUrl = new URL(`/${apiPath}`, win.location.origin);
			apiUrl.searchParams.set("api-version", "7.1");

			const response = await win.fetch(apiUrl.toString(), {
				headers: { Accept: "application/json" },
			});
			if (!response.ok)
				throw new Error(`Azure DevOps repository lookup failed: ${response.status} ${response.statusText}`);

			const data = await response.json() as RepositoryResponse;
			if (data.id !== repositoryId || typeof data.name !== "string")
				throw new Error(`Azure DevOps returned an invalid repository for ${location.project}/${repositoryId}.`);

			return {
				id: repositoryId,
				name: data.name,
				...(typeof data.url === "string" ? { url: data.url } : {}),
			};
		},
	};
}
