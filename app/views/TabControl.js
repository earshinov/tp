import View from "app/views/View";

class TabControl extends View {
	constructor() {
		super();
		this._tabs = [];
		this._activeId = null;
		this.onActiveIdChanged = new Delegate();
	}
	addTab(id, title) {
		if (id == null)
			throw new Error("Argument null: id");
		this._tabs.push({ id, title });
	}
	// @get/set
	activeId(/* optional */ value) {
		if (value === undefined)
			return this._activeId;
		return this._setActiveId(value, /* signal = */ false);
	}
	_setActiveId(value, signal /* = false */) {
		if (this._activeId == value) return false;
		if (this._activeId != null)
			this.$element().find("#" + this.uid + "_tab-" + this._activeId).removeClass("tabcontrol_tab__active");
		this._activeId = value;
		this.$element().find("#" + this.uid + "_tab-" + this._activeId).addClass("tabcontrol_tab__active");
		if (signal)
			this.onActiveIdChanged.trigger();
		return true;
	}
	getHtml() {
		return `
			<div id="${this.uid}" class="tabcontrol">
				${this._tabs.map(tab => `<span
					class="tabcontrol_tab ${tab.id == this._activeId ? "tabcontrol_tab__active" : ""}"
					id="${this.uid + "_tab-" + tab.id}">
					${htmlEncode(tab.title)}
				</span>`).join("")}
			</div>
		`;
	}
	onInstalled() {
		super.onInstalled(...arguments);
		var me = this;

		me.$element().children().click(function() {
			var prefix = me.uid + "_tab-";
			if (this.id && this.id.startsWith(prefix)) {
				var id = this.id.substring(prefix.length);
				me._setActiveId(id, /* signal = */ true);
			}
		});
	}
}

export default TabControl;

import { Delegate, htmlEncode } from "app/utils";
