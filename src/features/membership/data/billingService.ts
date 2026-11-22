import { supabase } from '@/core/network/supabase';
import {
  BILLING_PLANS,
  type BillingPlanId,
  type BillingPlanOption,
  type BillingProvider,
  type BillingSubscriptionRecord,
} from '../domain/billing';

export {
  BILLING_PLANS,
  type BillingPlanId,
  type BillingPlanOption,
  type BillingProvider,
  type BillingSubscriptionRecord,
};

export async function processBillingCheckout(
  planId: BillingPlanId,
  provider: BillingProvider,
  currentState?: { tier?: 'apprentice' | 'archmage'; tokenBalance?: number | null }
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
        // 1a. Invoke `billing-checkout` Edge Function (uses STRIPE_SECRET_KEY on server when configured)
        let stripeCheckoutUrl: string | null = null;
        let edgeSubId: string | null = null;
        try {
          const { data: edgeData, error: edgeErr } = await supabase.functions.invoke(
            'billing-checkout',
            {
              body: {
                action: 'create_session',
                plan_id: planId,
                provider,
              },
            }
          );
          if (!edgeErr && edgeData) {
            if (typeof edgeData.checkoutUrl === 'string' && edgeData.checkoutUrl.startsWith('http')) {
              stripeCheckoutUrl = edgeData.checkoutUrl;
            }
            if (edgeData.subscriptionId) {
              edgeSubId = String(edgeData.subscriptionId);
            }
          }
        } catch {
          // Edge function optional fallback to direct RPC
        }

        // 1b. Create session via RPC if Edge Function wasn't reachable
        let subId = edgeSubId;
        if (!subId) {
          const { data: created, error: createErr } = await supabase.rpc(
            'create_billing_checkout_session',
            {
              p_plan_id: planId,
              p_provider: provider,
            }
          );
          if (!createErr && created?.subscriptionId) {
            subId = String(created.subscriptionId);
          }
        }

        if (subId) {
          const { data: confirmed, error: confirmErr } = await supabase.rpc(
            'confirm_billing_payment',
            {
              p_subscription_id: subId,
              p_external_ref: `${provider}_${Date.now()}`,
            }
          );

          if (!confirmErr && confirmed) {
            return {
              ok: true,
              checkoutUrl: stripeCheckoutUrl,
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

  const nextTier: 'apprentice' | 'archmage' =
    planId !== 'token_pack_100' ? 'archmage' : currentState?.tier ?? 'apprentice';
  const currentTokens = currentState?.tokenBalance ?? 50;
  const nextTokens = currentTokens + plan.bonusTokens;

  return {
    ok: true,
    membershipTier: nextTier,
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
