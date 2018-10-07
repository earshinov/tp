module.exports = {
	parseCsvFloat,
	parseSection, parseFloor, parseBuilding, parseNumber, parseLandingNumber, parseRecordNumber, parseArea,
};

var utils = require("app/utils");

function parseCsvFloat(value) {
	value = value.replace(/,/g, ".");
	return utils.parseFloat(value);
}

// ========================================================

function parseSection(s) {
	var value = utils.parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер секции: " + s);
	return value;
}

function parseFloor(s) {
	var value = utils.parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер этажа: " + s);
	return value;
}

function parseBuilding(s) {
	var value = utils.parseInt(s);
	if (value != 1 && value != 2)
		throw new Error("Некорректный номер корпуса: " + s);
	return value;
}

function parseNumber(s) {
	var value = utils.parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер квартиры: " + s);
	return value;
}

function parseLandingNumber(s) {
	var value = utils.parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер на площадке: " + s);
	return value;
}

function parseRecordNumber(s) {
	var value = utils.parseInt(s);
	if (value == null)
		throw new Error("Некорректный номер записи: " + s);
	return value;
}

function parseArea(s) {
	var value = parseCsvFloat(s);
	if (value == null)
		throw new Error("Некорректное значение площади: " + s);
	return value;
}
