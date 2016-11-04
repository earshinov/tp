/* jshint node: true */

var browserify = require("browserify");
var scss = require("gulp-sass");
var gulp = require("gulp");
var multipipe = require("multipipe");
var through2 = require("through2");
var source = require("vinyl-source-stream");
var watchify = require("watchify");

var browserifyOpts = {
	entries: ["node_modules/app/main.js"],
	debug: true,
	verbose: true,
};

function logDest() {
	return through2.obj(function(file, enc, cb) {
		console.log("-> " + file.path);
		cb();
	});
}

function handleError(error) {
	console.log(error.messageFormatted || error.message);
	this.end();
}

function processJs() {
	var stream = source("app.js");
	multipipe(
		stream,
		gulp.dest("."),
		logDest()
	).on("error", handleError);
	return stream;
}
function buildJs() {
	browserify(browserifyOpts).bundle()
		.pipe(processJs());
}
function watchJs() {
	var b = watchify(browserify(Object.assign({}, watchify.args, browserifyOpts)));
	b.on("update", bundle);
	function bundle() {
		return b.bundle()
			.pipe(processJs());
	}
	return bundle();
}
gulp.task("watch-js", watchJs);
gulp.task("build-js", buildJs);

function buildCss() {
	return multipipe(
		gulp.src("css/*.scss", { base: "." }),
		scss(),
		gulp.dest("."),
		logDest()
	).on("error", handleError);
}
function watchCss() {
	return gulp.watch("css/*.scss", buildCss);
}
gulp.task("build-css", buildCss);
gulp.task("watch-css", watchCss);

gulp.task("build", ["build-js", "build-css"]);
gulp.task("dev", ["watch-js", "watch-css"]);
