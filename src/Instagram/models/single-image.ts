import { con } from "~/lib/console";
import { saveBytesToFile } from "~/lib/download";
import { downloadAsync } from "~/lib/gm";
import { formatPhotoDate, isJpeg, jpegSize, type KeiblerMetadata, type KeiblerTagValue, rectString, writeJpegMetadata } from "~/lib/keibler-metadata";
import { type ListenFn, makeObservable, type ObservableHost } from "~/lib/observable";
import type { LTProgressHandler, TaskStatus } from "~/lib/progress-types";
import { by } from "~/lib/sorting";
import { throwExp } from "~/lib/throw";
import { formatDateForFilename } from "../date-formats";
import type { ImageCandidate, TaggedImageMedia, UserTagPosition, UserTags, VideoVersion } from "../extractors/ig-types";
import { bestDashVideo, downloadDashVideo } from "../services/best-video-download";
import { parseDashDuration } from "../services/dash-manifest";

type VideoSources = {
	versions?: VideoVersion[] | null;
	dashManifest?: string | null;
};

type SingleImageMediaArgs = TaggedImageMedia & {
	owner: string;
	date: Date;
	coauthors?: string[];
};

export class SingleImage implements ObservableHost<SingleImage> {

	public readonly owner: string; // so we can mark the download on the user when it finishes
	public readonly date: Date; // public to mark download in correct year
	public readonly taggedUsers: string[]; // public so we can display tagged users in the UI
	public readonly taggedUserIds: string[]; // pk/id of tagged users - usertags don't always carry a username
	public readonly coauthors: string[]; // usernames from Instagram's "collab post" coauthor_producers
	private readonly tagPositions: (UserTagPosition | undefined)[]; // parallel to taggedUsers; [x,y] as 0..1 fractions of the image

	// Questionable public props
	public readonly smallestUrl: string; // used by PicGroup as sanitizedImgUrl
	public readonly images: ImageCandidate[];

	public downloadProgress: TaskStatus = { status:'notStarted' }; // observable

	// Set when this media is a video: the largest progressive MP4 (has audio, usually <= 720p).
	public readonly videoUrl?: string;
	private readonly videoSize: number = 0; // larger dimension of videoUrl
	private readonly dashManifest?: string; // separate higher-quality video + audio tracks
	public readonly videoDuration?: number; // seconds - identifies which carousel slide is playing

	private readonly filename: string;
	private readonly largestUrl: string;

	public listen!: ListenFn<SingleImage>;

	constructor(taggedUsers: string[], taggedUserIds: string[], images: ImageCandidate[], owner: string, date: Date, coauthors: string[] = [], video: VideoSources = {}, tagPositions: (UserTagPosition | undefined)[] = []) {
		this.taggedUsers = taggedUsers;
		this.tagPositions = tagPositions;
		this.taggedUserIds = taggedUserIds;
		this.coauthors = coauthors;

		const nonSquareImages = images.filter(({ height, width }) => height !== width);
		// console.debug(`${nonSquareImages.length} of ${images.length} are non-square`);
		if (images.length * 40 <= nonSquareImages.length * 100)
			images = nonSquareImages;

		this.images = images.sort(by(({ height }) => height));
		this.smallestUrl = this.images[0].url;
		this.largestUrl = this.images[this.images.length - 1].url;

		this.owner = owner;
		this.date = date;

		const progressive = [...video.versions ?? []].sort(by(({ height }) => height)).pop();
		if (progressive) {
			this.videoUrl = progressive.url;
			this.videoSize = Math.max(progressive.width, progressive.height);
			this.dashManifest = video.dashManifest ?? undefined;
			this.videoDuration = this.dashManifest ? parseDashDuration(this.dashManifest) : undefined;
		}

		const ext = this.videoUrl ? ".mp4"
			: this.smallestUrl.includes(".webp") ? ".webp"
			: ".jpg";
		const uniqueUsernames = [...new Set([owner, ...coauthors, ...taggedUsers])];
		this.filename = uniqueUsernames.slice(0, 10).join(" ")
			+ " " + formatDateForFilename(date) + ext;

		makeObservable(this);
	}

	static fromMedia({ usertags, image_versions2, video_versions, video_dash_manifest, owner, date = throwExp("date"), coauthors = [] }: SingleImageMediaArgs): SingleImage {
		const taggedUsers:string[] = SingleImage.parseUserTags(usertags);
		const taggedUserIds:string[] = SingleImage.parseUserTagIds(usertags);
		return new SingleImage(taggedUsers, taggedUserIds, image_versions2.candidates, owner, date, coauthors,
			{ versions: video_versions, dashManifest: video_dash_manifest }, SingleImage.parseUserTagPositions(usertags));
	}

	// Same order as parseUserTags (which sorts usertags.in in place).
	static parseUserTagPositions(usertags: UserTags | undefined | null): (UserTagPosition | undefined)[] {
		try {
			return usertags ? usertags.in.map(x => x.position) : [];
		}
		catch {
			return [];
		}
	}

	static fromUrlAndOwner(url: string, imageWidth: number, imageHeight: number, owner: string): SingleImage {
		const imageCandidate: ImageCandidate = { url, width:imageWidth, height:imageHeight };
		return new SingleImage([], [], [imageCandidate], owner, new Date());
	}

