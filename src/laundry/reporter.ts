import { con } from "~/lib/console";
import { codeCss } from "./css";
import { LocalStorageRepository } from "./local-storage";
import { Machine } from "./machine";
import { Ts } from "./timestamp";
import { BreakoutKey, Row } from "./types";

// generates machine reports by pulling rows out of the repository.
export class Reporter{
	private readonly repo:LocalStorageRepository;
	constructor(repository:LocalStorageRepository){
		this.repo = repository;
	}
	// shows history for all machines
	machines(){
		const rows = this.repo.load();
		this._format_internal( rows );
	}
	available(){ this.totals("available"); }
	inUse(){     this.totals("inUse"); }
	idle(){      this.totals("idle"); }
	totals(status:BreakoutKey){
		const rows = this.repo.load()
			.map(function({ts,machines,totals}:Row){
				totals = totals || Machine.calcTotals(machines);
				const displayTotal = (status != null) 
					? {D:totals.D[status],W:totals.W[status]} 
					: totals;
				return Ts.format(ts) + " => " + JSON.stringify(displayTotal);
			});
		con.print( rows.join("\r\n") );
	}
	// shows all time stamps
	timestamps(){
		const history = this.repo.load();
		const timestampStrings = history.map( ({ts}) => Ts.format(ts) );
		con.print( timestampStrings.join("\r\n") );
	}
	last(){
		const rows = this.repo.load();
		if(rows.length == 0){ console.log('no history'); return; }
		const {ts,machines} = rows[rows.length-1];
		con.print( Ts.format(ts) + " => \r\n" + machines.map(Machine.format3).join("\r\n") );
	}
	// shows history for a single machine
	machine(machineName:string){
		const history = this.repo.load();
		const rows = history.map( function({ts,machines}): Row{
			machines = machines.filter(({name}) => name==machineName);
			return {ts,machines};
		} );
		this._format_internal( rows );
	}
	// used internally for showing history for 1 or all machines
	_format_internal(originalRows:Row[]){
		const rows = originalRows.map( function({ts,machines}){
			return Ts.format(ts)+' => '+machines.map(Machine.format3).join(", ");
		});
		con.print( rows.join("\r\n") )
	}
	help(){
		console.group('Reports');
		console.log( 'all machines, type: %creports.machines()', codeCss );
		console.log( 'single machine (#3), type: %creports.machine(3)', codeCss );
		console.log( 'timestamps, type: %creports.timestamps()', codeCss );
		console.log( 'totals, type: %creports.totals()', codeCss );
		console.log( 'available, type: %creports.available()', codeCss );
		console.log( 'in use, type: %creports.inUse()', codeCss );
		console.log( 'last row, type: %creports.last()', codeCss );
		console.groupEnd();
	}
}
