import View from "app/views/View";

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

export default RecordInfo;

import { htmlEncode } from "app/utils";
import { ParticipantsRegistryRecord, OwnersRegistryRecord } from "app/model/ModelClasses";
import { Cross } from "app/Strings";

function render(record, acc) {
	acc.push(`<div class='caption'>Информация о записи <span class='recordinfo_close'>${Cross}</span></div>`);
	acc.push(htmlEncode(record.type));
	acc.push(", №");
	acc.push(htmlEncode(record.number.toString()));
	acc.push("<br/>");

	if (record instanceof ParticipantsRegistryRecord) {
		acc.push("<div class='recordinfo_source'>");
		acc.push(htmlEncode(record.source));
		acc.push("</div>");
	}
	else if (record instanceof OwnersRegistryRecord)
		acc.push(htmlEncode(record.owner));
	else
		throw new Error("Неизвестный тип записи: " + record.constructor.name);
}
