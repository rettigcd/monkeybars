import type { LocalStorageUserEntity } from "./types/local-storage";

export class LastYear{
	username: string;
	lastYear: number;
	lastCount: number;
	viewDate?: number;

	constructor([ username, {dl,viewDate} ]:[ string, LocalStorageUserEntity ]){
		this.username = username;
		this.viewDate = viewDate;

		const defaultLastYear = 1980;
		if(dl === undefined){
			this.lastYear = defaultLastYear;
			this.lastCount = 0;
		} else {
			this.lastYear = Math.max(...Object.keys(dl).map(x=>Number(x))) || defaultLastYear;
			this.lastCount = dl![this.lastYear] || 0;
		}
	}

}
