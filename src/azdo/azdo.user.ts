// ==UserScript==
// @name         Azure DevOps
// @namespace    http://tampermonkey.net/
// @version      1
// @description  Azure DevOps enhancements.
// @author       Christopher Rettig
// @match        https://dev.azure.com/*
// @match        https://*.visualstudio.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

//import { setGeometricFavicon as setFavicon } from "./favicongen/geometric";
//import { setMosaicFavicon as setFavicon } from "./favicongen/mosaic";
import { con } from "~/lib/console";
import { setRuneFavicon as setFavicon } from "./favicongen/glyph";
import { setUserStoryFavicon } from "./favicongen/user-story";
import { watchLocationChange } from "./location-watcher";
import { cacheRepositoryName, getCachedRepositoryName } from "./repository-cache";
import { createRepositoryResolver } from "./repository-resolver";
import { setFeatureFavicon } from "./favicongen/feature";
import { isFeatureWorkItem, watchTitle } from "./title";
import { isWorkItemUrl, parseAzureDevOpsUrl } from "./url";

async function getLocationString(){
	const projectRepo = parseAzureDevOpsUrl(window.location.href);
	if (projectRepo == null) return null;

	const repoIsGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectRepo.repository);
	// Is project name
	if(!repoIsGuid)
		return `${projectRepo.project}/${projectRepo.repository}`;

	// check if cache has the normal name for this repo-guid
	const cachedName = getCachedRepositoryName(projectRepo.repository);
	if (cachedName != null) {
		console.debug("Azure DevOps location", { ...projectRepo, repository: cachedName, source: "cache" });
		return `${projectRepo.project}/${cachedName}`;
	}
	
	try{
		// query for project name
		const repository = await createRepositoryResolver(window, projectRepo).resolve(projectRepo.repository);
		cacheRepositoryName(repository.id, repository.name);
		console.debug("Azure DevOps location", { ...projectRepo, repository: repository.name, source: "api" });
		return `${projectRepo.project}/${repository.name}`;
	} catch(error: unknown) {
		console.debug("Azure DevOps repository lookup failed", error);
		return null;
	}
}

let workItemIcon: "feature" | "story" | null = null;

function setWorkItemFavicon(){
	const kind = isFeatureWorkItem() ? "feature" : "story";
	if (kind === workItemIcon) return;
	workItemIcon = kind;
	if (kind === "feature") setFeatureFavicon(); else setUserStoryFavicon();
}

async function applyForCurrentLocation(){
	if (isWorkItemUrl(window.location.href)) {
		setWorkItemFavicon();
	} else {
		workItemIcon = null;
		const locationStr = await getLocationString();
		if(locationStr != null)
			setFavicon(locationStr);
	}
}

(async function(){
	watchTitle(() => {
		if (isWorkItemUrl(window.location.href)) setWorkItemFavicon();
	});
	await applyForCurrentLocation();
	watchLocationChange(() => void applyForCurrentLocation());
	con.print("%cAzDo loaded", "background-color:#DFD");
})();
