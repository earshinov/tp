class SearchModel {
	constructor() {
		this._ids = [];
		this.onChanged = new utils.Delegate();
	}
	setObjectIds(value) {
		if (this._ids.length == 0 && value.length == 0) {
			// omit onChanged in this common case
			return;
		}
		this._ids = value;
		this.onChanged.trigger();
	}
	getObjectIds() {
		return this._ids;
	}
}

module.exports = SearchModel;

var utils = require("app/utils");
