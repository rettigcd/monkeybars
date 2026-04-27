import { $ } from "~/lib/dom3";

type NextLinkConstructorArgs = {
	label: string;
	nextUrl?: string;
	count: number;
};

type UserLike = {
	username?: string | null;
};

export class NextLink {
	public readonly label: string;
	public readonly nextUrl?: string;
	public readonly count: number;

	public constructor({ label, nextUrl, count }: NextLinkConstructorArgs) {
		this.label = label;
		this.nextUrl = nextUrl;
		this.count = count;
	}

	public goto(): void {
		console.log(`${this.count} ${this.label}.`);

		if (this.nextUrl) {
			window.setTimeout(() => {
				window.location.href = this.nextUrl!;
			}, 2000);
		}
	}

	public appendTo(host: Node): void {
		const { label, nextUrl, count } = this;
		if (!nextUrl)
			return;

		$("div")
			.txt(`${label}: ${count}`)
			.css({
				textDecoration: "underline",
				cursor: "pointer",
				fontSize: "12px",
			})
			.on("click", () => {
				window.location.href = nextUrl;
			})
			.appendTo(host);
	}

	public static forFirstUser(label: string, users: UserLike[]): NextLink {
		const firstUsername = users[0]?.username;
		const nextUrl = firstUsername ? `/${firstUsername}/` : undefined;

		return new NextLink({
			label,
			count: users.length,
			nextUrl,
		});
	}
}