// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// No custom blockList needed — the backend/ directory is outside this
// app/ directory and Metro does not traverse it.

module.exports = config;
