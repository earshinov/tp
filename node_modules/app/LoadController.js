class LoadController {
	constructor(model) {
		this._model = model;

		this.participantsRegistryUrl = "data/ЕГРП.csv";
		this.ownersRegistryUrl = "data/Собственники.csv";
		this.incorrectApartmentsUrl = "data/Некорректные записи-дубликаты.csv";
		this.apartmentsWithoutSectionUrl = "data/Квартиры без номера секции.csv";
		this.oldApartmentNumbersUrl = "data/Старые номера квартир.csv";
		this.juridicalPersonsUrl = "data/Юридические лица.csv";

		this._participantsRegistry = null;
		this._ownersRegistry = null;
		this._apartmentsWithoutSection = null;
		this._incorrectApartments = null;
		this._oldApartmentNumbers = null;
		this._juridicalPersons = null;

		this._ajaxLoader = new AjaxLoader();
		this._fileLoader = new FileLoader();

		this._opCounter = 0;
		this.onOperationStart = new utils.Delegate();
		this.onOperationEnd = new utils.Delegate();
	}

	// load default data
	init() /* -> Deferred */ {
		var me = this;
		return me._operation(() => $.Deferred().resolve()
			.then(() => me.loadDefaultParticipantsRegistry())
			.then(() => me.loadDefaultOwnersRegistry())
			.then(() => me.loadDefaultApartmentsWithoutSection())
			.then(() => me.loadDefaultIncorrectApartments())
			.then(() => me.loadDefaultOldApartmentNumbers())
			.then(() => me.loadDefaultJuridicalPersons())
			.then(() => me.updateModel()));
	}

	loadDefaultParticipantsRegistry() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.participantsRegistryUrl)
			.then(function(csv) { me._participantsRegistry = csv; }));
	}
	loadDefaultOwnersRegistry() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.ownersRegistryUrl)
			.then(function(csv) { me._ownersRegistry = csv; }));
	}
	loadDefaultApartmentsWithoutSection() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.apartmentsWithoutSectionUrl)
			.then(function(csv) { me._apartmentsWithoutSection = csv; }));
	}
	loadDefaultIncorrectApartments() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.incorrectApartmentsUrl)
			.then(function(csv) { me._incorrectApartments = csv; }));
	}
	loadDefaultOldApartmentNumbers() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.oldApartmentNumbersUrl)
			.then(function(csv) { me._oldApartmentNumbers = csv; }));
	}
	loadDefaultJuridicalPersons() /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._ajaxLoader.load(this.juridicalPersonsUrl)
			.then(function(csv) { me._juridicalPersons = csv; }));
	}

	loadApartmentsWithoutSection(file) /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._fileLoader.load(file)
			.then(function(csv) { me._apartmentsWithoutSection = csv; }));
	}
	loadIncorrectApartments(file) /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._fileLoader.load(file)
			.then(function(csv) { me._incorrectApartments = csv; }));
	}
	loadOldApartmentNumbers(file) /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._fileLoader.load(file)
			.then(function(csv) { me._oldApartmentNumbers = csv; }));
	}
	loadJuridicalPersons(file) /* -> Deferred */ {
		var me = this;
		return me._operation(() => me._fileLoader.load(file)
			.then(function(csv) { me._juridicalPersons = csv; }));
	}

	updateModel() /* -> Deferred */ {
		var me = this;
		var model = new Model();

		return me._operation(() => $.Deferred().resolve()
			.then(() => read("данные из ЕГРП", me._participantsRegistry, new ParticipantsRegistryReader(model)))
			.then(() => read("данные из реестра собственникам долей", me._ownersRegistry, new OwnersRegistryReader(model)))
			.then(() => read("данные по квартирам без номера секции", me._apartmentsWithoutSection, new ApartmentsWithoutSectionReader(model)))
			.then(() => read("данные по некорректным записям-дубликатам", me._incorrectApartments, new IncorrectApartmentsReader(model)))
			.then(() => read("данные по старым номерам квартир", me._oldApartmentNumbers, new OldApartmentNumbersReader(model)))
			.then(() => read("данные по юридическим лицам", me._juridicalPersons, new JuridicalPersonsReader(model)))
			.then(function() {
				try { model.finish(); } catch(ex) { return $.Deferred().reject(ex); }
				me._model.swap(model);
				me._model.changed();
			}));
	}

	_operation(f) {
		var me = this;
		me._operationStart();
		return f()
			.done(function() { me._operationEnd(); })
			.fail(function(ex) { me._operationEnd(ex); });
	}
	_operationStart() {
		if (this._opCounter++ == 0)
			this.onOperationStart.trigger();
	}
	_operationEnd(ex) {
		this._opCounter = Math.max(1, this._opCounter);
		if (--this._opCounter == 0)
			this.onOperationEnd.trigger(ex);
	}
}

module.exports = LoadController;

var utils = require("app/utils");
var AjaxLoader = require("app/AjaxLoader");
var FileLoader = require("app/FileLoader");
var Model = require("app/model/Model");
var ParticipantsRegistryReader = require("app/model/readers/ParticipantsRegistryReader");
var OwnersRegistryReader = require("app/model/readers/OwnersRegistryReader");
var ApartmentsWithoutSectionReader = require("app/model/readers/ApartmentsWithoutSectionReader");
var IncorrectApartmentsReader = require("app/model/readers/IncorrectApartmentsReader");
var OldApartmentNumbersReader = require("app/model/readers/OldApartmentNumbersReader");
var JuridicalPersonsReader = require("app/model/readers/JuridicalPersonsReader");

function read(dataDescription, data, reader) /* -> Deferred */ {
	var d = $.Deferred();
	if (!data)
		return d.reject(new Error("Отсутствуют " + dataDescription));
	reader.read(data, function(ex) {
		ex ? d.reject(ex) : d.resolve();
	});
	return d;
}
