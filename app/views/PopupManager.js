class PopupManager {
	constructor() {
		var me = this;
		me._activePopup = null; /* : DOMElement */
		$(document.body).mousedown(function(ev) {
			if (me._activePopup && $(ev.target).closest(me._activePopup).length == 0)
				me._hide();
		});
	}
	registerPopup(el) {
		if (!el) throw new Error("Argument is null: el");
		if (el == this._activePopup) return;
		this._hide();
		this._activePopup = el;
	}
	_hide() {
		if (this._activePopup) {
			$(this._activePopup).hide();
			this._activePopup = null;
		}
	}
}

export default PopupManager;
