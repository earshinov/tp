var BaseCsvReader = require("app/model/readers/BaseCsvReader");

class JuridicalPersonsReader extends BaseCsvReader {
	constructor(model) {
		super({
			skipRows: 1
		});
		this._model = model;
		this._searchStrings = [];
	}
	// @override
	_processRecord(record) {
		this._searchStrings.push(record[0].toLowerCase());
	}
	_finish() {
		var records = this._model.records;
		for (var i = 0, c = records.length; i < c; i++) {
			var record = records[i];
			if (record instanceof m.ParticipantsRegistryRecord)
				extractOwner(record, this._searchStrings);
		}
	}
}

function extractOwner(record, juridicalPersonsSearchStrings) {
	var m = record.source.match(/Участники долевого\n(.*?)(\n|$)/i);
	if (!m)
		throw new Error("В записи не найдены данные об участниках долевого строительства");

	// set `record.owner` to the name of the physical person
	// for juridical persons `owner` remains `null`
	var owner = m[1].toLowerCase();
	if (!juridicalPersonsSearchStrings.some(searchString => owner.indexOf(searchString) >= 0))
		record.owner = owner;
}


module.exports = JuridicalPersonsReader;

var m = require("app/model/ModelClasses");
