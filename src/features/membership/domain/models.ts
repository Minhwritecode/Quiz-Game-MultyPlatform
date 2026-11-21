/**
 * User Membership & Tier Privileges System
 * Freemium vs VIP Archmage Scholar
 */

export type UserTier = 'apprentice' | 'archmage';

export interface TierPrivileges {
  tier: UserTier;
  title: string;
  badge: string;
  dailyScanLimit: number;
  dailyBattleCreateLimit: number;
  expMultiplier: number;
  hasGoldenAura: boolean;
  canCustomizeBattleRules: boolean;
  unlimitedSets: boolean;
}

export const TIER_CONFIGS: Record<UserTier, TierPrivileges> = {
  apprentice: {
    tier: 'apprentice',
    title: 'Học Giả Tập Sự',
    badge: '📜 Free',
    dailyScanLimit: 3,
    dailyBattleCreateLimit: 3,
    expMultiplier: 1.0,
    hasGoldenAura: false,
    canCustomizeBattleRules: false,
    unlimitedSets: false,
  },
  archmage: {
    tier: 'archmage',
    title: 'Đại Pháp Sư Tri Thức',
    badge: '👑 VIP Archmage',
    dailyScanLimit: 9999,
    dailyBattleCreateLimit: 9999,
    expMultiplier: 2.0,
    hasGoldenAura: true,
    canCustomizeBattleRules: true,
    unlimitedSets: true,
  },
};
