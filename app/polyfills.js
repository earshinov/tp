import "function.name-polyfill";

if (!String.prototype.startsWith) {
	String.prototype.startsWith = function(other) { return this.substring(0, other.length) === other; };
	String.prototype.endsWith = function(other) { return this.substring(this.length - other.length) === other; };
}
