var View = require("app/views/View");

var Example = `
SELECT r.source
FROM Apartment a
JOIN Record r ON r.id = a.recordId
WHERE a.number = 1
`.trim();

class SqlView extends View {
	constructor(sqlModel) {
		super();
		this._sqlModel = sqlModel;
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="sqlview">
				<div class="sqlview_wrapper">
					<div class="sqlview_controls">
						<textarea cols="40" rows="20"></textarea><br/>
						<button id="${this.uid + "_example"}" class="sqlview_btnExample">Пример</button>
						<button id="${this.uid + "_query"}">Выполнить</button>
					</div>
					<div class="sqlview_schema">
						<div class="caption">Схема:</div>
						<pre>${utils.htmlEncode(SqlModel.Schema)}</pre>
					</div>
				</div>
				<div id="${this.uid + "_messages"}" class="sqlview_messages"></div>
				<div id="${this.uid + "_results"}"></div>
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);
		var me = this;

		this.$element().find("#" + this.uid + "_query").click(function() {
			var sql = me.$element().find("textarea").val();
			me._query(sql);
		});

		this.$element().find("#" + this.uid + "_example").click(function() {
			me.$element().find("textarea").val(Example);
			me._query(Example);
		});
	}
	_query(sql) {
		this._clearReport();
		this._clearResults();

		if (sql.trim().length == 0) {
			this._reportFailure("Введите запрос");
			return;
		}

		try {
			var res = this._sqlModel.query(sql);
		}
		catch (ex) {
			this._reportError(ex);
			return;
		}
		this._showResults(res);
	}
	_clearReport() {
		var $messages = this.$element().find("#" + this.uid + "_messages");
		$messages.empty();
	}
	_reportFailure(message) {
		var $messages = this.$element().find("#" + this.uid + "_messages");
		$messages.text(message);
	}
	_reportError(ex) {
		this._reportFailure(ex.message);
	}
	_clearResults() {
		var $results = this.$element().find("#" + this.uid + "_results");
		$results.empty();
	}
	_showResults(datasets) {
		var $results = this.$element().find("#" + this.uid + "_results");
		var acc = [];
		for (var i = 0, c = datasets.length; i < c; i++)
			renderDataset(datasets[i], acc);
		$results.html(acc.join(""));
	}
}

module.exports = SqlView;

var utils = require("app/utils");
var SqlModel = require("app/model/SqlModel");

function renderDataset(dataset, acc) {
	if (dataset.length == 0) {
		acc.push("<table><tr><td><em>Нет результатов</em></td></tr></div>");
		return;
	}
	acc.push("<table>");
	for (var i = 0, c = dataset.length; i < c; i++) {
		var row = dataset[i];
		acc.push("<tr>");
		for (var j = 0, cj = row.length; j < cj; j++) {
			acc.push("<td>");
			var value = row[j];
			if (value != null)
				acc.push(utils.htmlEncode(row[j].toString()));
		}
	}
	acc.push("</table>");
}
