/**
 * Standard competitive ELO rating engine.
 * Start: 1200 | Floor: 100 | Provisional K=40 (first 10 games), K=24 thereafter.
 */
export const ELO_INITIAL = 1200;
export const ELO_FLOOR = 100;
export const PROVISIONAL_GAMES = 10;

export type EloMatchOutcome = 1 | 0.5 | 0;

export interface EloTier {
  id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'archmage';
  labelVi: string;
  labelEn: string;
  badge: string;
  color: string;
  minRating: number;
}

export const ELO_TIERS: EloTier[] = [
  { id: 'archmage', labelVi: 'Đại Pháp Sư', labelEn: 'Archmage', badge: '👑', color: '#F59E0B', minRating: 1800 },
  { id: 'diamond', labelVi: 'Kim Cương', labelEn: 'Diamond', badge: '💎', color: '#06B6D4', minRating: 1600 },
  { id: 'platinum', labelVi: 'Bạch Kim', labelEn: 'Platinum', badge: '🔷', color: '#6366F1', minRating: 1400 },
  { id: 'gold', labelVi: 'Vàng', labelEn: 'Gold', badge: '🥇', color: '#D97706', minRating: 1250 },
  { id: 'silver', labelVi: 'Bạc', labelEn: 'Silver', badge: '🥈', color: '#64748B', minRating: 1100 },
  { id: 'bronze', labelVi: 'Đồng', labelEn: 'Bronze', badge: '🥉', color: '#B45309', minRating: 0 },
];

export function kFactor(matchesPlayed: number): number {
  return matchesPlayed < PROVISIONAL_GAMES ? 40 : 24;
}

export function eloDelta(
  ratingA: number,
  ratingB: number,
  outcomeA: EloMatchOutcome,
  k: number
): number {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  return Math.round(k * (outcomeA - expectedA));
}

export function applyEloFloor(rating: number): number {
  return Math.max(Math.round(rating), ELO_FLOOR);
}

export function computeNextElo(
  currentRating: number,
  opponentRating: number,
  outcome: EloMatchOutcome,
  matchesPlayed: number
): { nextRating: number; delta: number } {
  const k = kFactor(matchesPlayed);
  const rawDelta = eloDelta(currentRating, opponentRating, outcome, k);
  const nextRating = applyEloFloor(currentRating + rawDelta);
  return { nextRating, delta: nextRating - currentRating };
}

export function getEloTier(rating: number): EloTier {
  for (const tier of ELO_TIERS) {
    if (rating >= tier.minRating) return tier;
  }
  return ELO_TIERS[ELO_TIERS.length - 1]!;
}

export type DuelCategoryId = 'general' | 'coding' | 'math' | 'science' | 'history' | 'english';

export const DUEL_CATEGORIES: Array<{ id: DuelCategoryId; label: string; icon: string }> = [
  { id: 'coding', label: 'Lập trình', icon: '💻' },
  { id: 'general', label: 'Tổng hợp', icon: '🌐' },
  { id: 'math', label: 'Toán học', icon: '📐' },
  { id: 'science', label: 'Khoa học', icon: '🔬' },
  { id: 'history', label: 'Lịch sử', icon: '📜' },
  { id: 'english', label: 'Tiếng Anh', icon: '🇬🇧' },
];

/** Widening ELO matchmaking band: starts at ±100 and widens smoothly up to ±500 with wait time. */
export function eloSearchBand(waitSeconds: number): number {
  return Math.min(500, 100 + Math.floor(Math.max(0, waitSeconds) / 2) * 50);
}

/** Difficulty-tiered bot mirroring player ELO (±75) when queue has no human after 8s. */
export function pickTieredBot(playerElo: number): { name: string; elo: number; accuracy: number } {
  const names = ['Học giả Minerva', 'Kỵ sĩ Alan', 'Pháp sư Ada', 'Thủ lĩnh Euler', 'Chiến binh Gauss'];
  const idx = Math.abs(Math.round(playerElo / 50)) % names.length;
  const offset = (idx - 2) * 28;
  const elo = applyEloFloor(playerElo + offset);
  const accuracy = Math.min(0.92, Math.max(0.45, 0.52 + (elo - 1000) / 1800));
  return { name: names[idx] ?? 'Học giả Nova', elo, accuracy };
}
