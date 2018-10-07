import View from "app/views/View";

class ObjectPopup extends View {
	getHtml() {
		return `
			<div id="${this.uid}" class="objectpopup">
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);
	}
	setObject(object) {
		var acc = [];
		render(object, acc);
		this.$element().html(acc.join(""));
	}
	show(ev) {
		var $el = this.$element();

		var left = ev.pageX;
		var top = ev.pageY;
		$el.css({ left, top }).show();

		var w = $el.outerWidth();
		if (left + w > window.scrollX + window.innerWidth && left - w > window.scrollX)
			$el.css("left", left - w);

		var h = $el.outerHeight();
		if (top + h > window.scrollY + window.innerHeight && top - h > window.scrollY)
			$el.css("top", top - h);

		instance.popupManager.registerPopup($el[0]);
	}
	hide() {
		this.$element().hide();
	}
}

export default ObjectPopup;

import { htmlEncode } from "app/utils";
import { Unknown, formatDate } from "app/Strings";
import { OwnersRegistryRecord } from "app/model/ModelClasses";
import { instance } from "app/views/MainView";

function render(obj, acc) {
	acc.push(htmlEncode(obj.type));
	acc.push(" №");
	if (obj.originalNumber != null) {
		acc.push("<span class='objectpopup_withOriginalNumber'>");
		acc.push(htmlEncode(obj.number.toString()));
		acc.push("</span>");
		acc.push(" (");
		acc.push(htmlEncode(obj.originalNumber.toString()));
		acc.push(")");
	}
	else
		acc.push(htmlEncode(obj.number.toString()));
	acc.push("<br>");

	acc.push("Корпус ");
	acc.push(htmlEncode(obj.building.toString()));
	acc.push(", секция ");
	acc.push(obj.section == null ? Unknown : htmlEncode(obj.section.toString()));
	acc.push(", этаж ");
	acc.push(obj.floor == null ? Unknown : htmlEncode(obj.floor.toString()));
	acc.push("<br>");

	acc.push("Номер на площадке ");
	acc.push(obj.landingNumber == null ? Unknown : htmlEncode(obj.landingNumber.toString()));
	acc.push("<br>");

	acc.push("Площадь ");
	acc.push(obj.area.toString());
	acc.push(" кв.м.");
	acc.push("<br>");

	acc.push(obj.record.type);
	acc.push(obj.record instanceof OwnersRegistryRecord ? ",<br>" : ", ");
	acc.push("запись №");
	acc.push(htmlEncode(obj.record.number.toString()));
	acc.push("<br>");

	acc.push("Дата регистрации ");
	acc.push(obj.record.date == null ? Unknown : htmlEncode(formatDate(obj.record.date)));
}
