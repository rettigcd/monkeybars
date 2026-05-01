// ==UserScript==
// @name         SNL Standby Line
// @namespace    http://tampermonkey.net/
// @version      2
// @description  Snag SNL Standby Line tickets.
// @author       Dean Rettig
// @run-at       document-start
// @match        https://bookings-us.qudini.com/booking-widget/events/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nbc.com
// @grant        GM_download
// @grant        unsafeWindow
// ==/UserScript==

import { SyncedPersistentDict } from "~/lib/storage";
import { buildSnooper } from "./build-snooper";
import { ConfigModel, type ConfigRepo, ConfigService } from "./config";
import { downloadLogsOnUnload } from "./flush-logs";
import { TimeStampConsoleLogger } from "./logging";
import { Reloader } from "./reloader";
import { Submitter } from "./submitter";
import { formatSeconds, getNextThursday10Am, SECONDS } from "./time-format";
import { generateView } from "./views/top-bar";
import { ShowService } from "./waiting/show-service";
import { Waiter } from "./waiting/waiter";
import { type SnlWindow } from "./window";

declare const unsafeWindow: SnlWindow;

const liveShow = "LIVE SHOW"; // LIVE SHOW STANDBY - Saturday Night Live
const dressRehearsal = "DRESS REHEARSAL"; // DRESS REHEARSAL STANDBY - Saturday Night Live
const snlOrgId = "B9KIOO7ZIQF";

// ===============
// ::Init
// ===============
async function initPageAsync(): Promise<void> {
	let waitForShowsTimeout = 2 * SECONDS;

	const match = document.location.href.match(/events\/([^#/]+)(.*\/event\/([^#/]+))?/);
	if (!match)
		throw new Error(`Could not parse event URL: ${document.location.href}`);

	const [, orgId, , eventId] = match;
	const isSnl = orgId === snlOrgId;

	const logger = new TimeStampConsoleLogger();
	const snooper = buildSnooper(unsafeWindow);
	const showService = new ShowService(orgId, snooper, logger, unsafeWindow);
	const waiter = new Waiter(showService, snooper, logger, waitForShowsTimeout);
	const configRepo: ConfigRepo = new SyncedPersistentDict<ConfigModel>(orgId);
	const myConfig = new ConfigService(configRepo,["[none]", liveShow, dressRehearsal]);
	const submitter = new Submitter(myConfig.model, showService, logger);
	const reloader = new Reloader(logger);

	myConfig.model.configOptions = configRepo.keys();
	myConfig.model.configName = configRepo.entries().filter(([, values]) => values.isDefault).map(([name]) => name)[0] ?? "";

	downloadLogsOnUnload(`snl ${orgId}`, snooper, logger);
	let goTime = getNextThursday10Am(myConfig.model.msDelay);

	unsafeWindow.cmd = {
		waiter,
		showService,
		myConfig,
		snooper,
		logger,
		formatSeconds,
		snoopLog: snooper._loadLog
	};


	// Start...
	logger.log({
		action: "start",
		orgId,
		configName: myConfig.model.configName,
		show: myConfig.model.show,
		isSnl,
		eventId,
	});

	// wait for shows to load

	// WTH does this do?
	const initial = await showService.waitForShowCountAsync();

	logger.log(`Initial show counts: ${initial.showCount} from ${initial.reason}`);

	// View
	generateView({ myConfig, waiter, submitterStatus:submitter.status });

	// If we have shows
	if (initial.showCount) {
		// Submit
		submitter.monitor();
		return;
	}
	
	// Wait
	const now = Date.now();
	const reloadTime = now < goTime.valueOf() ? goTime : new Date();
	const result = await waiter.waitAsync(reloadTime, waitForShowsTimeout);
	if (result.shouldReload) // !!! When should we NOT reload???
		reloader.reload(result.reason);
}

void initPageAsync();

queueMicrotask(	console.debug.bind(console,"%cSNL Standby - loaded","background-color:#DFD;",) ); // Last line of file