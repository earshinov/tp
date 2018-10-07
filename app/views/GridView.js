import View from "app/views/View";

class GridView extends View {
	constructor(model) {
		super();
		var me = this;

		var searchModel = new SearchModel();
		var recordSelectionModel = new RecordSelectionModel();
		me.searchView = me.addChild(new SearchView(model, searchModel));
		me.recordInfo = me.addChild(new RecordInfo(recordSelectionModel));
		me.grid = me.addChild(new Grid(model, searchModel, recordSelectionModel));

		// handle this signal here to control the order of child views' updates
		model.onChanged.bind(function() {
			recordSelectionModel.clear();
			searchModel.onChanged.mute();
			me.searchView.apply();
			searchModel.onChanged.mute(-1);
			me.grid.redraw();
		});
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="gridview">
				<div class="gridview_sidebar">
					${this.searchView.getHtml()}
					${this.recordInfo.getHtml()}
				</div>
				${this.grid.getHtml()}
			</div>
		`;
	}
}

GridView.isSupportedObject = function(obj) {
	return obj instanceof Apartment || obj instanceof NonResidentialPremise;
};

export default GridView;

import Grid from "app/views/Grid";
import SearchView from "app/views/SearchView";
import SearchModel from "app/model/SearchModel";
import RecordSelectionModel from "app/model/RecordSelectionModel";
import RecordInfo from "app/views/RecordInfo";
import { Apartment, NonResidentialPremise } from "app/model/ModelClasses";