	static parseUserTags(usertags: UserTags | undefined | null): string[] {
		try {
			return (
				usertags &&
				usertags.in
					.sort(by(({ position }) => position?.[0] ?? 0))
					.map((x: any) => x.user.username)
			) || [];
		}
		catch {
			return [];
		}
	}

	// Not all usertag responses carry position/username (e.g. the Tagged tab's
	// carousel usertags only have pk/id), so this doesn't depend on either.
	static parseUserTagIds(usertags: UserTags | undefined | null): string[] {
		try {
			return (usertags?.in ?? [])
				.map((x: any) => x.user?.pk ?? x.user?.id)
				.filter((id: unknown): id is string => typeof id === "string");
		}
		catch {
			return [];
		}
	}

	getThumbUrl(minSize = 0): string {
		const largerThanRequested = this.images.filter(({ width, height }) => minSize < Math.max(width, height));
		return largerThanRequested.length ? largerThanRequested[0].url : this.largestUrl;
	}

	// Downloads the cleaned-up URL of the requested url
	// async downloadAsync(requestedUrl:string,onprogress?:GMProgressHandler){ // $$$
	// 	const matching = this.images.filter(({url}) => url.includes(requestedUrl)).reverse();
	// 	await GM.downloadAsync({url:matching[0]?.url || requestedUrl, name:this.filename, onprogress });
	// 	this.downloaded=true;
	// 	con.print(`downloaded: ${this.filename}`);
	// }

	get isVideo(): boolean { return this.videoUrl !== undefined; }

	// Downloads the video if this is one (best quality, falling back to the progressive MP4),
	// otherwise the largest image.
	public async downloadLargestAsync(){
		this.downloadProgress = {status:'inProgress', loaded:0, total:1};
		const onprogress: LTProgressHandler = ({loaded,total}) => this.downloadProgress = {status:'inProgress', loaded, total};

		if (!await this.tryDownloadBestVideoAsync(onprogress) && !await this.tryDownloadJpegWithMetadataAsync()) {
			const url = this.videoUrl ?? this.largestUrl;
			const timeout = this.isVideo ? 5 * 60_000 : undefined; // default 5s is far too short for video
			await downloadAsync({url, name:this.filename, timeout, onprogress});
		}
		this.downloadProgress = {status:'complete'};
		con.print(`downloaded: ${this.filename}`);
	}

	// Fetches the image, embeds Keibler metadata (owner, tagged users + positions, date) and saves it.
	// Returns false for non-JPEGs, or if anything fails, so the caller can fall back to a plain download.
	private async tryDownloadJpegWithMetadataAsync(): Promise<boolean> {
		if (this.isVideo || !this.filename.endsWith(".jpg"))
			return false;
		try {
			const response = await fetch(this.largestUrl);
			if (!response.ok)
				throw new Error(`fetch ${response.status} ${response.statusText}`);
			const jpeg = new Uint8Array(await response.arrayBuffer());
			if (!isJpeg(jpeg))
				return false;
			saveBytesToFile(writeJpegMetadata(jpeg, this.buildMetadata(jpegSize(jpeg))), this.filename, "image/jpeg");
			return true;
		}
		catch (err) {
			con.print("image: embedding metadata failed, falling back to plain download", err);
			return false;
		}
	}

	// instagram tag group: owner first (bare string), then each tagged user (10x10 rect around the tag position when known).
	private buildMetadata(size: { w: number; h: number } | undefined): KeiblerMetadata {
		const R = 10;
		const instagram: KeiblerTagValue[] = [this.owner];
		this.taggedUsers.forEach((user, i) => {
			const pos = this.tagPositions[i];
			if (!pos || !size)
				instagram.push(user);
			else {
				const x = Math.max(0, Math.min(size.w - R, Math.round(pos[0] * size.w - R / 2)));
				const y = Math.max(0, Math.min(size.h - R, Math.round(pos[1] * size.h - R / 2)));
				instagram.push({ v: user, rect: rectString(x, y, R, R) });
			}
		});
		return {
			up: 0,
			tags: { instagram },
			...size && { imageSize: size },
			photoDate: formatPhotoDate(this.date),
		};
	}

	// Downloads the DASH video + audio tracks and muxes them into one MP4.
	// Returns false when there is nothing better than the progressive MP4, or anything fails.
	private async tryDownloadBestVideoAsync(onprogress: LTProgressHandler): Promise<boolean> {
		if (!this.dashManifest)
			return false;
		try {
			const best = bestDashVideo(this.dashManifest, this.videoSize);
			if (best == null) {
				con.print(`video: progressive ${this.videoSize}p is already the best quality`);
				return false;
			}
			const { video, audio } = best;
			con.print(`video: downloading %cbest quality%c ${video.width}x${video.height} (${video.label} ${video.codecs})`
				+ (audio ? ` + audio (${audio.codecs})` : " without audio"),
				"background:pink;color:black;padding:1px 4px", "");
			await downloadDashVideo(best, this.filename, onprogress);
			return true;
		}
		catch (err) {
			con.print(`video: best-quality download failed, falling back to progressive ${this.videoSize}p MP4`, err);
			return false;
		}
	}

}
