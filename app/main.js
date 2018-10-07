require("app/polyfills");

var MainView = require("app/views/MainView");
var IncompatibleBrowserView = require("app/views/IncompatibleBrowserView");
var Model = require("app/model/Model");
var LoadController = require("app/LoadController");

$(checkBrowser() ? main : incompatibleBrowser);

function checkBrowser() {
	// IE implementation of flexbox is unaccaptable because of numerous hard-to-fix bugs
	if (/MSIE/.test(navigator.userAgent) || /Trident/.test(navigator.userAgent))
		return false;

	return Modernizr.flexwrap;
}

function main() {

	var model = new Model();
	var loadController = new LoadController(model);

	var mainView = new MainView(model, loadController);
	mainView.install($(document.body));

	loadController.init().then(
		function() { if (!mainView.getActiveTab()) mainView.setActiveTab(MainView.Tab.Grid); },
		function() { if (!mainView.getActiveTab()) mainView.setActiveTab(MainView.Tab.Data); });
}

function incompatibleBrowser() {
	new IncompatibleBrowserView().install($(document.body));
}
