import { type ObservableHost } from "~/lib/observable";
import { ConfigModel, type ShowType } from "./config";

export type TextInputLike = { value: string; addEventListener(type: "input", listener: EventListener): void; };
//export type CheckboxLike = { checked: boolean; on(eventName: "click", handler: () => void): void; };

export type StringKeys<T>    = { [K in keyof T]-?: T[K] extends string ? K : never }[keyof T];
export type StringishKeys<T> = { [K in keyof T]-?: T[K] extends string | undefined ? K : never }[keyof T];
export type BooleanKeys<T> = { [K in keyof T]-?: T[K] extends boolean ? K : never }[keyof T];
export type StringArrayKeys<T> = { [K in keyof T]-?: T[K] extends string[] ? K : never }[keyof T];

// type SelectLike = { value: string; addEventListener(type: "change", listener: EventListener): void; };
// type SelectOptionsLike = { 
// 	children: ArrayLike<{ innerText: string; }> | HTMLCollection;
// 	remove(option: Element): void;
// 	add(option: HTMLOptionElement): void;
// };

export const bind = {
	textInput: function( input: TextInputLike, host: ObservableHost<ConfigModel>, prop: StringKeys<ObservableHost<ConfigModel>> ): void {
		input.value = host[prop];
		input.addEventListener("input", () => { host[prop] = input.value; });
		host.listen(prop, ({ newValue }) => { if (input.value !== newValue) input.value = newValue; });
	},

	checkbox: function (cb: HTMLInputElement, host: ObservableHost<ConfigModel>, prop: BooleanKeys<ConfigModel> ): void {
		cb.checked = host[prop];
		cb.addEventListener("click", () => { host[prop] = cb.checked; });
		host.listen(prop, ({ newValue }) => { if (cb.checked !== newValue) cb.checked = newValue; });
	},

	selectValue: function( select: HTMLSelectElement, host: ObservableHost<ConfigModel>, prop: StringKeys<ConfigModel> ): void {
		select.value = host[prop];
		select.addEventListener("change", () => { host[prop] = select.value; });
		host.listen(prop, ({ newValue }) => { if (select.value !== newValue) select.value = newValue; });
	},

	selectShowValue: function( select: HTMLSelectElement, host: ObservableHost<ConfigModel>, prop: "show" ): void {
		select.value = host[prop] ?? "";
		select.addEventListener("change", () => { host[prop] = select.value === "" ? undefined : select.value as ShowType; });
		host.listen(prop, ({ newValue }) => { const value = newValue ?? ""; if (select.value !== value) select.value = value; });
	},


	optionsToStringArr: function( select: HTMLSelectElement, host: ObservableHost<ConfigModel>, prop: StringArrayKeys<ConfigModel> ): void {
		function setOptions(newOptions: string[]): void {
			const valsToAdd = [...newOptions];

			[...select.children].forEach(o => {
				const text = (o as HTMLOptionElement).innerText;
				const idx = valsToAdd.indexOf(text);
				if (idx === -1)
					select.removeChild(o);
				else
					valsToAdd.splice(idx, 1);
			});

			for (const n of valsToAdd)
				select.add(new Option(n,n));
		}

		setOptions(host[prop]);
		host.listen(prop, ({ newValue }) => setOptions(newValue));
	},

};
