import { SyncedPersistentDict } from "~/lib/storage";

import { HotkeyManager } from "../../lib/hotkey-manager";
import { type SnlWindow } from "../../snl/window";
import { BatchProducerGroup } from "../extractors/batch-producer-group";
import { InitialLocationPageParser } from "../extractors/location/initial-location-page-parser";
import { LocationContent } from "../extractors/location/location-content";
import { DetailsPopup } from "../extractors/misc/details-popup";
import type { LocalStorageLocationEntity } from "../local-storage";
import { ImageLookupByUrl } from "../services/image-lookup-by-url";
import { buildRequestSnooper } from "../services/snoopBuilder";
import { loadTimeMs, reportLast } from "../services/storage-time";
import { UserUpdateService } from "../trackers/user-update-service";
import { Gallery } from "../ui/gallery";
import { SidePanel } from "../ui/side-panel";
import { UserReports } from "../user-reports";

type LocationPageConstructor = {
	win: SnlWindow;
	hotkeys: HotkeyManager;
};

type LocationPageContext = {
	snoopLog: unknown;
	iiLookup: ImageLookupByUrl;
	location: string;
	locRepo: SyncedPersistentDict<LocalStorageLocationEntity>;
	gallery: Gallery;
	sidePanel: SidePanel;
	startingState: LocalStorageLocationEntity;
	reports: UserReports | null;
	track?: () => void;
	stop?: () => void;
};

export class LocationPage {
	constructor({ win, hotkeys }: LocationPageConstructor) {
		const snooper = buildRequestSnooper(win);
		const locRepo = new SyncedPersistentDict<LocalStorageLocationEntity>("locations");

		const { id, slug } = this.parseLocationUrl(location.href);

		const locationKey = `${slug} ${id}`;
		const isTracking = locRepo.containsKey(locationKey);

		const startingState: LocalStorageLocationEntity = isTracking
			? structuredClone(locRepo.get(locationKey))
			: {} as LocalStorageLocationEntity;

		console.log(locationKey, JSON.stringify(startingState, null, "\t"));
		reportLast(startingState.lastVisit, "Visit");

		const batchProducer = new BatchProducerGroup(startingState.lastVisit, [
			new InitialLocationPageParser(),
			new LocationContent(snooper),
			new DetailsPopup(snooper),
		]);

		new UserUpdateService({ batchProducer });

		const gallery = new Gallery({ batchProducer });
		const sidePanel = new SidePanel({ batchProducer });
		sidePanel.register(hotkeys);

		const iiLookup = new ImageLookupByUrl(batchProducer);
		iiLookup.on("missingImage", snooper.checkLogForMissingImage);

		const cmd: LocationPageContext = {
			snoopLog: snooper._loadLog,
			iiLookup,
			location: locationKey,
			locRepo,
			gallery,
			sidePanel,
			startingState,
			reports: null,
		};

		const reports = new UserReports({ iiLookup });

		cmd.reports = reports;
		win.cmd = cmd;

		if (isTracking) {
			locRepo.update(locationKey, (x) => {
				x.lastVisit = loadTimeMs;
			});
		} else {
			cmd.track = () => {
				locRepo.update(locationKey, (u) => {
					u.slug = slug;
					u.id = id;
					u.lastVisit = loadTimeMs;
				});
			};
		}

		cmd.stop = () => {
			if (confirm(`Remove all tracking info for ${locationKey}?`)) {
				locRepo.remove(locationKey);
			}
		};
	}

	private parseLocationUrl(url: string): { id: string; slug: string } {
		const match = url.match(
			/instagram\.com\/explore\/locations\/(?<id>[^/]+)\/(?<slug>[^/]+)/
		);

		if (!match?.groups) {
			throw new Error(`Could not parse Instagram location URL: ${url}`);
		}

		return {
			id: match.groups.id,
			slug: match.groups.slug,
		};
	}
}