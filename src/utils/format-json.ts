export type JsonWithFormat = JSON & {
	format(s: string): string;
};

export function extendJson( json: JSON ) : JsonWithFormat{
	(json as JsonWithFormat).format = function(s: string): string {
		return json.stringify(json.parse(s), null, "\t");
	};
	return json as JsonWithFormat;
}
