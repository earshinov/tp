var View = require("app/views/View");

class RecordInfo extends View {
	constructor(recordSelectionModel) {
		super();

		var me = this;
		me._recordSelectionModel = recordSelectionModel;

		me._recordSelectionModel.onChanged.bind(function() {
			var record = me._recordSelectionModel.getRecord();
			me._redraw(record);
		});
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="recordinfo">
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);
		var me = this;

		me.$element().click(function(ev) {
			if ($(ev.target).closest(".recordinfo_close").length)
				me._recordSelectionModel.clear();
		});
	}
	_redraw(/* optional */ record) {
		var acc = [];
		if (record)
			render(record, acc);
		this.$element().html(acc.join(""));
	}
}

module.exports = RecordInfo;

var utils = require("app/utils");
var m = require("app/model/ModelClasses");
var s = require("app/Strings");

function render(record, acc) {
	acc.push(`<div class='caption'>Информация о записи <span class='recordinfo_close'>${s.Cross}</span></div>`);
	acc.push(utils.htmlEncode(record.type));
	acc.push(", №");
	acc.push(utils.htmlEncode(record.number.toString()));
	acc.push("<br/>");

	if (record instanceof m.ParticipantsRegistryRecord) {
		acc.push("<div class='recordinfo_source'>");
		acc.push(utils.htmlEncode(record.source));
		acc.push("</div>");
	}
	else if (record instanceof m.OwnersRegistryRecord)
		acc.push(utils.htmlEncode(record.owner));
	else
		throw new Error("Неизвестный тип записи: " + record.constructor.name);
}
