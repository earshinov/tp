class FileLoader {
	load(file) {
		var d = $.Deferred();
		try {
			var reader = new window.FileReader();
			reader.onload = function(e) {
				d.resolve(e.target.result);
			};
			reader.onerror = function(err) {
				var message = "Не удалось загрузить файл";
				if (err !== undefined)
					message += ": " + err;
				d.reject(new Error(message));
			};
			reader.readAsText(file);
		}
		catch (ex) {
			d.reject(ex);
		}
		return d;
	}
}

export default FileLoader;
