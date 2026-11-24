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
