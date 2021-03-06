import View from "app/views/View";

class SearchView extends View {
	constructor(model, searchModel) {
		super();
		this._model = model;
		this._searchModel = searchModel;
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="searchview">
				<div class="caption">Поиск</div>
				<label>Тип записи: <select id="${this.uid + "_recordType"}">
					<option>
					<option value="ЕГРП">ЕГРП</option>
					<option value="Реестр собственников долей">Реестр собственников долей</option>
				</select></label>
				<label>Номер записи: <input id="${this.uid + "_recordNumber"}" size="5"></label>
				<label>Текст в записи:<br/><input id="${this.uid + "_recordText"}" size="40"></label>
				Дата регистрации
					<label>с <input type="date" id="${this.uid + "_dateFrom"}"></label>
					<label>по <input type="date" id="${this.uid + "_dateTo"}"></label>
				<label>Лицо: <select id="${this.uid + "_person"}">
					<option>
					<option value="physical">Физическое</option>
					<option value="juridical">Юридическое</option>
				</select></label>
				<label>Количество объектов в записи ≥ <input id="${this.uid + "_objectsCountGe"}" size="5"></label>
				<label>Количество квартир в записи ≥ <input id="${this.uid + "_apartmentsCountGe"}" size="5"></label>
				<label>Номер объекта: <input id="${this.uid + "_number"}" size="5"></label>
				<button id="${this.uid + "_apply"}">Применить</button>
				<div class="searchview_searchStats">
					Найдено <span id="${this.uid + "_foundObjectsCount"}">0 объектов</span>
					(из них <span id="${this.uid + "_foundApartmentsCount"}">0 квартир</span>)
					в <span id="${this.uid + "_foundRecordsCount"}">0 записях</span>
				</div>
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);

		var me = this;
		var $el = me.$element();

		$el.find("#" + me.uid + "_apply").click(function() {
			me.apply();
		});

		$el.find(":input").bind("change input", function() {
			me.apply();
		});
	}
	apply() {
		var ids = [];
		var recordIds = {};

		var filters = this._getFilters();
		if (filters) {
			var objects = this._model.objects;
			for (var i = 0, c = objects.length; i < c; i++) {
				var obj = objects[i];
				if (!GridView.isSupportedObject(obj))
					continue;

				if (filters.recordType && obj.record.type != filters.recordType) continue;
				if (filters.recordNumber != null && obj.record.number != filters.recordNumber) continue;
				if (filters.recordText && !(
					obj.record.source != null && obj.record.source.toLowerCase().indexOf(filters.recordText.toLowerCase()) >= 0 ||
					obj.record.owner != null && obj.record.owner.toLowerCase().indexOf(filters.recordText.toLowerCase()) >= 0)) continue;
				if (filters.dateFrom && !(obj.record.date && obj.record.date >= filters.dateFrom)) continue;
				if (filters.dateTo && !(obj.record.date && obj.record.date <= filters.dateTo)) continue;
				if (filters.person) {
					if (filters.person == "juridical" && obj.record.owner) continue;
					if (filters.person == "physical" && !obj.record.owner) continue;
				}
				if (filters.number != null && !(obj.number == filters.number || obj.originalNumber == filters.number)) continue;
				if (filters.objectsCountGe != null && obj.record.objects.length < filters.objectsCountGe) continue;
				if (filters.apartmentsCountGe != null && obj.record.objects.filter(obj => obj instanceof Apartment).length < filters.apartmentsCountGe) continue;

				ids.push(obj.id);
				recordIds[obj.record.id] = true;
			}
		}

		this._showSearchStats(ids, recordIds);
		this._searchModel.setObjectIds(ids);
	}
	_getFilters() {
		var $el = this.$element();

		var $recordType = $el.find("#" + this.uid + "_recordType").removeClass("error");
		var $recordNumber = $el.find("#" + this.uid + "_recordNumber").removeClass("error");
		var $recordText = $el.find("#" + this.uid + "_recordText").removeClass("error");
		var $dateFrom = $el.find("#" + this.uid + "_dateFrom").removeClass("error");
		var $dateTo = $el.find("#" + this.uid + "_dateTo").removeClass("error");
		var $person = $el.find("#" + this.uid + "_person").removeClass("error");
		var $number = $el.find("#" + this.uid + "_number").removeClass("error");
		var $objectsCountGe = $el.find("#" + this.uid + "_objectsCountGe").removeClass("error");
		var $apartmentsCountGe = $el.find("#" + this.uid + "_apartmentsCountGe").removeClass("error");

		var recordType = $recordType.val();

		var recordNumber = $recordNumber.val();
		if (!recordNumber)
			recordNumber = null;
		else {
			recordNumber = parseInt(recordNumber);
			if (recordNumber == null)
				$recordNumber.addClass("error");
		}

		var recordText = $recordText.val();

		var dateFrom = $dateFrom.val();
		if (!dateFrom)
			dateFrom = null;
		else {
			dateFrom = parseDate(dateFrom);
			if (dateFrom == null)
				$dateFrom.addClass("error");
		}

		var dateTo = $dateTo.val();
		if (!dateTo)
			dateTo = null;
		else {
			dateTo = parseDate(dateTo);
			if (dateTo == null)
				$dateTo.addClass("error");
		}

		var person = $person.val();

		var number = $number.val();
		if (!number)
			number = null;
		else {
			number = parseInt(number);
			if (number == null)
				$number.addClass("error");
		}

		var objectsCountGe = $objectsCountGe.val();
		if (!objectsCountGe)
			objectsCountGe = null;
		else {
			objectsCountGe = parseInt(objectsCountGe);
			if (objectsCountGe == null)
				$objectsCountGe.addClass("error");
		}

		var apartmentsCountGe = $apartmentsCountGe.val();
		if (!apartmentsCountGe)
			apartmentsCountGe = null;
		else {
			apartmentsCountGe = parseInt(apartmentsCountGe);
			if (apartmentsCountGe == null)
				$apartmentsCountGe.addClass("error");
		}

		if (!recordType && recordNumber == null && !recordText && !dateFrom && !dateTo && !person && number == null && objectsCountGe == null && apartmentsCountGe == null) return null;
		return { recordType, recordNumber, recordText, dateFrom, dateTo, person, number, objectsCountGe, apartmentsCountGe };
	}
	_showSearchStats(objectIds /* : [] */, recordIds /* : {} */) {
		var objectsCount = objectIds.length;

		var apartmentsCount = 0;
		for (var i = 0; i < objectIds.length; i++) {
			var obj = this._model.getObjectById(objectIds[i]);
			if (obj instanceof Apartment)
				apartmentsCount++;
		}

		var recordsCount = 0;
		for (var id in recordIds)
		    if (recordIds.hasOwnProperty(id))
		        recordsCount++;

		var $el = this.$element();
		var $foundObjectsCount = $el.find("#" + this.uid + "_foundObjectsCount");
		var $foundApartmentsCount = $el.find("#" + this.uid + "_foundApartmentsCount");
		var $foundRecordsCount = $el.find("#" + this.uid + "_foundRecordsCount");
		$foundObjectsCount.text(objectsCount + " " + plural(objectsCount, ["объект", "объекта", "объектов"]));
		$foundApartmentsCount.text(apartmentsCount + " " + plural(apartmentsCount, ["квартира", "квартиры", "квартир"]));
		$foundRecordsCount.text(recordsCount + " " + plural(recordsCount, ["записи", "записях", "записях"]));
	}
}

export default SearchView;

import { Apartment } from "app/model/ModelClasses";
import { parseInt, parseDate, plural } from "app/utils";
import GridView from "app/views/GridView";
