import View from "app/views/View";

class Grid extends View {
	constructor(model, searchModel, recordSelectionModel) {
		super();
		var me = this;

		me.objectPopup = me.addChild(new ObjectPopup());

		me._model = model;
		me._searchModel = searchModel;
		me._recordSelectionModel = recordSelectionModel;

		me._searchModel.onChanged.bind(function() {
			me._showSearchResults();
		});
		me._recordSelectionModel.onChanged.bind(function() {
			me._showSelectedRecord();
		});
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="grid">
				${this.objectPopup.getHtml()}
				<div class="grid_content"></div>
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);
		var me = this;
		me.$element().click(function(ev) {
			var $t = $(ev.target);
			var $e = $t.closest(".grid_object");
			if ($e.length) {
				var id = $e[0].id;
				var prefix = me.uid + "_obj-";
				if (id && id.startsWith(prefix)) {
					id = id.substring(prefix.length);
					me._selectObject(id, ev);
				}
			}
		});
	}
	redraw() {
		this.objectPopup.hide();

		var acc = [];
		render(this.uid, this._model.objects, this._searchModel.getObjectIds(), acc);
		this.$element().children(".grid_content").html(acc.join(""));
	}
	_showSearchResults() {
		var $el = this.$element();
		if (!$el.length)
			return;
		$el.find(".grid_object__search").removeClass("grid_object__search");
		var ids = this._searchModel.getObjectIds();
		for (var i = 0, c = ids.length; i < c; i++) {
			var id = ids[i];
			$el.find("#" + this.uid + "_obj-" + id).addClass("grid_object__search");
		}
	}
	_showSelectedRecord() {
		var $el = this.$element();
		if (!$el.length)
			return;
		$el.find(".grid_object__selectedRecord").removeClass("grid_object__selectedRecord");
		var record = this._recordSelectionModel.getRecord();
		if (record)
		for (var i = 0, c = record.objects.length; i < c; i++) {
			var obj = record.objects[i];
			$el.find("#" + this.uid + "_obj-" + obj.id).addClass("grid_object__selectedRecord");
		}
	}
	_selectObject(objectId, ev) {
		var object = this._model.getObjectById(objectId);
		if (!object) return;

		this._recordSelectionModel.setRecord(object.record);

		this.objectPopup.setObject(object);
		this.objectPopup.show(ev);
	}
}

export default Grid;

import { htmlEncode } from "app/utils";
import ObjectPopup from "app/views/ObjectPopup";
import GridView from "app/views/GridView";
import { Apartment, NonResidentialPremise } from "app/model/ModelClasses";
import { Unknown, Cross } from "app/Strings";

function render(gridUid, objects, searchResults, acc) {
	objects.sort(function(a, b) {
		return (
			(GridView.isSupportedObject(a) - GridView.isSupportedObject(b)) ||
			(a.building - b.building) ||
			((a.section == null) - (b.section == null)) ||
			(a.section - b.section) ||
			((a.floor == null) - (b.floor == null)) ||
			(b.floor - a.floor) ||
			(a.number - b.number) ||
			((a.record.date != null) - (b.record.date != null)) ||
			(a.record.date - b.record.date));
	});

	var lastBuilding = null;
	var lastSection = null;
	var lastFloor = null;
	var lastType = null;

	for (var i = 0, c = objects.length; i < c; i++) {
		var obj = objects[i];
		if (!GridView.isSupportedObject(obj))
			continue;

		var building = obj.building;
		var section = obj.section;
		if (building != lastBuilding || section != lastSection) {
			if (lastFloor != null || lastType != null) {
				acc.push("</div>");
				lastFloor = null;
				lastType = null;
			}
			if (lastBuilding != null) {
				renderBuildingAndSectionInfo(lastBuilding, lastSection, acc);
				acc.push("</div>");
			}

			acc.push("<div class='grid_section'>");
			lastBuilding = building;
			lastSection = section;
		}

		var floor = obj.floor;
		var type = obj.constructor.name;
		if (floor != lastFloor || type != lastType) {
			if (lastFloor != null || lastType != null)
				acc.push("</div>");
			acc.push(`<div class='grid_floor grid_floor__${type}'>`);
			renderFloorInfo(obj, acc);
			lastFloor = floor;
			lastType = type;
		}

		renderObjectInfo(gridUid, obj, searchResults, acc);
	}

	acc.push("</div>");
	renderBuildingAndSectionInfo(lastBuilding, lastSection, acc);
	acc.push("</div>");
}

function renderBuildingAndSectionInfo(lastBuilding, lastSection, acc) {
	acc.push(`<div class='grid_sectionInfo'>Корпус ${lastBuilding} Секция ${lastSection == null ? Unknown : lastSection}</div>`);
}

function renderFloorInfo(obj, acc) {
	if (obj instanceof Apartment) {
		acc.push("<span class='grid_floorNumber'>");
		acc.push(htmlEncode(obj.floor.toString()));
		acc.push("</span>");
	}
	else if (obj instanceof NonResidentialPremise)
		acc.push(`<span class='grid_floorNumber' title='Нежилые помещения'>${Cross}</span>`);
}

function renderObjectInfo(gridUid, obj, searchResults, acc) {
	var cssClasses = ["grid_object"];
	if (obj.duplicate)
		cssClasses.push("grid_object__duplicate");
	if (obj.originalNumber != null)
		cssClasses.push("grid_object__withOriginalNumber");
	if (searchResults.indexOf(obj.id) >= 0)
		cssClasses.push("grid_object__search");
	cssClasses = cssClasses.join(" ");

	acc.push(`<div class="${cssClasses}" id="${gridUid + "_obj-" + obj.id}">`);
	if (obj.number != null)
		acc.push(htmlEncode(obj.number.toString()));
	acc.push("</div>");
}
