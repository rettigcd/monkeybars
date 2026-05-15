// Timestamp helper methods for timestamps stored in Unix time
export class Ts{

	static format(seconds:number){ return new Date(seconds*1000).toLocaleString(); }
	// returns Unix time which is seconds since Epoch (Jan 1, 1970)

	static now(){
		const msSinceEpoch = new Date().valueOf(); // Javascript uses milliSeconds since Epoch
		return Math.floor(msSinceEpoch/1000); // convert to seconds - this is Unix time.
	}
	
}
