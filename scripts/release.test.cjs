const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveVariant, validateReleaseEnvironment } = require('../config/release');
const valid = {
  APP_VARIANT: 'preview', EAS_PROJECT_ID: '12345678-1234-1234-1234-123456789abc',
  EXPO_PUBLIC_SUPABASE_URL: 'https://test.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test',
};
test('variants install side by side and fail closed on typos', () => {
  assert.equal(new Set(['development','preview','production'].map(v=>resolveVariant(v).id)).size,3);
  assert.throws(()=>resolveVariant('prod'));
});
test('preflight rejects missing project, loopback, privileged key and mismatched tag', () => {
  assert.deepEqual(validateReleaseEnvironment(valid,'0.2.0','v0.2.0'),[]);
  assert.ok(validateReleaseEnvironment({...valid,EAS_PROJECT_ID:'',EXPO_PUBLIC_SUPABASE_URL:'http://localhost:54321',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_no'},'0.2.0','v1.0.0').length >= 4);
  const key = `e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.sig`;
  assert.ok(validateReleaseEnvironment({...valid,EXPO_PUBLIC_SUPABASE_ANON_KEY:key},'0.2.0').length);
});
test('production requires privacy/support/deletion URLs and observability', () => {
  assert.equal(validateReleaseEnvironment({...valid,APP_VARIANT:'production'},'0.2.0').length,7);
});
