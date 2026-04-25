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

import { SyncedPersistentDict } from "~/utils/storage";
import { buildSnooper } from "./build-snooper";
import { ConfigModel, type ConfigRepo, ConfigService } from "./config";
import { downloadLogsOnUnload } from "./flush-logs";
import { TimeStampConsoleLogger } from "./logging";
import { ShowService } from "./show-service";
import { Submitter } from "./submitter";
import { formatSeconds, getNextThursday10Am, SECONDS } from "./time-format";
import { generateView } from "./views/top-bar";
import { Waiter } from "./waiter";
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
	if (!match) {
		throw new Error(`Could not parse event URL: ${document.location.href}`);
	}

	const [, orgId, , eventId] = match;
	const isSnl = orgId === snlOrgId;

	const logger = new TimeStampConsoleLogger();
	const snooper = buildSnooper(unsafeWindow);
	const showService = new ShowService(orgId, snooper, logger, unsafeWindow);
	const waiter = new Waiter(showService, logger, waitForShowsTimeout);
	const configRepo: ConfigRepo = new SyncedPersistentDict<ConfigModel>(orgId);
	const myConfig = new ConfigService(configRepo,["[none]", liveShow, dressRehearsal]);
	const submitter = new Submitter(myConfig.model, showService, logger);

	myConfig.model.configOptions = configRepo.keys();
	myConfig.model.configName =
		configRepo
			.entries()
			.filter(([, values]) => values.isDefault)
			.map(([name]) => name)[0] ?? "";

	downloadLogsOnUnload(`snl ${orgId}`, snooper, logger);
	let goTime = getNextThursday10Am(myConfig.model.msDelay);

	if (localStorage.testUi) {
		delete localStorage.testUi;

		goTime = new Date(Date.now() + 5 * SECONDS);
		waitForShowsTimeout = 10 * SECONDS;

		const showShowsAfter = 5 * SECONDS;
		const showTime = goTime.valueOf() + showShowsAfter;

		Object.assign(showService, {
			showTime,
			waitForShowCountAsync() {
				return Promise.resolve({ showCount: 0, reason: "timeout" as const });
			},
			fetchShowsAsync() {
				const hasShows = Date.now() >= showTime;
				return Promise.resolve(hasShows ? ["show1", "show2"] : []);
			},
		});

		Object.assign(waiter, {
			reload() {
				logger.log("RELOAD-STUB called!");
			},
		});

		console.log("DUDE - TESTING");
	}

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
	const initial = await showService.waitForShowCountAsync();
	logger.log(`Initial show counts: ${initial.showCount} from ${initial.reason}`);

	// View
	generateView({ myConfig, waiter, submitterStatus:submitter.status });

	if (initial.showCount) {
		if (!isSnl)
			submitter.stubSubmit();
		submitter.monitor();
	} else if (Date.now() < goTime.valueOf()) {
		waiter.scheduleNext(goTime, waitForShowsTimeout);
	} else {
		waiter.reloadWhenShowsAppear(waitForShowsTimeout);
	}

	unsafeWindow.cmd = {
		waiter,
		showService,
		myConfig,
		snooper,
		logger,
		initial,
		formatSeconds,
	};

	unsafeWindow.snooper = snooper;
}

void initPageAsync();

queueMicrotask(	console.debug.bind(console,"%cSNL Standby - loaded","background-color:#DFD;",) ); // Last line of file