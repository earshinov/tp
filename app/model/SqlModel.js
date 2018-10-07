var Schema = `
create table Record (
	id int not null primary key,
	type text not null,
	number int not null,
	registryNumber text,
	[date] date,
	owner text,
	source text
);

create table ParkingPlace (
	id int not null primary key,
	recordId int not null references Record(id),
	number int not null,
	building int not null,
	area number not null
);

create table Apartment (
	id int not null primary key,
	recordId int not null references Record(id),
	type text not null,
	number int not null,
	originalNumber int,
	building int not null,
	floor int not null,
	landingNumber int,
	section int null,
	area number not null,
	duplicate bool not null
);

/* Non-Residential Premise */
create table NRPremise (
	id int not null primary key,
	recordId int not null references Record(id),
	type text not null,
	number int null,
	building int not null,
	section int null,
	area number not null
);
`.trim();

class SqlModel {
	constructor() {
		globalInit();
		this.db = new alasql.Database();
		initDb(this.db);
	}
	init(model) {
		var db = new alasql.Database();
		initDb(db);
		loadModel(db, model);
		this.db = db;
	}
	query(sql) /* -> [][][] */ {
		var res = this.db.exec(sql);
		if (res.length > 0 && res[0].length > 0 && $.isArray(res[0][0])) {
			// alasql returned multiple datasets
			return res;
		}
		else {
			// alasql returned single dataset
			return [res];
		}
	}
	swap(other) {
		var tmp = this.db;
		this.db = other.db;
		other.db = tmp;
	}
}

SqlModel.Schema = Schema;

export default SqlModel;

import { ParkingPlace as _ParkingPlace, Apartment as _Apartment, NonResidentialPremise } from "app/model/ModelClasses";

function globalInit() {
	alasql.options.casesensitive = "false";
	// return rows as arrays, not objects
	alasql.options.modifier = "MATRIX";
}

function initDb(db) {
	db.exec(Schema);
}

function loadModel(db, model) {

	for (var i = 0, c = model.objects.length; i < c; i++) {
		var obj = model.objects[i];
		obj.recordId = obj.record.id;
	}

	var Record = model.records;

	var ParkingPlace = model.objects.filter(function(obj) {
		return obj instanceof _ParkingPlace;
	});
	var Apartment = model.objects.filter(function(obj) {
		return obj instanceof _Apartment;
	});
	var NRPremise = model.objects.filter(function(obj) {
		return obj instanceof NonResidentialPremise;
	});

	db.exec(`
		INSERT INTO Record(id, type, number, registryNumber, [date], owner, source)
		SELECT id, type, number, registryNumber, [date], owner, source
		FROM ?;

		INSERT INTO ParkingPlace(id, recordId, number, building, area)
		SELECT id, recordId, number, building, area
		FROM ?;

		INSERT INTO Apartment(id, recordId, type, number, originalNumber, building, floor, landingNumber, section, area, duplicate)
		SELECT id, recordId, type, number, originalNumber, building, floor, landingNumber, section, area, duplicate
		FROM ?;

		INSERT INTO NRPremise(id, recordId, type, number, building, section, area)
		SELECT id, recordId, type, number, building, section, area
		FROM ?;
	`, [Record, ParkingPlace, Apartment, NRPremise]);
}
