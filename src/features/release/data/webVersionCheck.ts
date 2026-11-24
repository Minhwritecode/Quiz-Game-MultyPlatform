export async function checkWebAppVersionUpdate(localBuildId: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return false;
    const data = (await res.json()) as { build?: string };
    return Boolean(data?.build && data.build !== localBuildId);
  } catch {
    return false;
  }
}
