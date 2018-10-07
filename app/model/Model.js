class Model {
	constructor() {
		this.records = [];
		this.objects = [];
		this._objectsById = {};
		this.sqlModel = new SqlModel();
		this.onChanged = new Delegate();
	}
	addRecord(record) {
		this.records.push(record);
	}
	addObject(object) {
		this.objects.push(object);
	}

	// Modification operations
	// ====================================================

	removeObject(object) {
		Arrays.removeFirst(this.objects, object);
	}

	// ====================================================

	finish() {
		// 1. assign ids
		// 2. fill array of objects in each record
		for (var i = 0, c = this.records.length; i < c; i++) {
			var record = this.records[i];
			record.id = i+1;
			record.objects = [];
		}
		this._objectsById = {};
		for (var i = 0, c = this.objects.length; i < c; i++) {
			var obj = this.objects[i];
			obj.id = i+1;
			this._objectsById[obj.id] = obj;
			obj.record.objects.push(obj);
		}

		searchDuplicates(this.objects);

		this.sqlModel.init(this);
	}
	swap(other) {
		var tmp;

		tmp = this.records;
		this.records = other.records;
		other.records = tmp;

		tmp = this.objects;
		this.objects = other.objects;
		other.objects = tmp;

		tmp = this._objectsById;
		this._objectsById = other._objectsById;
		other._objectsById = tmp;

		this.sqlModel.swap(other.sqlModel);
	}
	changed() {
		this.onChanged.trigger();
	}

	// Query operations
	// ====================================================

	getObjectById(objectId) {
		return this._objectsById[objectId];
	}
}

export default Model;

import { Delegate, Arrays } from "app/utils";
import SqlModel from "app/model/SqlModel";
import { Apartment } from "app/model/ModelClasses";

function searchDuplicates(objects) {
	var map = {};

	for (var i = 0, c = objects.length; i < c; i++) {
		var obj = objects[i];
		if (!(obj instanceof Apartment) || obj.section == null)
			continue;

		var dup = optionallyInsert(
			optionallyInsert(
				optionallyInsert(
					optionallyInsert(map, obj.building),
					obj.section),
				obj.floor),
			obj.number,
			obj);
		if (dup !== obj) {
			dup.duplicate = true;
			obj.duplicate = true;
		}
	}
}

function optionallyInsert(map, key, value /* = {} */) {
	if (map.hasOwnProperty(key))
		return map[key];
	if (value === undefined)
		value = {};
	map[key] = value;
	return value;
}
