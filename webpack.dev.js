const merge = require('webpack-merge');
const common = require('./webpack.core.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    contentBase: './dist',
    compress: true,
    port: 3000
  }
})
