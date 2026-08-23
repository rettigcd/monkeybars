import { $, ElementBuilder } from "~/lib/dom3";
import { openInTab } from "~/lib/gm";
import { HotkeyManager } from "~/lib/hotkey-manager";
import type { TaskStatus } from "~/lib/progress-types";
import { throwNever } from "~/lib/throw";
import { PicGroup } from "../models/pic-group";
import { SingleImage } from "../models/single-image";
import { instaDom, pageOwnerName } from "../services/instaDom";
import { UserCtx } from "../user-ctx";

type SidePanelConstructorArgs = {
	batchProducer: { on(eventName: "batchReceived", handler: (batch: PicGroup[]) => void): void; };
};

type Css = Partial<CSSStyleDeclaration>;

type SeparatorArgs = {
	date: Date;
	owner: string;
	captionText?: string;
};

const newImageCss: Css = {
	border: "thick solid yellow",
	cursor: "pointer",
	maxWidth: "300px",
	maxHeight: "300px",
	width: "auto",
	height: "auto"
};


// Renders the fixed, collapsible side panel that streams incoming PicGroup batches as thumbnail rows. 
// Each row shows a separator with the owner, date, and download stats, 
// plus actions to open the owner's profile or mark them as newly tracked, 
// followed by clickable thumbnails that download the full image and show progress. Visibility of groups is
// driven by PicGroup.isVisible and can be toggled via registered hotkeys
// ("o" reopens the last closed group, "x" closes the first visible one).
export class SidePanel {
	private readonly picGroups: PicGroup[] = [];

	private readonly outerCss: Css = {
		position: "fixed",
		top: "5px",
		left: "150px",
		background: "#66C",
		padding: "2px",
		marginRight: "120px",
	};
	private readonly expandedHeight = "95%";
	private readonly containerCollapsedWidth = "100px"; // let user toggle it narrower to see what is behind stuff

	private readonly headerCss: Css = {
		marginTop: "2px",
		marginBottom: "2px",
		fontSize: "12px",
		lineHeight: "15px",
		fontWeight: "bold",
		fontFamily: "Tahoma",
		color: "white",
		display: "flex",
		justifyContent: "space-between",
		flexDirection: "row",
	};

	private readonly innerCss: Css = {
		overflowY: "auto",
		width: "100%",
		height: "100%",
	};

	private readonly separatorCss: Css = {
		background: "blue",
		height: "30px",
		display: "block",
		color: "white",
	};

	private readonly buttonCss: Css = {
		margin: "0 5px",
		cursor: "pointer",
		border: "2px outset",
		padding: "1px 4px",
		fontSize: "10px",
	};

	private readonly clickedButtonCss: Css = {
		cursor: "default",
		opacity: "0.5",
		pointerEvents: "none",
		border: "2px inset",
		display: "inline-block",
	};

	private readonly newImageSize = 300;
	private readonly elementId = "sidePanel";

	private readonly pageOwner?: string;

	private readonly openInTab: (url: string) => void;

	private outer?: HTMLDivElement;
	private headerTextEl?: HTMLSpanElement;
	private toggleEl?: HTMLSpanElement;
	private newImageContainer?: HTMLDivElement;
	private isExpanded = false;

	public constructor({
		batchProducer,
	}: SidePanelConstructorArgs) {
		this.pageOwner = pageOwnerName;
		this.openInTab = openInTab;

		batchProducer.on("batchReceived", (batch) => this.showNewBatches(batch));
	}

	public register(hotkeys:HotkeyManager): this{
		hotkeys.register("o", () => this.openLastClosed());
		hotkeys.register("x", () => this.closeFirst());
		return this;
	}

	public showNewBatches(batch: PicGroup[]): void {
		for (const picGroup of batch)
			if (picGroup.isNew)
				this.addNewGroup(picGroup);

		this.updateHeaderText();
	}

	public closeFirst(): void {
		const visibleModels = this.picGroups.filter((m) => m?.isVisible);
		if (visibleModels.length > 0)
			visibleModels[0].isVisible = false;
	}

	public openLastClosed(): void {

		const hiddenModels = this.picGroups
			.filter((m) => m && !m.isVisible)
			.reverse();

		if (hiddenModels.length > 0)
			hiddenModels[0].isVisible = true;
	}

	private ensureContainer(): HTMLDivElement | undefined {
		if (this.newImageContainer == null)
			this.createNewImageContainer();

		return this.newImageContainer;
	}

	private updateHeaderText(): void {
		if (!this.headerTextEl)
			return;

		const count = this.picGroups.filter((x) => x.isVisible).length;
		this.headerTextEl.textContent = `Groups: ${count}`;
	}

	private addNewGroup(picGroup: PicGroup): void {
		const container = this.ensureContainer();
		if (container == null)
			return;

		this.picGroups.push(picGroup);

		const rowDiv = this.buildGroupRow(picGroup);
		container.appendChild(rowDiv);

		picGroup.listen("isVisible", ({ newValue:isVisible }) => {
			rowDiv.style.display = isVisible ? "block" : "none";
			this.updateHeaderText();
		});
	}

	private buildGroupRow(picGroup: PicGroup): HTMLDivElement {
		const { owner, pics, captionText, date } = picGroup;

		return $("div")
			.withChildren(
				this.buildSeparator({ date, owner, captionText }),
				...pics.map((singleImage) => this.buildThumb(singleImage)),
			)
			.el;
	}

