export type ReleasePolicy = { minimumVersion: string; storeUrl: string };
export function needsUpgrade(current: string, policy: ReleasePolicy): boolean {
  const pattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
  if (!pattern.test(current) || !pattern.test(policy.minimumVersion)) return false;
  try {
    const url = new URL(policy.storeUrl);
    if (url.protocol !== 'https:' || !['apps.apple.com', 'play.google.com'].includes(url.hostname)) return false;
  } catch { return false; }
  const target = policy.minimumVersion.split('.').map(Number);
  for (const [index, part] of current.split('.').map(Number).entries()) {
    if (part !== target[index]) return part < target[index]!;
  }
  return false;
}

export type ReviewHistory = { firstUsed: number; completed: string[]; lastPrompt?: number };
export function recordCompletion(history: ReviewHistory, attempt: string, now: number) {
  const fresh = !history.completed.includes(attempt);
  const next = { ...history, completed: fresh ? [...history.completed, attempt].slice(-100) : history.completed };
  const day = 86_400_000;
  return { next, eligible: fresh && next.completed.length >= 5 && now - next.firstUsed >= 7 * day && (next.lastPrompt === undefined || now - next.lastPrompt >= 90 * day) };
}
