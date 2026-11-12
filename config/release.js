const variants = {
  development: { name: 'development', suffix: ' Dev', id: 'com.papyrus.quizclash.dev', scheme: 'papyrus-dev' },
  preview: { name: 'preview', suffix: ' Preview', id: 'com.papyrus.quizclash.preview', scheme: 'papyrus-preview' },
  production: { name: 'production', suffix: '', id: 'com.papyrus.quizclash', scheme: 'papyrus' },
};

function resolveVariant(name = 'development') {
  if (!Object.hasOwn(variants, name)) throw new Error(`Unknown APP_VARIANT: ${name}`);
  return variants[name];
}

function validateReleaseEnvironment(env, version, tag) {
  const problems = [];
  if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push('Version must be MAJOR.MINOR.PATCH.');
  if (tag && tag !== `v${version}`) problems.push('Git tag must match package.json version.');
  if (!env.APP_VARIANT || !Object.hasOwn(variants, env.APP_VARIANT)) problems.push('Set APP_VARIANT explicitly.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.EAS_PROJECT_ID || '')) problems.push('Set a real EAS_PROJECT_ID UUID.');
  const publicUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !/^(localhost|127\.|\[::1\])/.test(url.hostname); } catch { return false; } };
  if (!publicUrl(env.EXPO_PUBLIC_SUPABASE_URL)) problems.push('A hosted HTTPS Supabase URL is required.');
  const key = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  let anonJWT = false;
  try { anonJWT = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* publishable keys are not JWTs */ }
  if (!key.startsWith('sb_publishable_') && !anonJWT) problems.push('Use a publishable or anon key; never an administrative key.');
  if (env.APP_VARIANT === 'production') {
    for (const key of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_ACCOUNT_DELETION_URL', 'EXPO_PUBLIC_SUPPORT_URL']) {
      if (!publicUrl(env[key])) problems.push(`${key} must be a real public HTTPS URL.`);
    }
    try { const dsn = new URL(env.EXPO_PUBLIC_SENTRY_DSN); if (dsn.protocol !== 'https:' || !dsn.username || dsn.password) throw new Error(); } catch { problems.push('EXPO_PUBLIC_SENTRY_DSN must be a valid HTTPS DSN.'); }
    for (const key of ['SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN']) if (!env[key]) problems.push(`${key} is required for symbol uploads.`);
  }
  return problems;
}
module.exports = { resolveVariant, validateReleaseEnvironment };
