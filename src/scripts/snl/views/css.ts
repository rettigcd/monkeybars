export const css: Record<string, Partial<CSSStyleDeclaration>> = {
	topBar: {
		position:'fixed',
		top:'0px',
		right:'0px',
		backgroundColor:'#ddf',
		zIndex:"1000"
	},
	subBar: {
		margin:"0"
	},
	status: {
		border:'thin solid black',
		padding:'2px 4px',"fontSize":"12px",
		backgroundColor:'white',
		color:'black'
	},
	reloadButton: {
		border:'3px outset black',
		borderRadius:"8px", 
		padding:'0px 4px', 
		margin:"1px 4px",
		fontSize:"13px",
		backgroundColor:'#0F0',
		color:'black', 
		cursor:"pointer"
	},
	success: {
		color:"white", 
		backgroundColor:'green'
	},
	fail: {
		color:"white", 
		backgroundColor:'red'
	},
	input: {
		width:"100px"
	},
	input50: {
		width:"50px"
	},
	email: {
		width:"160px"
	}
};
