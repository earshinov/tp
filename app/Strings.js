export var Unknown = "???";
export var Cross = "✕";

export function formatDate(date) {
	var day = ("0" + date.getDate()).slice(-2);
	var month = ("0" + (date.getMonth() + 1)).slice(-2);
	var year = date.getFullYear();
	return `${day}.${month}.${year}`;
}
