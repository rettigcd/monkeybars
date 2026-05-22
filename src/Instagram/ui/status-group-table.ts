import { $ } from "~/lib/dom3";
import type { StatusGroupTree } from "../status-group-tree";
import type { UserCtx } from "../user-ctx";


export function makeStatusGroupTable(tree:StatusGroupTree){
	const $td = () => $('td').css({padding:"0 2px", lineHeight:"14px", fontSize:"10px"});
	const $total = () => $td().css({textAlign:"right"}).txt('total:');
	const $num = (num:number) => $td().css({textAlign:"right"}).txt(String(num));
	const $link = (users:UserCtx[]) => $td().css({textAlign:"right"}).withChildren($('a').attr('href','').txt(String(users.length)));
	const visitColor = '#8080F0', dlColor = '#F08080';
	const $titleRow = (label:string,colSpan:number,bgColor:string,total:number) =>
		$('tr').css({backgroundColor:bgColor}).withChildren( $td().txt(label).attr('colspan',String(colSpan)), $total(), $num(total) );
	return $('table').css({borderCollapse:"collapse"}).withChildren(
		$titleRow('Not Visited', 4, visitColor, tree.notVisited.total),
		$('tr').withChildren(
			$td().txt('followee'), $link(tree.notVisited.has.followee),
			$td().txt('nothing'), $link(tree.notVisited.has.nothing),
			$td().txt('downloads'), $link(tree.notVisited.has.downloads),
		),

		$titleRow('Visited', 4, visitColor, tree.visited.total),
		$('tr').withChildren(
			$td().txt('Fresh'), $num(tree.visited.fresh.length),
			$td().txt('Stale'), $link(tree.visited.stale),
		),

		$titleRow('No Downloads',3, dlColor, tree.visited.noDownloads.total),
		$('tr').withChildren(
			$td().txt('followee'), $link(tree.visited.noDownloads.has.followee),
			$td().txt('nothing'), $link(tree.visited.noDownloads.has.nothing),
		),

		$titleRow('Has Downloads',3, dlColor, tree.visited.hasDownloads.total),
		$('tr').withChildren(
			$td().txt('producing'), $link(tree.visited.hasDownloads.producing),
			$td().txt('idle'), $link(tree.visited.hasDownloads.idle),
		),
	)
}