export type SaveTextParams = {
	text: string;
	filename: string;
	type?: "text/plain" | "application/json";
}

// a.href = "data:text"+text // does not handle '#' so this is safer
export function saveTextToFile({text,filename,type="text/plain"} : SaveTextParams): void{
	const url = URL.createObjectURL(new Blob([text], {type})); 
	const a = document.createElement("a");
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(()=>URL.revokeObjectURL(url), 2000);
}
