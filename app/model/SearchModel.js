class SearchModel {
	constructor() {
		this._ids = [];
		this.onChanged = new Delegate();
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

export default SearchModel;

import { Delegate } from "app/utils";
