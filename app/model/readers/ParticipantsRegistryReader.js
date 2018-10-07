import BaseCsvReader from "app/model/readers/BaseCsvReader";

class ParticipantsRegistryReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1,
		});
		this._model = model;
		this._records = {}; // recordNumber => _Record
	}
	read(csv, callback) {
		var me = this;
		super.read(csv, function(ex) {
			if (!ex)
				for (var key in me._records)
					if (me._records.hasOwnProperty(key))
						me._records[key].finish();
			callback(ex);
		});
	}
	// @override
	_processRecord(record) {
		var recordNumber = record[3];
		if (!recordNumber)
			// не обрабатываем строки без номера записи
			return;
		recordNumber = parseRecordNumber(recordNumber);

		var source = record[1];
		if (!source)
			throw new Error("Отсутвует строка записи");
		var _record;
		var modelRecord;
		if (!(recordNumber in this._records)) {
			_record = this._records[recordNumber] = new _Record(recordNumber);
			modelRecord = _record.modelRecord();
			this._model.addRecord(modelRecord);
		}
		else {
			_record = this._records[recordNumber];
			modelRecord = _record.modelRecord();
		}
		_record.appendSource(source);

		var type = record[4];
		if (!type) {
			// строка без объекта
			for (var i = 5; i < record.length; i++)
				if (record[i])
					throw new Error("Строка, не содержащая тип объекта, не должна содержать информации об объекте");
			return;
		}

		var number = record[5];
		// номер объекта опциональный для нежилых помещений
		number = !number || number == "бн" ? null : parseNumber(number);

		var building = parseBuilding(record[6]);
		var area = parseArea(record[9]);

		if (type == "машиноместо") {
			if (number == null)
				throw new Error("Некорректный номер объекта: " + record[5]);
			this._model.addObject(new ParkingPlace(modelRecord, number, building, area));
			return;
		}

		var section = record[8];
		// номер секции опциональный
		section = !section || section == "нет" || section == "?" ? null : parseSection(section);

		if (type == "неж пом" || type.search(/предприятие/i) >= 0 || type == "магазин" || type == "офис") {
			this._model.addObject(new NonResidentialPremise(modelRecord, type, number, building, section, area));
			return;
		}

		var floor = parseFloor(record[7]);

		if (number == null)
			throw new Error("Некорректный номер объекта: " + record[5]);

		var landingNumber = null;
		this._model.addObject(new Apartment(modelRecord, type, number, building, floor, landingNumber, section, area));
	}
}

export default ParticipantsRegistryReader;

import { parseInt } from "app/utils";
import { ParkingPlace, NonResidentialPremise, Apartment, ParticipantsRegistryRecord } from "app/model/ModelClasses.js";
import { parseRecordNumber, parseNumber, parseBuilding, parseArea, parseSection, parseFloor } from "app/model/readers/Parsing.js";

class _Record {
	constructor(recordNumber) {
		this._source = [];
		this._modelRecord = new ParticipantsRegistryRecord(recordNumber, null, null, null);
	}
	modelRecord() {
		return this._modelRecord;
	}
	appendSource(source) {
		this._source.push(source);
	}
	finish() {
		var source = this._source.join("\n");
		var registryInfo = extractRegistryInfo(source);
		this._modelRecord.registryNumber = registryInfo.number;
		this._modelRecord.date = registryInfo.date;
		this._modelRecord.source = source;
	}
}

function extractRegistryInfo(source) {
	var m = source.match(/№\s*(.*?)\s+от\s+(\d+)\.(\d+)\.(\d+)/);
	if (!m)
		throw new Error("В записи не найдены регистрационный номер и дата регистрации");

	var number = m[1];

	var day = parseInt(m[2]);
	var month = parseInt(m[3]);
	var year = parseInt(m[4]);
	var date = new Date(year, month-1, day);

	return { number, date };
}
