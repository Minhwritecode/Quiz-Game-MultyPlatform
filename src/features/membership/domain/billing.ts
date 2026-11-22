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
