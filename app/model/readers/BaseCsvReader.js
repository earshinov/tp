class BaseCsvReader {
	// config: {
	//   skipRows /* = 0 */
	// }
	constructor(config) {
		this._config = config || {};
	}
	read(csv, callback) {
		var me = this;

		var readable = new stream.Readable();
		readable.push(csv);
		readable.push(null);

		var parser = parse({
			delimiter: "\t",
			relax_column_count: true,
		});
		readable.pipe(parser);

		var skipRows = this._config.skipRows || 0;
		parser.on("readable", function() {
			var record;
			while ((record = parser.read())) {
				if (skipRows > 0) {
					--skipRows;
					continue;
				}
				record = record.map(x => x.trim());
				me._processRecord(record);
			}
		});
		parser.on("error", function(ex) {
			var err = new CsvError(parser.lines, ex);
			me._finish(err);
			callback(err);
		});
		parser.on("finish", function() {
			var err = null;
			me._finish(err);
			callback(err);
		});
	}
	// @abstract
	_processRecord(record) {
		throw new Error("Not implemented");
	}
	// @virtual
	_finish(/* optional */ err) {
	}
}

module.exports = BaseCsvReader;

var parse = require("csv-parse");
var stream = require("stream");
var CsvError = require("app/exceptions/CsvError");
