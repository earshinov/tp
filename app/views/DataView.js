import View from "app/views/View";

class DataView extends View {
	constructor(loadController) {
		super();

		var me = this;
		me._loadController = loadController;

		loadController.onOperationStart.bind(function() {
			me._clearReport();
		});
		loadController.onOperationEnd.bind(function(/* optional */ ex) {
			if (ex) me._reportError(ex);
		});
	}

	getHtml() {
		return `
			<div id="${this.uid}" class="dataview">
				<div id="${this.uid + "_messages"}"></div>
				Используются следующие данные:
				<ul class="dataview_sources">
					<li>${renderLink(this._loadController.participantsRegistryUrl)}</li>
					<li>${renderLink(this._loadController.ownersRegistryUrl)}</li>
					<li>
						${renderLink(this._loadController.apartmentsWithoutSectionUrl)}
						<label>Загрузить свой файл: <input type="file" id="${this.uid + "_apartmentsWithoutSection"}"></label>
					</li>
					<li>
						${renderLink(this._loadController.incorrectApartmentsUrl)}
						<label>Загрузить свой файл: <input type="file" id="${this.uid + "_incorrectApartments"}"></label>
					</li>
					<li>
						${renderLink(this._loadController.oldApartmentNumbersUrl)}
						<label>Загрузить свой файл: <input type="file" id="${this.uid + "_oldApartmentNumbers"}"></label>
					</li>
					<li>
						${renderLink(this._loadController.juridicalPersonsUrl)}
						<label>Загрузить свой файл: <input type="file" id="${this.uid + "_juridicalPersons"}"></label>
					</li>
				</ul>
				<button id="${this.uid + "_refresh"}">Обновить</button>
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);

		var me = this;
		var $el = me.$element();

		$el.find("#" + this.uid + "_apartmentsWithoutSection").change(function(ev) {
			var file = ev.target.files[0];
			file
				? me._loadController.loadApartmentsWithoutSection(file)
				: me._loadController.loadDefaultApartmentsWithoutSection();
		});
		$el.find("#" + this.uid + "_incorrectApartments").change(function(ev) {
			var file = ev.target.files[0];
			file
				? me._loadController.loadIncorrectApartments(file)
				: me._loadController.loadDefaultIncorrectApartments();
		});
		$el.find("#" + this._uid + "_oldApartmentNumbers").change(function(ev) {
			var file = ev.target.files[0];
			file
				? me._loadController.loadOldApartmentNumbers(file)
				: me._loadController.loadDefaultOldApartmentNumbers();
		});
		$el.find("#" + this._uid + "_juridicalPersons").change(function(ev) {
			var file = ev.target.files[0];
			file
				? me._loadController.loadJuridicalPersons(file)
				: me._loadController.loadDefaultJuridicalPersons();
		});
		$el.find("#" + this.uid + "_refresh").click(function() {
			me._refresh();
		});
	}
	_refresh() {
		this._loadController.updateModel();
	}

	_clearReport() {
		this.$element().find("#" + this.uid + "_messages").html("");
	}
	_reportError(ex) {
		this.$element().find("#" + this.uid + "_messages").text(ex.message);
	}
}

export default DataView;

import { htmlEncode } from "app/utils";

function renderLink(url) {
	var filename = url.substring(url.lastIndexOf("/") + 1);
	return `<a href="${url}" target="_blank">${htmlEncode(filename)}</a>`;
}
