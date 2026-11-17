import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const results=JSON.parse(await readFile('build-result.json','utf8'));
const builds=Array.isArray(results)?results:[results];
await mkdir('artifacts',{recursive:true});
const checksums=[];
for(const build of builds) {
  if(build.status !== 'FINISHED' || !['ANDROID','IOS'].includes(build.platform))throw new Error('EAS did not return a finished mobile build.');
  if(!/^[a-f0-9-]{36}$/i.test(build.id))throw new Error('Invalid EAS build ID.');
  const url=new URL(build.artifacts?.buildUrl || build.artifacts?.applicationArchiveUrl);
  if(url.protocol !== 'https:')throw new Error('Artifact download must use HTTPS.');
  const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw new Error(`Artifact download failed (${response.status})`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length < 4 || bytes.readUInt32LE(0)!==0x04034b50)throw new Error('Artifact is not an APK/AAB/IPA ZIP archive.');
  const extension=build.platform==='IOS'?'ipa':process.env.APP_VARIANT==='production'?'aab':'apk';
  const name=`papyrus-${build.id}.${extension}`;
  await writeFile(`artifacts/${name}`,bytes);
  checksums.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`);
}
if(!checksums.length)throw new Error('No build artifacts returned.');
await writeFile('artifacts/SHA256SUMS',checksums.join('\n')+'\n');
await writeFile('artifacts/commit.txt',(process.env.GITHUB_SHA || 'local')+'\n');
console.log(`Collected ${checksums.length} binary artifact(s). Signature/device verification is a separate gate.`);
