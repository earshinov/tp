import View from "app/views/View";

class MainView extends View
{
	constructor(model, loadController) {
		super();
		MainView.instance = this;
		var me = this;

		me._loadController = loadController;

		me.popupManager = new PopupManager();

		me.tabControl = me.addChild(new TabControl());
		me.tabControl.addTab(Tab.Data, "Данные");
		me.tabControl.addTab(Tab.Grid, "Шахматка");
		me.tabControl.addTab(Tab.Sql, "SQL");

		me.dataView = me.addChild(new DataView(loadController));
		me.gridView = me.addChild(new GridView(model));
		me.sqlView = me.addChild(new SqlView(model.sqlModel));
		me._onTabChanged();

		me.tabControl.onActiveIdChanged.bind(function() { me._onTabChanged(); });

		model.onChanged.bind(function() {
			if (me.getActiveTab() == Tab.Data)
				me.setActiveTab(Tab.Grid);
		});
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="mainview">
				${this.tabControl.getHtml()}
				${this.dataView.getHtml()}
				${this.gridView.getHtml()}
				${this.sqlView.getHtml()}
			</div>
		`;
	}

	getActiveTab() {
		return this.tabControl.activeId();
	}
	setActiveTab(value) {
		if (this.tabControl.activeId(value))
			this._onTabChanged();
	}
	_onTabChanged() {
		var id = this.tabControl.activeId();
		this.dataView.setVisible(id == Tab.Data);
		this.gridView.setVisible(id == Tab.Grid);
		this.sqlView.setVisible(id == Tab.Sql);
	}
}

var Tab = {
	Data: 1,
	Grid: 2,
	Sql: 3,
};

MainView.instance = null;
MainView.Tab = Tab;

export default MainView;

import TabControl from "app/views/TabControl";
import DataView from "app/views/DataView";
import GridView from "app/views/GridView";
import SqlView from "app/views/SqlView";
import PopupManager from "app/views/PopupManager";
