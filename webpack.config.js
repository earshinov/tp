var path = require("path");

module.exports = {
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
