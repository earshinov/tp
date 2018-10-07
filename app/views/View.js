module.exports = View;

var utils = require("app/utils");

// ========================================================

function View() {
	this.visible = true;
	this.uid = this.constructor.name + "-" + (View.counter++);

	this._parent = null;
	this.children = [];

	// delegates
	this.onDestroy = new utils.Delegate();

	View.views[this.uid] = this;
}

// @static
View.counter = 1;

// @static
View.views = {};

View.prototype.addChild = function(child) {
	if (child._parent)
		throw new Error("changing parent currently not supported");
	this.children.push(child);
	child._parent = this;
	// for convenience
	return child;
};

View.prototype.install = function($parent) {
	var element = utils.createFromHtml(this.getHtml());
	$parent.append(element);
	this.onInstalled($(element), $parent);
};

View.prototype.onInstalled = function(/* optional */ $element, /* optional */ $container) {
	if ($element) {
		this._$element = $element;
	}
	else {
		$element = $("#" + this.uid, $container);
		if (!$element.length)
			return;
		this._$element = $element;
	}

	if (!this.visible)
		this._$element[0].style.display = "none";

	// when a view is installed, usually its children are also installed
	var children = utils.Arrays.clone(this.children);
	for (var i = 0, c = children.length; i < c; i++)
		children[i].onInstalled(undefined, this._$element);
};

View.prototype.$element = function() {
	return this._$element || $([]);
};

View.prototype.getHtml = function() {
	throw new Error("Not implemented in " + this.constructor.name);
};

View.prototype.redraw = function() {
	var $el = this.$element();
	if ($el.length) {
		var el = utils.createFromHtml(this.getHtml());
		$el.replaceWith(el);
		this.onInstalled($(el));
	}
};

/*
Destroy the view and its children recursively, remove all handlers.
This method does not affect view's parent and ancestors.

The caller is responsible to:
  - remove the view from parent's children array
	(use `_removeChild` helper function)
  - remove view's $element from DOM
*/
View.prototype.destroy = function() {
	for (var i = 0, c = this.children.length; i < c; i++)
		this.children[i].destroy();
	this.children.length = 0;

	this.onDestroy.trigger();

	// prevent leaks
	this._parent = null;
	this.onDestroy = null;

	// remove from global collection
	delete View.views[this.uid];
};

// @static
View._removeChild = function(parent, child) {
	if (parent == null) throw new Error("Argument is null: parent");
	if (child == null) throw new Error("Argument is null: child");
	var pos = parent.children.indexOf(child);
	if (pos < 0)
		throw new Error("Could not find child view to remove", "parent", parent.uid, "child", child.uid);
	else
		parent.children.splice(pos, 1);
};

// PROPS

View.prototype.setVisible = function(visible) {
	this.visible = visible;

	if (this._$element) {
		if (this.visible)
			this._$element[0].style.removeProperty("display");
		else
			this._$element[0].style.display = "none";
	}
};

View.prototype.toggleVisible = function() {
	return this.setVisible(!this.visible);
};
