import { describe, expect, it, vi } from "vitest";
import { parseAzureDevOpsUrl } from "./azdo.user";
import { createRepositoryResolver } from "./repository-resolver";

describe("parseAzureDevOpsUrl", () => {
	it("parses a visualstudio.com pull request URL", () => {
		// Given a repository URL with a friendly project name and GUID repository
		const url = "https://tqlweb.visualstudio.com/Project%20Transform/_git/0bd7ad90-2abd-4ca1-90fc-ee12f480de67/pullrequest/242969";

		// When the URL is parsed
		const result = parseAzureDevOpsUrl(url);

		// Then the project and repository are decoded
		expect(result).toEqual({
			project: "Project Transform",
			repository: "0bd7ad90-2abd-4ca1-90fc-ee12f480de67",
		});
	});

	it("parses the project after the organization for dev.azure.com", () => {
		// Given a dev.azure.com URL with an organization path segment
		const url = "https://dev.azure.com/tqlweb/Project%20Transform/_git/TQL.Pricing.QuoteMgmt.UI/pullrequest/242969";

		// When the URL is parsed
		const result = parseAzureDevOpsUrl(url);

		// Then the project is not mistaken for the organization
		expect(result).toEqual({
			project: "Project Transform",
			repository: "TQL.Pricing.QuoteMgmt.UI",
		});
	});
});

describe("createRepositoryResolver", () => {
	it("looks up a GUID using the current Azure DevOps path", async () => {
		// Given an Azure DevOps page and a successful repository response
		const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
			id: "repo-guid",
			name: "Pricing UI",
		}), { status: 200 }));
		const win = {
			fetch,
			location: new URL("https://tqlweb.visualstudio.com/Project%20Transform/_git/repo-guid/pullrequest/1"),
		} as unknown as Window & typeof globalThis;
		const resolver = createRepositoryResolver(win, {
			project: "Project Transform",
			repository: "repo-guid",
		});

		// When the GUID is resolved
		const result = await resolver.resolve("repo-guid");

		// Then the friendly name is returned and the expected API was requested
		expect(result.name).toBe("Pricing UI");
		expect(fetch).toHaveBeenCalledWith(
		"https://tqlweb.visualstudio.com/Project%20Transform/_apis/git/repositories/repo-guid?api-version=7.1",
		expect.objectContaining({ headers: { Accept: "application/json" } }),
	);
	});
});
