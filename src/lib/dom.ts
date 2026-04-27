export function qs<TElement extends Element>(selector: string, root = document): TElement | null {
	return root.querySelector<TElement>(selector);
}

export function qsa<TElement extends Element>(selector: string, root = document): TElement[] {
	return Array.from(root.querySelectorAll<TElement>(selector));
}

type Child = Node | string | number | null | undefined | Child[];

type CreateOptions<K extends keyof HTMLElementTagNameMap> = {
	text?: string;
	classes?: string[];
	attrs?: Record<string, string>;
	style?: Partial<CSSStyleDeclaration>;
	children?: Child[];
	parent?: Node;
	init?: (element: HTMLElementTagNameMap[K]) => void;
};

function appendChildren(element: Element, children: Child[]): void {
	for (const child of children) {
		if (Array.isArray(child)) {
			appendChildren(element, child);
			continue;
		}

		if (child == null)
			continue;

		element.append(child instanceof Node ? child : String(child));
	}
}

export function create<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	options: CreateOptions<K> = {},
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);

	if (options.text != null)
		element.textContent = options.text;

	if (options.classes?.length)
		element.classList.add(...options.classes);

	if (options.attrs)
		for (const [name, value] of Object.entries(options.attrs))
			element.setAttribute(name, value);

	if (options.style)
		Object.assign(element.style, options.style);

	if (options.children)
		appendChildren(element, options.children);

	options.init?.(element);

	if (options.parent)
		options.parent.appendChild(element);

	return element;
}