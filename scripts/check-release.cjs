const { validateReleaseEnvironment } = require('../config/release');
const { version } = require('../package.json');
const { expo } = require('../app.json');
const env = { ...process.env, EAS_PROJECT_ID: process.env.EAS_PROJECT_ID || expo.extra?.eas?.projectId };
const problems = validateReleaseEnvironment(env, version, process.env.RELEASE_TAG);
if (problems.length) {
  console.error(`Release preflight failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exitCode = 1;
} else console.log('Release configuration is complete. Signing, device acceptance and store review remain separate gates.');
