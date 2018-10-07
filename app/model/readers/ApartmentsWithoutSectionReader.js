var BaseCsvReader = require("app/model/readers/BaseCsvReader");

class ApartmentsWithoutSectionReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1
		});
		this._model = model;
	}
	// @override
	_processRecord(record) {

		var section = Parsing.parseSection(record[0]);
		var floor = Parsing.parseFloor(record[1]);
		var number = Parsing.parseNumber(record[2]);
		var recordNumber = Parsing.parseRecordNumber(record[3]);

		var objects = this._model.objects;
		var foundObject = null;
		for (var i = 0, c = objects.length; i < c; i++) {
			var obj = objects[i];
			if (obj instanceof m.Apartment &&
				obj.floor == floor &&
				obj.number == number &&
				obj.section == null &&
				obj.record.number == recordNumber) {

				var _record = obj.record;
				if (!(_record instanceof m.ParticipantsRegistryRecord))
					throw new Error("Найденная запись имеет некорректный тип: " + _record.type);

				if (foundObject != null)
					throw new Error("Найдено несколько подходящих записей; должна быть одна");
				foundObject = obj;
			}
		}
		if (!foundObject)
			throw new Error("Запись не найдена");
		foundObject.section = section;
	}
}

module.exports = ApartmentsWithoutSectionReader;

var m = require("app/model/ModelClasses");
var Parsing = require("app/model/readers/Parsing");
