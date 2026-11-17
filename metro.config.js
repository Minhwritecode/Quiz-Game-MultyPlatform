const { getSentryExpoConfig } = require('@sentry/react-native/metro');

const config = getSentryExpoConfig(__dirname);
if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb', 'gltf');
}

module.exports = config;
