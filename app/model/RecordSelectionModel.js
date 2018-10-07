class RecordSelectionModel {
	constructor() {
		this._record = null;
		this.onChanged = new utils.Delegate();
	}
	setRecord(/* optional */ record) {
		if (record == this._record) return;
		this._record = record;
		this.onChanged.trigger();
	}
	clear() {
		this.setRecord(null);
	}
	getRecord() {
		return this._record;
	}
}

module.exports = RecordSelectionModel;

var utils = require("app/utils");
