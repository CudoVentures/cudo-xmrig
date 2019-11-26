const nodeExternals = require('webpack-node-externals')

module.exports = {
  target: 'node',
  mode: 'production',
  entry: './index.js',
  externals: [nodeExternals()],
  output: {
    filename: 'bundle.js',
    library: 'default',
    libraryTarget: 'commonjs'
  }
}
