/* jshint node: true */

var path = require("path");

var scss = require("gulp-sass");
var gutil = require("gulp-util");
var zip = require("gulp-zip");
var gulp = require("gulp");
var multipipe = require("multipipe");
var through2 = require("through2");
var webpack = require("webpack-stream");

// ========================================================
// Helpers - logging
// ========================================================

function logDest() {
	return through2.obj(function(file, enc, cb) {
		log("-> " + file.path);
		cb();
	});
}

function log() {
	gutil.log.apply(gutil, arguments);
}

function logError(error) {
	var message = error.messageFormatted || error.message;
	log(message);
}

// ========================================================
// Helpers - streams and error handling
// ========================================================

function prepStream(s /* : stream */) {
	return s.on("error", handleError);
}

function handleError(error) {
	log(formatError(error));
	this.end();
}

function formatError(error) {
	return error.messageFormatted || error.message;
}

function prepWebpackStream(s /* : stream */) {
	//
	// Обрабатываем события как "error", так и "compilation-error".
	// По какой-то причине webpack-stream в режиме watch при пересборках выдаёт только последний:
	//
	//    if (!options.watch) {
	// 	    self.emit('error', compilationError);
	//    }
	//    self.emit('compilation-error', compilationError);
	//
	// В то же время мы не хотим пропустить и error, если там не ошибка компиляции, а что-то другое.
	//
	var lastError = null;
	function handleWebpackError(error) {
		if (error !== lastError) {
			logError(error);
			lastError = error;
		}
		//this.end() - omitted intentionally
	}
	return s
		.on("error", handleWebpackError)
		.on("compilation-error", handleWebpackError);
}

// ========================================================
// JS
// ========================================================

var WEBPACK_CONFIG = {
	devtool: "source-map",
	resolve: {
		alias: {
			"app": path.resolve(__dirname, "app")
		}
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env'],
					}
				}
			},
		]
	},
	output: {
		filename: "app.js",
	},
};

function buildJs(/* optional */ webpackStreamConfig) {
	return function() {
		return prepStream(gulp.src(["app/main.js"], { base: "." }))
			.pipe(prepWebpackStream(webpack(Object.assign({
				config: WEBPACK_CONFIG,
				quiet: true,
			}, webpackStreamConfig))))
			.pipe(prepStream(gulp.dest(".")))
			.pipe(prepStream(logDest()));
	};
}
gulp.task("watch-js", buildJs({ watch: true }));
gulp.task("build-js", buildJs());

// ========================================================
// CSS
// ========================================================

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

// ========================================================

gulp.task("build", ["build-js", "build-css"]);
gulp.task("dev", ["watch-js", "watch-css"]);

function deploy() {
	gulp.src(["data/*.csv", "index.html", "css/*.css", "app.js", "lib/*.js", "**/web.config"], { base: "." })
		.pipe(zip("deploy.zip"))
		.pipe(gulp.dest("."))
		.pipe(logDest())
		.on("error", handleError);
}
gulp.task("deploy", ["build"], deploy);
