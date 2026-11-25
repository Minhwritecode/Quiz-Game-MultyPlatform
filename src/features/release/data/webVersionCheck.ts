const ACKED_BUILD_STORAGE_KEY = 'papyrus.acked_build_id.v1';
const RELOAD_COOLDOWN_KEY = 'papyrus.update_reload_ts.v1';

let sessionInitialBuildId: string | null = null;
let latestDetectedBuildId: string | null = null;

export function wasWebUpdateRecentlyReloaded(cooldownMs = 45_000): boolean {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(RELOAD_COOLDOWN_KEY);
      if (!raw) return false;
      const ts = Number(raw);
      return Number.isFinite(ts) && Date.now() - ts < cooldownMs;
    }
  } catch {
    // Ignore storage access restrictions
  }
  return false;
}

export function markWebUpdateReloaded(): void {
  acknowledgeWebBuildUpdate();
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(Date.now()));
    }
  } catch {
    // Ignore storage access restrictions
  }
}

function readAckedBuildId(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(ACKED_BUILD_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access restrictions
  }
  return null;
}

export function acknowledgeWebBuildUpdate(buildId?: string | null): void {
  const toAck = buildId || latestDetectedBuildId || sessionInitialBuildId;
  if (!toAck) return;
  sessionInitialBuildId = toAck;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(ACKED_BUILD_STORAGE_KEY, toAck);
    }
  } catch {
    // Ignore storage access restrictions
  }
}

/**
 * Checks `/version.json` without false-positive infinite reload loops:
 * - First call records the exact build currently running in this browser session.
 * - Subsequent polls return `true` ONLY when `/version.json` changes to a new build
 *   deployed AFTER this tab loaded AND not yet acknowledged by the user.
 */
export async function checkWebAppVersionUpdate(_fallbackBuildId?: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { build?: string };
    const remoteBuild = typeof data?.build === 'string' ? data.build.trim() : '';
    if (!remoteBuild) return false;

    latestDetectedBuildId = remoteBuild;

    // Establish baseline on initial page load so freshly reloaded tabs never re-prompt
    if (sessionInitialBuildId === null) {
      sessionInitialBuildId = remoteBuild;
      acknowledgeWebBuildUpdate(remoteBuild);
      return false;
    }

    if (remoteBuild === sessionInitialBuildId) {
      return false;
    }

    const acked = readAckedBuildId();
    if (acked && acked === remoteBuild) {
      sessionInitialBuildId = remoteBuild;
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
