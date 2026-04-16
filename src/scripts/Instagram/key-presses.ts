
export type HotkeyAction = (() => void) | (() => Promise<void>);

export class HotkeyManager {
	private bindings = new Map<string, HotkeyAction>();

	start(): void {
		document.addEventListener("keydown", this.onKeyDown);
	}

	register(key: string, action: HotkeyAction): void {
		if (this.bindings.has(key))
			throw new Error(`Duplicate hotkey: ${key}`);
		this.bindings.set(key, action);
	}

	private onKeyDown = (event: KeyboardEvent): void => {

		if (this.isTypingTarget(event.target))
			return;

		const key = this.normalize(event);
		const action = this.bindings.get(key);

		if (!action) {
			if (!["Shift+Shift", "Ctrl+Control", "Alt+Alt"].includes(key))
				console.debug(`No action found for ${key}`);
			return;
		}

		event.preventDefault();
		action();
	};

	private normalize(event: KeyboardEvent): string {
		const parts: string[] = [];
		if (event.ctrlKey) parts.push("Ctrl");
		if (event.altKey) parts.push("Alt");
		if (event.shiftKey) parts.push("Shift");
		parts.push(event.key);
		return parts.join("+");
	}

	private isTypingTarget(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		return !!el && (
			el instanceof HTMLInputElement ||
			el instanceof HTMLTextAreaElement ||
			el.isContentEditable
		);
	}
}

