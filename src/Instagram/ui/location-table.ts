import { $ } from "~/lib/dom3";
import { DAYS } from "~/lib/time";
import { byDesc } from "~/lib/sorting";
import type { SyncedPersistentDict } from "~/lib/storage";
import type { LocalStorageLocationEntity } from "../local-storage";

const tdCss = { padding: "0 4px", lineHeight: "16px", fontSize: "12px" };
const daysCss = { ...tdCss, textAlign: "right" };

export function makeLocationTable(locRepo: SyncedPersistentDict<LocalStorageLocationEntity>) {
	const $td = () => $("td").css(tdCss);
	const $th = () => $("td").css(tdCss).css({ fontWeight: "bold" });

	const rows = locRepo.values()
		.filter(({ lastVisit }) => lastVisit !== undefined)
		.map(({ slug, id, lastVisit }) => ({
			slug,
			id,
			days: Math.floor((Date.now() - lastVisit!) / DAYS),
		}))
		.sort(byDesc(x => x.days));

	const dataRows = rows.map(({ slug, id, days }) =>
		$("tr").css({ display: "none" }).withChildren(
			$td().withChildren(
				$("a").txt(slug).attr("href", `https://www.instagram.com/explore/locations/${id}/${slug}/recent/`),
			),
			$td().css(daysCss).txt(String(days)),
		)
	);

	let visible = false;
	const titleRow = $("tr").css({ cursor: "pointer" }).withChildren(
		$th().txt("slug"), $th().css({ textAlign: "right" }).txt("days"),
	).on("click", () => {
		visible = !visible;
		for (const row of dataRows)
			row.css({ display: visible ? "table-row" : "none" });
	});

	return $("table").css({ borderCollapse: "collapse" }).withChildren(
		titleRow,
		...dataRows,
	);
}
