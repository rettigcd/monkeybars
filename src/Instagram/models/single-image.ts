import { con } from "~/lib/console";
import { downloadAsync } from "~/lib/gm";
import { type ListenFn, makeObservable, type ObservableHost } from "~/lib/observable";
import type { LTProgressHandler, TaskStatus } from "~/lib/progress-types";
import { by } from "~/lib/sorting";
import { throwExp } from "~/lib/throw";
import { formatDateForFilename } from "../date-formats";
import type { ImageCandidate, TaggedImageMedia, UserTags, VideoVersion } from "../extractors/ig-types";
import { bestDashVideo, downloadDashVideo } from "../services/best-video-download";

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

	// Questionable public props
	public readonly smallestUrl: string; // used by PicGroup as sanitizedImgUrl
	public readonly images: ImageCandidate[]; // used by iiLookup for unknown reason

	public downloadProgress: TaskStatus = { status:'notStarted' }; // observable

	// Set when this media is a video: the largest progressive MP4 (has audio, usually <= 720p).
	public readonly videoUrl?: string;
	private readonly videoSize: number = 0; // larger dimension of videoUrl
	private readonly dashManifest?: string; // separate higher-quality video + audio tracks

	private readonly filename: string;
	private readonly largestUrl: string;

	public listen!: ListenFn<SingleImage>;

	constructor(taggedUsers: string[], taggedUserIds: string[], images: ImageCandidate[], owner: string, date: Date, coauthors: string[] = [], video: VideoSources = {}) {
		this.taggedUsers = taggedUsers;
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
			{ versions: video_versions, dashManifest: video_dash_manifest });
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

		if (!await this.tryDownloadBestVideoAsync(onprogress)) {
			const url = this.videoUrl ?? this.largestUrl;
			const timeout = this.isVideo ? 5 * 60_000 : undefined; // default 5s is far too short for video
			await downloadAsync({url, name:this.filename, timeout, onprogress});
		}
		this.downloadProgress = {status:'complete'};
		con.print(`downloaded: ${this.filename}`);
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
			con.print(`video: downloading best quality ${video.width}x${video.height} (${video.label} ${video.codecs})`
				+ (audio ? ` + audio (${audio.codecs})` : " without audio"));
			await downloadDashVideo(best, this.filename, onprogress);
			return true;
		}
		catch (err) {
			con.print(`video: best-quality download failed, falling back to progressive ${this.videoSize}p MP4`, err);
			return false;
		}
	}

}
