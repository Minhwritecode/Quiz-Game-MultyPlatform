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
