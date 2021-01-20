module.exports = {
  presets: [
    '@babel/preset-env',
    '@babel/preset-typescript'
  ],
  plugins: [
    "inferno",
    '@babel/plugin-proposal-class-properties',
    ['@babel/plugin-transform-typescript', {"allowNamespaces": true}],
    ['@babel/plugin-transform-runtime', {"regenerator": true}],
    "@babel/plugin-proposal-optional-chaining"
  ]
}
