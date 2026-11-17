const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

try {
  if (process.platform !== 'darwin') throw new Error('Local iOS builds require macOS/Xcode. Use EAS for cloud builds.');
  const packageRoot = dirname(require.resolve('expo-modules-jsi/package.json'));
  const manifest = readFileSync(join(packageRoot, 'apple/Package.swift'), 'utf8');
  const required = manifest.match(/swift-tools-version:\s*(\d+)\.(\d+)(?:\.(\d+))?/);
  const output = execFileSync('xcrun', ['swift', '--version'], { encoding: 'utf8' });
  const actual = output.match(/Swift version (\d+)\.(\d+)(?:\.(\d+))?/);
  if (!required || !actual) throw new Error('Cannot identify required or installed Swift version. Check the selected Xcode toolchain.');
  const parts = (match) => match.slice(1, 4).map((part) => Number(part || 0));
  const expected = parts(required);
  const installed = parts(actual);
  const difference = installed.map((part, index) => part - expected[index]).find((part) => part !== 0) || 0;
  if (difference < 0) throw new Error(`ExpoModulesJSI needs Swift >= ${expected.join('.')}; selected Xcode provides ${installed.join('.')}. Select a compatible Xcode or use the EAS iOS profile. Do not lower the dependency's tools-version to hide this failure.`);
  console.log(`Swift ${installed.join('.')} meets ExpoModulesJSI's minimum ${expected.join('.')}. Native compilation remains a separate check.`);
} catch (error) {
  console.error(`iOS toolchain check failed: ${error.message}`);
  process.exitCode = 1;
}
