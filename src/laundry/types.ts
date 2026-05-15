export type MachineType = string;
export type TimeLeftType = 'Available' 
	| 'Idle' 
	| 'Out of service';

export type StackedMachines = {
	stacked: any | undefined;
	appliance_type: MachineType;
	appliance_desc: string;
	time_left_lite: TimeLeftType;
	appliance_desc2: string;
	time_left_lite2: TimeLeftType;
}

export type Mach = {
	type: MachineType;
	name: string;
	status: TimeLeftType;
}

export type Row = {
	ts: number; // seconds
	machines: Mach[];
	totals?: DW;
}

export type DW = {
	D: Breakout;
	W: Breakout;
}

export type Breakout = {
	available: number;
	idle: number;
	inUse: number;
	oos: number;
}

export type BreakoutKey = keyof Breakout;