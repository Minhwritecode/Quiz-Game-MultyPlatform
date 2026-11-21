import { supabase } from '@/core/network/supabase';
import { useMembershipStore } from '../state/useMembershipStore';
import { useAiQuizStore } from '@/features/ai-quiz/state/useAiQuizStore';

export type BillingPlanId = 'archmage_monthly' | 'archmage_yearly' | 'token_pack_100';
export type BillingProvider = 'stripe' | 'iap_apple' | 'iap_google' | 'payos';

export interface BillingPlanOption {
  id: BillingPlanId;
  title: string;
  subtitle: string;
  priceLabel: string;
  amountVnd: number;
  bonusTokens: number;
  badge?: string;
}

export const BILLING_PLANS: BillingPlanOption[] = [
  {
    id: 'archmage_monthly',
    title: 'Đại Pháp Sư (VIP Tháng)',
    subtitle: 'Quét OCR & Tạo phòng không giới hạn + 2 Khiên Băng/tuần + 100 AI Tokens',
    priceLabel: '79.000đ / tháng',
    amountVnd: 79000,
    bonusTokens: 100,
    badge: 'Phổ biến nhất',
  },
  {
    id: 'archmage_yearly',
    title: 'Đại Pháp Sư (VIP Năm)',
    subtitle: 'Toàn bộ đặc quyền VIP 12 tháng + 1.000 AI Tokens RAG trích dẫn',
    priceLabel: '599.000đ / năm',
    amountVnd: 599000,
    bonusTokens: 1000,
    badge: 'Tiết kiệm 37%',
  },
  {
    id: 'token_pack_100',
    title: 'Gói Nạp +100 AI Tokens',
    subtitle: 'Dùng cho AI Quiz Generator & Kho tri thức RAG pgvector',
    priceLabel: '29.000đ / gói',
    amountVnd: 29000,
    bonusTokens: 100,
  },
];

export interface BillingSubscriptionRecord {
  id: string;
  planId: BillingPlanId;
  provider: BillingProvider;
  status: 'pending' | 'active' | 'cancelled' | 'expired';
  amountVnd: number;
  bonusTokens: number;
  createdAt: string;
}

export async function processBillingCheckout(
  planId: BillingPlanId,
  provider: BillingProvider
): Promise<{
  ok: boolean;
  checkoutUrl?: string | null;
  membershipTier: 'apprentice' | 'archmage';
  tokenBalance: number;
  subscriptionId: string;
}> {
  const plan = BILLING_PLANS.find((p) => p.id === planId) ?? BILLING_PLANS[0]!;

  if (supabase) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        const { data: created, error: createErr } = await supabase.rpc(
          'create_billing_checkout_session',
          {
            p_plan_id: planId,
            p_provider: provider,
          }
        );

        if (!createErr && created?.subscriptionId) {
          const subId = String(created.subscriptionId);
          const { data: confirmed, error: confirmErr } = await supabase.rpc(
            'confirm_billing_payment',
            {
              p_subscription_id: subId,
              p_external_ref: `${provider}_${Date.now()}`,
            }
          );

          if (!confirmErr && confirmed) {
            if (planId !== 'token_pack_100') {
              useMembershipStore.getState().upgradeToVip();
            }
            if (typeof confirmed.tokenBalance === 'number') {
              useAiQuizStore.setState({ tokenBalance: confirmed.tokenBalance });
            }
            return {
              ok: true,
              membershipTier: confirmed.membershipTier === 'archmage' ? 'archmage' : 'apprentice',
              tokenBalance: Number(confirmed.tokenBalance ?? 150),
              subscriptionId: subId,
            };
          }
        }
      }
    } catch {
      // Fallback to local entitlement activation below
    }
  }

  if (planId !== 'token_pack_100') {
    useMembershipStore.getState().upgradeToVip();
  }
  const currentTokens = useAiQuizStore.getState().tokenBalance ?? 50;
  const nextTokens = currentTokens + plan.bonusTokens;
  useAiQuizStore.setState({ tokenBalance: nextTokens });

  return {
    ok: true,
    membershipTier: useMembershipStore.getState().tier,
    tokenBalance: nextTokens,
    subscriptionId: `sub-local-${Date.now()}`,
  };
}

export async function fetchBillingHistory(): Promise<BillingSubscriptionRecord[]> {
  if (!supabase) return [];
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return [];
    const { data, error } = await supabase
      .from('billing_subscriptions')
      .select('id, plan_id, provider, status, amount_vnd, bonus_tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !Array.isArray(data)) return [];
    return data.map((row) => ({
      id: String(row.id),
      planId: (row.plan_id as BillingPlanId) ?? 'archmage_monthly',
      provider: (row.provider as BillingProvider) ?? 'stripe',
      status: (row.status as BillingSubscriptionRecord['status']) ?? 'active',
      amountVnd: Number(row.amount_vnd ?? 79000),
      bonusTokens: Number(row.bonus_tokens ?? 100),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
  } catch {
    return [];
  }
}
