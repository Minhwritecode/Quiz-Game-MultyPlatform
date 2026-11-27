/**
 * Daily Streak & Gamified Recovery System
 * Duolingo & TikTok style study habit engine.
 */

export type StreakStatus = 'active' | 'at_risk' | 'frozen' | 'broken';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // Format: YYYY-MM-DD
  todayCompleted: boolean;
  streakFreezeCount: number; // Stored freeze shields (max 2 for Free, max 5 for VIP)
  status: StreakStatus;
  brokenStreakDays: number; // Previous streak length that can be restored
  brokenAtDate: string | null; // Date when the streak broke
  recoveryQuestAvailable: boolean; // True if within 24h recovery window
  lastFreezeGrantDate?: string | null; // Date of last weekly freeze grant
  historyDates?: string[]; // YYYY-MM-DD dates when user checked in or played
}

export type StreakActivityType = 'scan_ocr' | 'study_quiz' | 'battle' | 'daily_checkin';

/**
 * Returns today's date formatted as YYYY-MM-DD in local timezone
 */
export function getLocalDateString(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculates day difference between two YYYY-MM-DD strings
 */
export function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1 + 'T00:00:00');
  const d2 = new Date(dateStr2 + 'T00:00:00');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

function shiftLocalDateString(baseDateStr: string, deltaDays: number): string {
  const parts = baseDateStr.split('-').map(Number);
  const d = new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1);
  d.setDate(d.getDate() + deltaDays);
  return getLocalDateString(d);
}

/**
 * Normalizes `historyDates` and computes the exact consecutive day streak
 * so the numeric counter and the 7-day flame calendar strip ALWAYS match 100%.
 */
export function reconcileStreakWithHistory(
  rawDates: readonly string[] | undefined | null,
  todayStr = getLocalDateString(),
  options?: {
    allowFrozenGap?: boolean;
    fallbackLastActiveDate?: string | null;
    fallbackCurrentStreak?: number;
  }
): {
  normalizedDates: string[];
  consecutiveDays: number;
  longestInHistory: number;
  latestDate: string | null;
} {
  const validRe = /^\d{4}-\d{2}-\d{2}$/;
  const seeded = new Set<string>();
  for (const item of rawDates ?? []) {
    if (typeof item === 'string' && validRe.test(item)) {
      seeded.add(item);
    }
  }

  // Legacy migration: if historyDates was empty on an existing active streak, backfill consecutive days once
  if (
    seeded.size === 0 &&
    options?.fallbackLastActiveDate &&
    validRe.test(options.fallbackLastActiveDate) &&
    (options.fallbackCurrentStreak ?? 0) > 0
  ) {
    const count = Math.min(35, Math.max(1, Math.floor(options.fallbackCurrentStreak ?? 1)));
    for (let i = 0; i < count; i++) {
      seeded.add(shiftLocalDateString(options.fallbackLastActiveDate, -i));
    }
  }

  const normalizedDates = Array.from(seeded)
    .sort((a, b) => (a > b ? -1 : a < b ? 1 : 0))
    .slice(0, 60);

  if (normalizedDates.length === 0) {
    return {
      normalizedDates: [],
      consecutiveDays: 0,
      longestInHistory: 0,
      latestDate: null,
    };
  }

  const dateSet = new Set(normalizedDates);
  const yesterdayStr = shiftLocalDateString(todayStr, -1);
  const twoDaysAgoStr = shiftLocalDateString(todayStr, -2);

  let anchor: string | null = null;
  if (dateSet.has(todayStr)) {
    anchor = todayStr;
  } else if (dateSet.has(yesterdayStr)) {
    anchor = yesterdayStr;
  } else if (options?.allowFrozenGap && dateSet.has(twoDaysAgoStr)) {
    anchor = twoDaysAgoStr;
  }

  let consecutiveDays = 0;
  if (anchor) {
    let cursor = anchor;
    while (dateSet.has(cursor)) {
      consecutiveDays += 1;
      cursor = shiftLocalDateString(cursor, -1);
    }
  }

  // Compute longest contiguous run in history
  let longestInHistory = consecutiveDays;
  let currentRun = 1;
  for (let i = 1; i < normalizedDates.length; i++) {
    const prev = normalizedDates[i - 1]!;
    const curr = normalizedDates[i]!;
    if (getDaysDifference(prev, curr) === 1) {
      currentRun += 1;
      if (currentRun > longestInHistory) longestInHistory = currentRun;
    } else {
      currentRun = 1;
    }
  }

  return {
    normalizedDates,
    consecutiveDays,
    longestInHistory,
    latestDate: normalizedDates[0] ?? null,
  };
}
