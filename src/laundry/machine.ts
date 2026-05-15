import { Breakout, DW, Mach, MachineType } from "./types";

export class Machine{

	// shows true for available, and false otherwise
	static format1({name,status,type}:Mach){ return `${name}(${type}):${status=='Available' }`; }

	// shows 'A' for available and '-' otherwise
	static format2({name,status,type}:Mach){ return `${name}(${type}):${status=='Available' ? "A" : "-" }`; }

	// just shows the status (I like this one)
	static format3({name,status,type}:Mach){ return `${name}(${type}):${status}`; }

	static calcTotals(machines:Mach[]): DW {
		function calcTypeTotals(desiredType:MachineType): Breakout{
			const machOfType = machines.filter(({type})=>type==desiredType);
			const available = machOfType.filter(x=>x.status=='Available').length;
			const idle      = machOfType.filter(x=>x.status=="Idle").length;
			const oos       = machOfType.filter(x=>x.status=="Out of service").length;
			const inUse     = machOfType.length - available - idle - oos;
			return {available,idle,inUse, oos};
		}
		return {
			D:calcTypeTotals('D'),
			W:calcTypeTotals('W')
		};
	}


}
