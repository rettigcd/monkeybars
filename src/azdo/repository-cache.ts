const repositoryNamesKey = "azdo.repository-names";

type RepositoryNames = Record<string, string>;

function cacheKey(repositoryId: string): string {
	return repositoryId.toLowerCase();
}

function readRepositoryNames(storage: Storage): RepositoryNames {
	try {
		const serialized = storage.getItem(repositoryNamesKey);
		if (serialized == null)
			return {};

		const value: unknown = JSON.parse(serialized);
		if (value == null || typeof value !== "object" || Array.isArray(value))
			return {};

		return Object.fromEntries(
			Object.entries(value).filter((entry): entry is [string, string] =>
				typeof entry[1] === "string",
			),
		);
	} catch (error: unknown) {
		console.debug("Azure DevOps repository cache could not be read", error);
		return {};
	}
}

export function getCachedRepositoryName(repositoryId: string, storage: Storage = localStorage): string | undefined {
	return readRepositoryNames(storage)[cacheKey(repositoryId)];
}

export function cacheRepositoryName(
	repositoryId: string,
	name: string,
	storage: Storage = localStorage,
): void {
	const repositoryNames = readRepositoryNames(storage);
	repositoryNames[cacheKey(repositoryId)] = name;

	try {
		storage.setItem(repositoryNamesKey, JSON.stringify(repositoryNames));
	} catch (error: unknown) {
		console.debug("Azure DevOps repository cache could not be written", error);
	}
}
