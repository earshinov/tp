import { parseFloat, parseInt } from "app/utils";

export function parseCsvFloat(value) {
	value = value.replace(/,/g, ".");
	return parseFloat(value);
}

// ========================================================

export function parseSection(s) {
	var value = parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер секции: " + s);
	return value;
}

export function parseFloor(s) {
	var value = parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер этажа: " + s);
	return value;
}

export function parseBuilding(s) {
	var value = parseInt(s);
	if (value != 1 && value != 2)
		throw new Error("Некорректный номер корпуса: " + s);
	return value;
}

export function parseNumber(s) {
	var value = parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер квартиры: " + s);
	return value;
}

export function parseLandingNumber(s) {
	var value = parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер на площадке: " + s);
	return value;
}

export function parseRecordNumber(s) {
	var value = parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер записи: " + s);
	return value;
}

export function parseArea(s) {
	var value = parseCsvFloat(s);
	if (value == null)
		throw new Error("Некорректное значение площади: " + s);
	return value;
}