	private buildSeparator({
		date,
		owner,
		captionText,
	}: SeparatorArgs) {
		const userCtx = new UserCtx(owner);
		const isTracking = userCtx.isTracking;
		const onOwnersPage = owner === this.pageOwner;
		const downloadsInLastYear = userCtx.downloadsInLastYear;
		const totalDownloads = userCtx.totalDownloads;
		const downloadText = totalDownloads > 0
			? ` ↓ ${downloadsInLastYear}/${totalDownloads}`
			: "";

		return $("div")
			.cls("groupHeader")
			.css(this.separatorCss)
			.attr('title',captionText)
			.withChildren(
				this.buildSeparatorTitle({date,owner,downloadText,isTracking}),
				onOwnersPage
					? null
					: this.buildActionButton({
						text: "OPEN",
						onClick: (buttonEl) => {
							this.openInTab(`https://instagram.com/${owner}`);
							this.markButtonClicked(buttonEl, "OPENED");
						},
					}),
				(onOwnersPage || isTracking)
					? null
					: this.buildActionButton({
						text: "NEW - SAVE",
						onClick: (buttonEl) => {
							this.addOwnerToTracking(owner);
							this.markButtonClicked(buttonEl, "SAVED");
						},
					}),
			);
	}

	private buildSeparatorTitle({
			date,
			owner,
			downloadText,
			isTracking,
		}: {
		date: Date;
		owner: string;
		downloadText: string;
		isTracking: boolean;
	}) {
		return $("span").txt(`${date.toDateString()} (${owner})${downloadText}${isTracking ? " - TRACKING!" : ""}`);
	}

	private buildActionButton(args: {
		text: string;
		onClick: (buttonEl: HTMLElement) => void;
	}) {
		const { text, onClick } = args;

		return $("span")
			.txt(text)
			.css(this.buttonCss)
			.on("click", (event: Event) => {
				const buttonEl = event.currentTarget;
				if (!(buttonEl instanceof HTMLElement))
					return;

				onClick(buttonEl);
			});
	}

	private markButtonClicked(buttonEl: HTMLElement, newText: string): void {
		buttonEl.textContent = newText;
		Object.assign(buttonEl.style, this.clickedButtonCss);
	}

	private addOwnerToTracking(owner: string): void {
		const newOwners = this.getNewOwners();
		newOwners.push(`${owner}\t${Date.now()}`);
		this.saveNewOwners(newOwners);

		console.log(`Add ${owner} => ${newOwners.length}`);
	}

	private getNewOwners(): string[] {
		const value = localStorage.getItem("newOwners");
		return value ? value.split("\r\n") : [];
	}

	private saveNewOwners(newOwners: string[]): void {
		localStorage.setItem("newOwners", newOwners.join("\r\n"));
	}

	private buildThumb(singleImage: SingleImage) {
		let $img:ElementBuilder<HTMLImageElement>;
		const div = $('div')
			.css({ position: "relative", display: "inline-block"})
			.withChildren(
				$img = $("img")
				.attr("src", singleImage.getThumbUrl(this.newImageSize))
				.css(newImageCss)
				.on("click", () => singleImage.downloadLargestAsync())
			).el;
		let overlay: ElementBuilder<HTMLElement> | null = null;
		singleImage.listen('downloadProgress',({newValue:progress}:{newValue:TaskStatus})=>{
			switch(progress.status){
				case "notStarted": break;
				case "inProgress":
					$img.css({cursor:"wait"});
					overlay ??= $('div').css({position:"absolute",top:"0",right:"0",background:"white",padding:"2px",fontSize:"10px"}).appendTo(div);
					overlay.txt(`${Math.round((progress.loaded/progress.total)*100)}%`);
					break;
				case "complete":
					$img.css({cursor:"default",opacity:"0.3"});
					overlay?.txt("✓");
					break;
				case "error":
				case "timeout":
					overlay?.txt("❌");
					break;
				default:
					return throwNever(progress);
			}
		})
		return div;
	}

	private createNewImageContainer(): void {

		const newImageContainerBuilder = $("div").css(this.innerCss);

		const outerBuilder = $("div")
			.attr("id", this.elementId)
			.css(this.outerCss)
			.withChildren(
				this.buildHeader(),
				newImageContainerBuilder,
			)
			.appendTo(instaDom.body);

		this.outer = outerBuilder.el;
		this.newImageContainer = newImageContainerBuilder.el;

		this.setExpanded(false);
	}

	private setExpanded(expanded: boolean): void {
		this.isExpanded = expanded;

		if (this.toggleEl)
			this.toggleEl.textContent = expanded ? "<<" : ">>";

		if (this.outer) {
			this.outer.style.width = expanded ? "auto" : this.containerCollapsedWidth;
			this.outer.style.height = expanded ? this.expandedHeight : "auto";
		}

		if (this.newImageContainer)
			this.newImageContainer.style.display = expanded ? "block" : "none";
	}

	private buildHeader() {
		const headerTextBuilder = $("span").txt("Groups: 0");
		this.headerTextEl = headerTextBuilder.el;

		const toggleBuilder = $("span")
			.txt(">>")
			.css({ cursor: "pointer" })
			.on("click", () => this.setExpanded(!this.isExpanded));
		this.toggleEl = toggleBuilder.el;

		return $("h2")
			.css(this.headerCss)
			.withChildren(
				headerTextBuilder,
				toggleBuilder,
			);
	}
}