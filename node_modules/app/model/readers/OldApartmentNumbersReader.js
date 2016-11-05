var BaseCsvReader = require("app/model/readers/BaseCsvReader");

class OldApartmentNumbersReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1
		});
		this._model = model;
	}
	// @override
	_processRecord(record) {

		for (var i = 0, c = record.length; i < c; i++) {
			record[i] = utils.parseInt(record[i]);
			if (record[i] == null)
				throw new Error("Значения должны быть числовыми");
		}

		var sectionGe = record[0];
		var sectionLe = record[1];
		var floorGe = record[2];
		var floorLe = record[3];
		var numberGe = record[4];
		var numberLe = record[5];
		var d = record[6];

		var objects = this._model.objects;
		var updates = 0;
		for (var i = 0, c = objects.length; i < c; i++) {
			var obj = objects[i];
			if (obj instanceof m.Apartment &&
				obj.section >= sectionGe && obj.section <= sectionLe &&
				obj.floor >= floorGe && obj.floor <= floorLe &&
				obj.number >= numberGe && obj.number <= numberLe)
			{
				obj.setNumber(obj.number + d);
				updates++;
			}
		}
		if (updates == 0)
			throw new Error("Не найдено ни одной подходящей записи");
	}
}

module.exports = OldApartmentNumbersReader;

var utils = require("app/utils");
var m = require("app/model/ModelClasses");
