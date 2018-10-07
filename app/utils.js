// ====================================================
// JS
// ====================================================

export function parseInt(value) {
	value = window.parseInt(value, 10);
	return isNaN(value) ? null : value;
}

export function parseFloat(value) {
	value = window.parseFloat(value);
	return isNaN(value) ? null : value;
}

export function parseDate(value) {
	var date = new Date(value);
	return isNaN(date.getTime()) ? null : date;
}

// ====================================================
// Arrays
// ====================================================

export var Arrays = {

	clone: function(a) {
		return a.slice(0);
	},

	findFirstIndex: function(a, value) {
		return a.indexOf(value);
	},

	// remove first value === given
	removeFirst: function(a, value) {
		var pos = this.findFirstIndex(a, value);
		if (pos >= 0) {
			a.splice(pos, 1);
			return true;
		}
		return false;
	},
};

// ====================================================
// Strings
// ====================================================

export function cutString(s, maxLength, ellipsis /* = "..." */) {
	if (ellipsis === undefined)
		ellipsis = "...";
	return s.length <= maxLength ? s : s.substring(0, maxLength) + ellipsis;
}

// ====================================================
// HTML
// ====================================================

export function htmlEncode(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ====================================================
// DOM
// ====================================================

export function createFromHtml(html) {
	var div = document.createElement("div");
	div.innerHTML = html;
	if (div.children.length != 1)
		throw new Error("Failed to create DOM element from HTML: " + cutString(html, 20));
	return div.firstElementChild;
}

// ====================================================
// L18N
// ====================================================

// http://translate.sourceforge.net/wiki/l10n/pluralforms
export function plural(n, /* optional */ a) {
	n = (n % 10 == 1 && n % 100 != 11 ? 0 : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 1 : 2);
	return a === undefined ? n : a[n];
}

// ====================================================
// Delegate
// ====================================================

export class Delegate {
	constructor() {
		this.handlers = [];
		this._mute = 0;
	}
	bind(handler, /* optional */ context) {
		if (handler == null) throw new Error("Argument is null: handler");
		this.handlers.push({ handler: handler, context: context });
	}
	unbind(handler, /* optional */ context) {
		if (handler == null) throw new Error("Argument is null: handler");
		var len = this.handlers.length;
		this.handlers = this.handlers.filter(h => !(h.handler === handler && (context === undefined || h.context === context)));
		if (this.handlers.length == len)
			throw new Error("Handler to unbind was not found");
	}
	trigger(/* optional */ data) {
		if (this._mute > 0) return;
		if (data === undefined) data = {};
		var handlers = Arrays.clone(this.handlers);
		for (var i = 0, c = handlers.length; i < c; i++) {
			var h = handlers[i];
			h.handler.call(h.context, data);
		}
	}
	mute(inc /* = 1 */) {
		if (inc === undefined) inc = 1;
		this._mute += inc;
	}
	getLength() {
		return this.handlers.length;
	}
}
