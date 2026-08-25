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
import { cacheRepositoryName, getCachedRepositoryName } from "./repository-cache";
import { createRepositoryResolver } from "./repository-resolver";
import { snoopAzureDevOpsRequests } from "./snoop";
import { projectRepo } from "./url";

async function getLocationString(){
	if (projectRepo == null) return null;

	const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(projectRepo.repository);
	// Is project name
	if(!isGuid)
		return `${projectRepo.project}/${projectRepo.repository}`;

	// Cache has project name
	const cachedName = getCachedRepositoryName(projectRepo.repository);
	if (cachedName != null) {
		console.debug("Azure DevOps location", { ...projectRepo, repository: cachedName, source: "cache" });
		return `${projectRepo.project}/${cachedName}`;
	}
	
	snoopAzureDevOpsRequests(window);

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

(async function(){
	const locationStr = await getLocationString();
	if(locationStr != null)
		setFavicon(locationStr);
	con.print("%cAzDo loaded", "background-color:#DFD");
})();
