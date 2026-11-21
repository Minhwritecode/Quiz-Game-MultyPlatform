import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import {
  BILLING_PLANS,
  fetchBillingHistory,
  processBillingCheckout,
  type BillingPlanId,
  type BillingProvider,
  type BillingSubscriptionRecord,
} from '../data/billingService';
import { useMembershipStore } from '../state/useMembershipStore';

const PROVIDERS: Array<{ id: BillingProvider; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'stripe', label: 'Stripe Card', icon: 'card-outline' },
  { id: 'payos', label: 'VietQR / PayOS', icon: 'qr-code-outline' },
  { id: 'iap_apple', label: 'Apple Pay / IAP', icon: 'logo-apple' },
  { id: 'iap_google', label: 'Google Pay', icon: 'logo-google' },
];

export function VipCheckoutModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const palette = usePalette();
  const tier = useMembershipStore((s) => s.tier);
  const [selectedPlan, setSelectedPlan] = useState<BillingPlanId>('archmage_monthly');
  const [provider, setProvider] = useState<BillingProvider>('stripe');
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<BillingSubscriptionRecord[]>([]);

  useEffect(() => {
    if (visible) {
      void fetchBillingHistory().then(setHistory);
    }
  }, [visible]);

  const handleCheckout = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const result = await processBillingCheckout(selectedPlan, provider);
      if (result.ok) {
        if (result.checkoutUrl) {
          void Linking.openURL(result.checkoutUrl).catch(() => undefined);
        }
        const refreshed = await fetchBillingHistory();
        setHistory(refreshed);
        Alert.alert(
          '🎉 Thanh toán thành công!',
          `Đã kích hoạt quyền lợi (${result.membershipTier === 'archmage' ? 'Đại Pháp Sư VIP' : 'Học giả'}) · Số dư AI Token: ${result.tokenBalance}⚡`,
          [{ text: 'Tuyệt vời', onPress: onClose }]
        );
      }
    } catch {
      Alert.alert('Lỗi thanh toán', 'Không thể hoàn tất giao dịch lúc này. Vui lòng thử lại.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[typography.label, { color: palette.gold }]}>BILLING & ENTITLEMENTS (ADR-010)</Text>
              <Text style={[typography.title, { color: palette.ink, fontSize: 19 }]}>
                👑 Nâng cấp Đại Pháp Sư & AI Token
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Đóng">
              <Ionicons name="close" size={22} color={palette.ink} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
            {/* Current Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}>
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                Hạng hiện tại: {tier === 'archmage' ? '👑 Đại Pháp Sư (Archmage VIP)' : '🌱 Học Giả Tập Sự (Free)'}
              </Text>
            </View>

            {/* Plan Selection */}
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '800', marginBottom: 6 }]}>
              1. CHỌN GÓI NÂNG CẤP HOẶC NẠP AI TOKEN
            </Text>
            <View style={{ gap: spacing.xs, marginBottom: spacing.md }}>
              {BILLING_PLANS.map((plan) => {
                const active = selectedPlan === plan.id;
                return (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlan(plan.id)}
                    style={[
                      styles.planCard,
                      {
                        borderColor: active ? palette.indigo : palette.paperMuted,
                        backgroundColor: active ? palette.paperRaised : palette.paper,
                      },
                    ]}
                  >
                    <View style={styles.planTop}>
                      <Text style={[typography.body, { color: palette.ink, fontWeight: '800', flex: 1 }]}>
                        {plan.title}
                      </Text>
                      {plan.badge ? <Badge tone="reward">{plan.badge}</Badge> : null}
                    </View>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      {plan.subtitle}
                    </Text>
                    <View style={[styles.planTop, { marginTop: 6 }]}>
                      <Text style={[typography.title, { color: palette.indigo, fontSize: 16 }]}>
                        {plan.priceLabel}
                      </Text>
                      <Badge tone="primary">+{plan.bonusTokens} AI Tokens</Badge>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {/* Payment Provider Selector */}
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '800', marginBottom: 6 }]}>
              2. PHƯƠNG THỨC THANH TOÁN
            </Text>
            <View style={styles.providerGrid}>
              {PROVIDERS.map((p) => {
                const active = provider === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setProvider(p.id)}
                    style={[
                      styles.providerChip,
                      {
                        borderColor: active ? palette.indigo : palette.paperMuted,
                        backgroundColor: active ? palette.indigo : palette.paperRaised,
                      },
                    ]}
                  >
                    <Ionicons name={p.icon} size={16} color={active ? '#FFFFFF' : palette.ink} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : palette.ink }}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Recent Billing Transactions */}
            {history.length > 0 && (
              <View style={{ marginTop: spacing.md }}>
                <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '800', marginBottom: 6 }]}>
                  LỊCH SỬ GIAO DỊCH SUPABASE ({history.length})
                </Text>
                {history.slice(0, 3).map((item) => (
                  <View
                    key={item.id}
                    style={[styles.historyRow, { borderColor: palette.paperMuted }]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
                        {item.planId} · {item.provider.toUpperCase()}
                      </Text>
                      <Text style={{ fontSize: 11, color: palette.inkMuted }}>
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')} · +{item.bonusTokens}⚡
                      </Text>
                    </View>
                    <Badge tone={item.status === 'active' ? 'success' : 'neutral'}>
                      {item.amountVnd.toLocaleString('vi-VN')}đ
                    </Badge>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button
              variant="reward"
              icon="lock-closed-outline"
              disabled={processing}
              onPress={() => void handleCheckout()}
              fullWidth
            >
              {processing ? 'Đang xác thực giao dịch...' : 'Thanh toán & Kích hoạt ngay'}
            </Button>
            <Button variant="ghost" onPress={onClose} fullWidth>
              Để sau
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  sheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusBanner: {
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  planCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  planTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  providerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    minWidth: '47%',
    flex: 1,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  footer: {
    gap: spacing.xs,
    marginTop: spacing.md,
  },
});
