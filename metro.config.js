// Default Expo Metro config. Kept explicit so custom resolver tweaks have a home.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
