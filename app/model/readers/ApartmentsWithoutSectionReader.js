import BaseCsvReader from "app/model/readers/BaseCsvReader";

class ApartmentsWithoutSectionReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1
		});
		this._model = model;
	}
	// @override
	_processRecord(record) {

		var section = parseSection(record[0]);
		var floor = parseFloor(record[1]);
		var number = parseNumber(record[2]);
		var recordNumber = parseRecordNumber(record[3]);

		var objects = this._model.objects;
		var foundObject = null;
		for (var i = 0, c = objects.length; i < c; i++) {
			var obj = objects[i];
			if (obj instanceof Apartment &&
				obj.floor == floor &&
				obj.number == number &&
				obj.section == null &&
				obj.record.number == recordNumber) {

				var _record = obj.record;
				if (!(_record instanceof ParticipantsRegistryRecord))
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

export default ApartmentsWithoutSectionReader;

import { Apartment, ParticipantsRegistryRecord } from "app/model/ModelClasses";
import { parseSection, parseFloor, parseNumber, parseRecordNumber } from "app/model/readers/Parsing";
