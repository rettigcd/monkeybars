import { ElementBuilder } from "~/lib/dom3";

export class Importer{
	constructor($import: ElementBuilder<HTMLInputElement>){

		const importFileAsync = async (file:Blob,key:string) => {
			localStorage[key] = await this.readFileAsync(file);
			console.log(`${key} loaded from file.`);
		}

		$import.on('change',function(event) {
			for(const file of (event.currentTarget! as HTMLInputElement).files || []){
				switch(file.name){
					case 'localStorage.users.json': importFileAsync(file,'users'); break;
					case 'localStorage.graph.json': importFileAsync(file,'graph'); break;
					case 'localStorage.common.csv': importFileAsync(file,'common'); break;
					default: alert('Unexpected file: '+file.name ); break;
				}
			}
		})
	}
	readFileAsync(file:Blob) {
		return new Promise((resolve,reject)=>{
			var reader = new FileReader();
			reader.onload = () => resolve( reader.result );
			reader.onerror = (error) => reject( error );
			reader.readAsText(file);
		})
	}
}
