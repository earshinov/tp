﻿export class Record {
	constructor() {
		this.id = null; // assigned by Model
	}
}

export class ParticipantsRegistryRecord extends Record {
	constructor(number, registryNumber, date, source) {
		super();
		this.number = number;
		this.registryNumber = registryNumber;
		this.date = date;
		this.owner = null;
		this.source = source;
	}
}
ParticipantsRegistryRecord.prototype.type = "ЕГРП";

export class OwnersRegistryRecord extends Record {
	constructor(number, owner) {
		super();
		this.number = number;
		this.owner = owner;
	}
}
OwnersRegistryRecord.prototype.type = "Реестр собственников долей";


export class Obj {
	constructor(record) {
		this.id = null; // assigned by Model
		this.record = record;
	}
}

export class ParkingPlace extends Obj {
	constructor(record, number, building, area) {
		super(record);
		this.number = number;
		this.building = building;
		this.area = area;
	}
}

export class Apartment extends Obj {
	constructor(record, type, number, building, floor, landingNumber, section, area) {
		super(record);
		this.type = type;
		this.number = number;
		this.originalNumber = null;
		this.building = building;
		this.floor = floor;
		this.landingNumber = landingNumber;
		this.section = section;
		this.area = area;
		this.duplicate = false; // assigned by Model
	}
	setNumber(number) {
		if (this.originalNumber != null)
			throw new Error("Исходный номер квартиры уже задан: " + this.originalNumber);
		this.originalNumber = this.number;
		this.number = number;
	}
}

export class NonResidentialPremise extends Obj {
	constructor(record, type, number, building, section, area) {
		super(record);
		this.type = type;
		this.number = number;
		this.building = building;
		this.section = section;
		this.area = area;
	}
}
