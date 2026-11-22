// Local preview of mayooear/ai-pdf-chatbot-langchain (MIT).
// Upstream revision: 4b2647c41992a50b72ff6befb9a0bd71461e3dbe.
// The clone retains upstream LICENSE. No credentials are copied into the app.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const common = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim();
const checkout = resolve(dirname(resolve(root, common)), 'artifacts/ai-pdf-chatbot-langchain');
if (!existsSync(resolve(checkout, 'frontend/package.json'))) {
  throw new Error(`Chatbot chưa được tải về: ${checkout}`);
}
const patch = resolve(root, 'scripts/pdf-chat-preview.patch');
try {
  execFileSync('git', ['apply', '--reverse', '--check', patch], { cwd: checkout, stdio: 'pipe' });
} catch {
  execFileSync('git', ['apply', '--check', patch], { cwd: checkout, stdio: 'inherit' });
  execFileSync('git', ['apply', patch], { cwd: checkout, stdio: 'inherit' });
}
const child = spawn('npm', ['run', 'dev', '--workspace', 'frontend', '--', '--hostname', '127.0.0.1', '--port', '3005'], {
  cwd: checkout, stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_PREVIEW_ONLY: 'true', NEXT_PUBLIC_LANGGRAPH_API_URL: 'http://localhost:2024' },
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
