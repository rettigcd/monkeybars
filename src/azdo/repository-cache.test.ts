import { afterEach, describe, expect, it } from "vitest";
import { cacheRepositoryName, getCachedRepositoryName } from "./repository-cache";

afterEach(() => {
	localStorage.clear();
});

describe("repository name cache", () => {
	it("stores and retrieves a friendly name by case-insensitive GUID", () => {
		// Given a repository GUID and friendly name
		cacheRepositoryName("ABC-123", "Pricing UI");

		// When the cache is read with a differently-cased GUID
		const result = getCachedRepositoryName("abc-123");

		// Then the friendly name is returned from localStorage
		expect(result).toBe("Pricing UI");
		expect(localStorage.getItem("azdo.repository-names")).toBe(
			JSON.stringify({ "abc-123": "Pricing UI" }),
		);
	});

	it("preserves existing entries when adding a repository", () => {
		// Given an existing JSON dictionary in localStorage
		localStorage.setItem("azdo.repository-names", JSON.stringify({ "repo-1": "One" }));

		// When another repository name is cached
		cacheRepositoryName("repo-2", "Two");

		// Then both mappings remain available
		expect(JSON.parse(localStorage.getItem("azdo.repository-names") ?? "{}"))
			.toEqual({ "repo-1": "One", "repo-2": "Two" });
	});
});
