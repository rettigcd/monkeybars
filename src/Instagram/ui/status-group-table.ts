import { $ } from "~/lib/dom3";
import { by } from "~/lib/sorting";
import { pageOwnerName } from "../services/instaDom";
import type { StatusGroupTree } from "../status-group-tree";
import type { UserCtx } from "../user-ctx";


export function makeStatusGroupTable(tree:StatusGroupTree){
	const $td = () => $('td').css({padding:"0 2px", lineHeight:"16px", fontSize:"12px"});
	const $total = () => $td().css({textAlign:"right"}).txt('total:');
	const $num = (num:number) => $td().css({textAlign:"right"}).txt(String(num));
	const $label = (label:string) => $td().txt(label); 
	const $link = (users:UserCtx[]) => {
		users = users.filter(x=>x.username != pageOwnerName);
		return $td().css({textAlign:"right"}).withChildren(
			users.length 
				? $('a').attr('href', `/${users[0].username}/`).txt(String(users.length)) 
				: $('span').txt('0')
			)
	}
	const $linkPair = (label:string,users:UserCtx[]) => {
		users = users.filter(x => x.username != pageOwnerName);
		return 0 < users.length ? [$label(label), $link(users)] : [];
	}
	const visitColor = '#8080F0', dlColor = '#F08080';
	const $titleRow = (label:string,colSpan:number,bgColor:string,total:number) =>
		$('tr').css({backgroundColor:bgColor}).withChildren( $td().txt(label).attr('colspan',String(colSpan)), $total(), $num(total) );
	return $('table').css({borderCollapse:"collapse"}).withChildren(

		$titleRow('Not Visited', 4, visitColor, tree.notVisited.total),
		$('tr').withChildren(
			...$linkPair('followee', tree.notVisited.has.followee),
			...$linkPair('nothing', tree.notVisited.has.nothing),
			...$linkPair('downloads', tree.notVisited.has.downloads),
		),

		$titleRow('Visited', 4, visitColor, tree.visited.total),
		$('tr').withChildren(
			$label('Recent'), $num(tree.visited.recent.length),
			...$linkPair('Stale', tree.visited.stale.sort(by<UserCtx,number>(x=>x.refreshTime))),
		),

		$titleRow('No Downloads',3, dlColor, tree.visited.noDownloads.total),
		$('tr').withChildren(
			...$linkPair('followee', tree.visited.noDownloads.has.followee),
			...$linkPair('nothing', tree.visited.noDownloads.has.nothing),
		),

		$titleRow('Has Downloads',3, dlColor, tree.visited.hasDownloads.total),
		$('tr').withChildren(
			$label('producing'), $num(tree.visited.hasDownloads.producing.length),
			...$linkPair('idle', tree.visited.hasDownloads.idle),
		),
	)
}