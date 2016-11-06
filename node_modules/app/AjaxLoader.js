class AjaxLoader {
	load(filename) {
		return $.get(filename).then(
			function(csv) {
				return csv;
			},
			function() {
				return new Error("Не удалось загрузить " + filename);
			});
	}
}

module.exports = AjaxLoader;
