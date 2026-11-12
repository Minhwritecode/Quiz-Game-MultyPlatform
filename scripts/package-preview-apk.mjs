// Package a local release-mode APK with a dedicated internal QA certificate.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if (!sdk) throw new Error('Set ANDROID_HOME to the installed Android SDK.');
const buildTools = readdirSync(join(sdk, 'build-tools'))
  .filter((name) => /^\d+\.\d+\.\d+$/.test(name))
  .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
if (!buildTools) throw new Error('Install stable Android SDK build-tools first.');
const tool = (name) => join(sdk, 'build-tools', buildTools, name);
const run = (command, args, env = process.env) => execFileSync(command, args, { cwd: root, env, encoding: 'utf8' });
const input = join(root, 'android/app/build/outputs/apk/release/app-release.apk');
if (!existsSync(input)) throw new Error('Build :app:assembleRelease with APP_VARIANT=preview first.');
const badging = run(tool('aapt'), ['dump', 'badging', input]);
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const packageLine = badging.split('\n').find((line) => line.startsWith('package:')) || '';
if (!packageLine.includes("name='com.papyrus.quizclash.preview'") || !packageLine.includes(`versionName='${version}'`)) {
  throw new Error('Only the matching Papyrus preview package/version can use this internal signing key.');
}
if (badging.includes('application-debuggable')) throw new Error('Use a release-mode build, not a debug APK.');
run(tool('zipalign'), ['-c', '-P', '16', '-v', '4', input]);

const privateDir = join(root, '.local-signing');
const key = join(privateDir, 'papyrus-preview.jks');
const metadata = join(privateDir, 'preview.json');
const alias = 'papyrus-preview';
mkdirSync(privateDir, { recursive: true, mode: 0o700 });
chmodSync(privateDir, 0o700);
if (existsSync(key) !== existsSync(metadata)) throw new Error('Restore the keystore and metadata together; never silently rotate a signing key.');
let password;
if (existsSync(key)) {
  const stored = JSON.parse(readFileSync(metadata, 'utf8'));
  if (stored.alias !== alias || typeof stored.password !== 'string' || stored.password.length < 16) throw new Error('Invalid internal signing metadata.');
  password = stored.password;
} else {
  password = randomBytes(32).toString('base64url');
  run('keytool', ['-genkeypair', '-keystore', key, '-storetype', 'JKS', '-alias', alias,
    '-storepass:env', 'PAPYRUS_APK_PASSWORD', '-keypass:env', 'PAPYRUS_APK_PASSWORD',
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=Papyrus Internal Preview', '-noprompt'],
  { ...process.env, PAPYRUS_APK_PASSWORD: password });
  writeFileSync(metadata, JSON.stringify({ alias, password }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
chmodSync(key, 0o600);
chmodSync(metadata, 0o600);
const outputDir = join(root, 'artifacts/android');
mkdirSync(outputDir, { recursive: true });
const filename = `papyrus-${version}-preview.apk`;
const output = join(outputDir, filename);
run(tool('apksigner'), ['sign', '--ks', key, '--ks-key-alias', alias,
  '--ks-pass', 'env:PAPYRUS_APK_PASSWORD', '--key-pass', 'env:PAPYRUS_APK_PASSWORD',
  '--out', output, input], { ...process.env, PAPYRUS_APK_PASSWORD: password });
const verification = run(tool('apksigner'), ['verify', '--verbose', '--print-certs', output]);
const sha256 = createHash('sha256').update(readFileSync(output)).digest('hex');
const certificate = verification.match(/Signer #1 certificate SHA-256 digest: (\S+)/)?.[1];
if (!certificate) throw new Error('Signature verification did not return the signing certificate.');
writeFileSync(join(outputDir, 'SHA256SUMS'), `${sha256}  ${filename}\n`);
writeFileSync(join(outputDir, 'signature.txt'), verification);
writeFileSync(join(outputDir, 'build-info.json'), JSON.stringify({
  filename, version, package: 'com.papyrus.quizclash.preview', sha256,
  signingCertificateSHA256: certificate, distribution: 'internal-preview',
  signedAt: new Date().toISOString(), sourceCommit: run('git', ['rev-parse', 'HEAD']).trim(),
  uncommittedChanges: run('git', ['status', '--porcelain']).trim().split('\n').filter(Boolean),
  androidMetadata: badging.split('\n').filter((line) => /^(package:|sdkVersion:|targetSdkVersion:|native-code:)/.test(line)),
  deviceAcceptance: 'Not asserted by packaging; record installation and smoke-test evidence separately.',
}, null, 2) + '\n');
console.log(`Signed internal APK: ${output}\nSHA256: ${sha256}\nBack up .local-signing securely; never share it with the APK.`);
