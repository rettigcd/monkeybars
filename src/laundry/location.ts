
export class MyLocation {
	public propertyId: any;
	public roomId: any;
	public propertyName!: string;
	public roomName!: string;

	constructor(){
		const regEx = /laundryview.com\/home\/(\d+)\/(\d+)\/([^\/]+)\/([^\/]+)/;
		const [,propertyId,roomId,propertyName,roomName] = notNull(document.location.href.match(regEx),'urlMatch');
		Object.assign(this,{ propertyId, roomId, propertyName, roomName });
	}

	toString(){ return `the ${this.roomName}(${this.roomId}) room at ${this.propertyName}(${this.propertyId})`; }
}

export function notNull<T>(src:T|null|undefined, label:string = 'object'):NonNullable<T>{
	if(src===null || src === undefined)
		throw new Error(`${label} was null or undefined.` );
	return src;
}

export function assertNotNull<T>( src: T | null | undefined, label = "object" ): asserts src is NonNullable<T> {
	if (src == null)
		throw new Error(`${label} was null or undefined.`);
}