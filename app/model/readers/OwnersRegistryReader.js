var BaseCsvReader = require("app/model/readers/BaseCsvReader");

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
		recordNumber = Parsing.parseRecordNumber(recordNumber);

		var number = Parsing.parseNumber(record[1]);
		var landingNumber = Parsing.parseLandingNumber(record[2]);
		var floor = Parsing.parseFloor(record[3]);
		var building = Parsing.parseBuilding(record[4]);
		var section = Parsing.parseSection(record[5]);
		var area = Parsing.parseArea(record[6]);

		var owner = record[7];
		if (!owner)
			throw new Error("Отсутствует владелец: " + record[7]);

		var modelRecord = new m.OwnersRegistryRecord(recordNumber, owner);
		this._model.addRecord(modelRecord);

		var type = "квартира";
		this._model.addObject(new m.Apartment(modelRecord, type, number, building, floor, landingNumber, section, area));
	}
}

module.exports = OwnersRegistryReader;

var m = require("app/model/ModelClasses.js");
var Parsing = require("app/model/readers/Parsing.js");
