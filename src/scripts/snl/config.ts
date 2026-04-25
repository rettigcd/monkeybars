import { makeObservable, type ObservableHost, type ObservableListener } from "~/utils/observable";
import { SyncedPersistentDict } from "~/utils/storage";

export type ShowType = "LIVE SHOW" | "DRESS REHEARSAL";

export type ConfigRepo = SyncedPersistentDict<ConfigModel>;

export class ConfigModel {
	firstName: string = '';
	lastName: string = '';
	email: string = '';
	phone: string = '';
	groupSize: string = ''; // string so it binds nicely to an <input>
	show?: ShowType; 			// undefined ??? !!!
	msDelay: string = ''; // string so it binds nicely to an <input>
	configName: string = '';
	isDefault: boolean = false;
	configOptions: string[] = [];

	toJSON(){
		const {firstName,lastName,phone,email,show} = this;
		return {firstName,lastName,phone,email,show};
	}
}

// Properties are the current configuration values.
export class ConfigService{
	public showOptions: string[];
	public model: ObservableHost<ConfigModel>;
	private repo: ConfigRepo;
	private lastDefaultConfigName: string = '';
	constructor(repo:ConfigRepo, showOptions: string[]){
		this.repo = repo;
		this.model = makeObservable(new ConfigModel());
		this.model.listen("configName",x => this.onConfigNameChanged(x));
		this.showOptions = showOptions;
	}

	addUser(){
		const newLabel = prompt('Enter name for new config');
		if(!newLabel) return;
		this.model.configOptions = [...this.model.configOptions,newLabel];
		this.model.configName = newLabel;
		this.saveUser();
	}

	removeName(){
		const {configName} = this.model;
		if(!configName) return;
		if(prompt(`Please confirm deleting '${configName}' by typing the word 'delete'`) != 'delete') return;
		
		const index = this.model.configOptions.indexOf(configName);
		if (index !== -1)
			this.model.configOptions = this.model.configOptions.filter((_,i)=>i != index);
		this.repo.remove(configName);
		console.log('removed',configName);
	}

	saveUser(){
		const {firstName,lastName,phone,email,groupSize,show,isDefault,msDelay} = this.model;
		if(isDefault){
			if(this.lastDefaultConfigName)
				this.repo.update(this.lastDefaultConfigName,x=>x.isDefault=false);
			this.lastDefaultConfigName = this.model.configName;
		}
		this.repo.update(this.model.configName,x=>Object.assign(x,{firstName,lastName,phone,email,groupSize,show,isDefault,msDelay}));
		console.log('user saved');
	}

	onConfigNameChanged: ObservableListener<ConfigModel, "configName"> = ({newValue}) => {
		const x = this.repo.get(newValue);
		Object.assign(this.model,x);
	}

}
