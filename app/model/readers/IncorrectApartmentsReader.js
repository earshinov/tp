import BaseCsvReader from "app/model/readers/BaseCsvReader";

class IncorrectApartmentsReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1
		});
		this._model = model;
	}
	// @override
	_processRecord(record) {

		var recordNumber = parseRecordNumber(record[0]);
		var number = parseNumber(record[1]);

		var objects = this._model.objects;
		var foundObject = null;
		for (var i = 0, c = objects.length; i < c; i++) {
			var obj = objects[i];
			if (obj instanceof Apartment &&
				obj.record.number == recordNumber &&
				obj.number == number) {

				if (foundObject != null)
					throw new Error("Найдено несколько подходящих записей; должна быть одна");
				foundObject = obj;
			}
		}
		if (!foundObject)
			throw new Error("Запись не найдена");
		this._model.removeObject(foundObject);
	}
}

export default IncorrectApartmentsReader;

import { Apartment } from "app/model/ModelClasses";
import { parseRecordNumber, parseNumber } from "app/model/readers/Parsing";

