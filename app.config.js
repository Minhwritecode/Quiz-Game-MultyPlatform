const { expo } = require('./app.json');
const { version } = require('./package.json');
const { resolveVariant } = require('./config/release');

module.exports = () => {
  const variant = resolveVariant(process.env.APP_VARIANT);
  const projectId = process.env.EAS_PROJECT_ID;
  const sentry = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT;
  return {
    ...expo,
    version,
    // Existing game timers are not compiler-ready yet; keep their runtime behavior.
    experiments: { ...expo.experiments, reactCompiler: false },
    name: `Papyrus${variant.suffix}`,
    scheme: variant.scheme,
    android: { ...expo.android, package: variant.id, blockedPermissions: ['android.permission.RECORD_AUDIO'] },
    ios: { ...expo.ios, bundleIdentifier: variant.id, supportsTablet: true },
    runtimeVersion: { policy: 'fingerprint' },
    updates: projectId ? { url: `https://u.expo.dev/${projectId}`, fallbackToCacheTimeout: 0 } : { enabled: false },
    extra: { appVariant: variant.name, ...(projectId ? { eas: { projectId } } : {}) },
    plugins: [
      ...expo.plugins,
      ['expo-build-properties', { android: { enableMinifyInReleaseBuilds: true, enableShrinkResourcesInReleaseBuilds: true } }],
      ...(sentry ? [['@sentry/react-native/expo', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, url: 'https://sentry.io/' }]] : []),
    ],
  };
};
