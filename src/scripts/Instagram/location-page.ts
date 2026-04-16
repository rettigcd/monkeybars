import { SnoopedWindow } from "~/utils/snoop";
import { SyncedPersistentDict } from "~/utils/storage";

import { BatchProducerGroup } from "./batch-producer-group";
import { LocationContent, LocationContentConnection } from "./extractors/graphql-edge-finder";
import { InitialLocationPageParser } from "./extractors/initial-location-page-parser";
import { Location1Posts } from "./extractors/location-1-posts";
import { Location2Posts } from "./extractors/location-2-posts";
import { HotkeyManager } from "./key-presses";
import { ImageLookupByUrl } from "./models";
import { LocationEntity, UserEntity } from "./repo-types";
import { buildRequestSnooper } from "./snoopBuilder";
import { loadTimeMs, reportLast } from "./storage-time";
import { UserUpdateService } from "./trackers/user-update-service";
import { Gallery } from "./ui/gallery";
import { SidePanel } from "./ui/side-panel";
import { UserReports } from "./user-reports";

type LocationPageConstructor = {
	unsafeWindow: SnoopedWindow;
	hotkeys: HotkeyManager;
};

type LocationPageContext = {
	snoopLog: unknown;
	userRepo: SyncedPersistentDict<UserEntity>;
	iiLookup: ImageLookupByUrl;
	location: string;
	locRepo: SyncedPersistentDict<LocationEntity>;
	gallery: Gallery;
	sidePanel: SidePanel;
	startingState: LocationEntity;
	reports: UserReports | null;
	track?: () => void;
	stop?: () => void;
};

export class LocationPage {
	constructor({ unsafeWindow, hotkeys }: LocationPageConstructor) {
		const userRepo = new SyncedPersistentDict<UserEntity>("users");
		const snooper = buildRequestSnooper(unsafeWindow);
		const locRepo = new SyncedPersistentDict<LocationEntity>("locations");

		const { id, slug } = this.parseLocationUrl(location.href);

		const locationKey = `${slug} ${id}`;
		const isTracking = locRepo.containsKey(locationKey);

		const startingState: LocationEntity = isTracking
			? structuredClone(locRepo.get(locationKey))
			: {} as LocationEntity;

		console.log(locationKey, JSON.stringify(startingState, null, "\t"));
		reportLast(startingState.lastVisit, "Visit");

		const batchProducer = new BatchProducerGroup(startingState.lastVisit, [
			new Location1Posts({ snooper, startingState, locRepo }),
			new Location2Posts(snooper),
			new LocationContent(snooper),
			new LocationContentConnection(snooper),
			new InitialLocationPageParser(),
		]);

		new UserUpdateService({ userRepo, batchProducer });

		const gallery = new Gallery({ batchProducer });
		const sidePanel = new SidePanel({ batchProducer, userRepo });
		sidePanel.register(hotkeys);

		const iiLookup = new ImageLookupByUrl(batchProducer);
		iiLookup.on("missingImage", snooper.checkLogForMissingImage);

		const ctx: LocationPageContext = {
			snoopLog: snooper._loadLog,
			userRepo,
			iiLookup,
			location: locationKey,
			locRepo,
			gallery,
			sidePanel,
			startingState,
			reports: null,
		};

		const reports = new UserReports({ userRepo, iiLookup });

		ctx.reports = reports;
		(unsafeWindow as SnoopedWindow & {cmd:any}).cmd = ctx;

		if (isTracking) {
			locRepo.update(locationKey, (x) => {
				x.lastVisit = loadTimeMs;
			});
		} else {
			ctx.track = () => {
				locRepo.update(locationKey, (u) => {
					u.slug = slug;
					u.id = id;
					u.lastVisit = loadTimeMs;
				});
			};
		}

		ctx.stop = () => {
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