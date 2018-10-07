import BaseCsvReader from "app/model/readers/BaseCsvReader";

class OwnersRegistryReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 2,
		});
		this._model = model;
	}
	// @override
	_processRecord(record) {

		var recordNumber = record[0];
		if (!recordNumber)
			// не обрабатываем строки без номера записи
			return;
		recordNumber = parseRecordNumber(recordNumber);

		var number = parseNumber(record[1]);
		var landingNumber = parseLandingNumber(record[2]);
		var floor = parseFloor(record[3]);
		var building = parseBuilding(record[4]);
		var section = parseSection(record[5]);
		var area = parseArea(record[6]);

		var owner = record[7];
		if (!owner)
			throw new Error("Отсутствует владелец: " + record[7]);

		var modelRecord = new OwnersRegistryRecord(recordNumber, owner);
		this._model.addRecord(modelRecord);

		var type = "квартира";
		this._model.addObject(new Apartment(modelRecord, type, number, building, floor, landingNumber, section, area));
	}
}

export default OwnersRegistryReader;

import { OwnersRegistryRecord, Apartment } from "app/model/ModelClasses.js";
import { parseRecordNumber, parseNumber, parseLandingNumber, parseFloor, parseBuilding, parseSection, parseArea } from "app/model/readers/Parsing.js";
