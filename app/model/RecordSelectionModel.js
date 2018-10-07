class RecordSelectionModel {
	constructor() {
		this._record = null;
		this.onChanged = new Delegate();
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

export default RecordSelectionModel;

import { Delegate } from "app/utils";
