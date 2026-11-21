import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMembershipStore } from '../state/useMembershipStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { Button, Card, usePalette } from '@/shared/ui';
import { sfx } from '@/core/audio/sfx';

export function VipBadge() {
  const palette = usePalette();
  const [modalVisible, setModalVisible] = useState(false);

  const tier = useMembershipStore((state) => state.tier);
  const toggleTier = useMembershipStore((state) => state.toggleTier);
  const privileges = useMembershipStore((state) => state.getPrivileges());
  const remainingScans = useMembershipStore((state) => state.getRemainingScans());
  const remainingBattles = useMembershipStore((state) => state.getRemainingBattles());

  const isVip = tier === 'archmage';

  const handleToggleVip = () => {
    toggleTier();
    sfx.playLevelUp();
    setModalVisible(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setModalVisible(true)}
        accessibilityRole="button"
        accessibilityLabel={`Cấp độ: ${privileges.title}`}
        style={[
          styles.pill,
          {
            backgroundColor: isVip ? 'rgba(245, 158, 11, 0.18)' : palette.paperRaised,
            borderColor: isVip ? '#F59E0B' : palette.paperMuted,
          },
        ]}
      >
        <Text style={[typography.caption, { color: isVip ? '#D97706' : palette.ink, fontWeight: '800' }]}>
          {isVip ? '👑 VIP' : '📜 Free'}
        </Text>
      </Pressable>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={[styles.modalContent, { backgroundColor: palette.paper }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={{ fontSize: 44 }}>{isVip ? '👑' : '✨'}</Text>
              <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
                {isVip ? 'Đại Pháp Sư Tri Thức (VIP)' : 'Đặc Quyền Học Giả'}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
                {isVip
                  ? 'Bạn đang sở hữu toàn bộ quyền năng cao cấp của học viện Papyrus.'
                  : 'Nâng cấp VIP để mở khóa không giới hạn tính năng và nhận Hào quang Vàng.'}
              </Text>
            </View>

            {/* Daily Usage Quota */}
            <View style={[styles.quotaBox, { backgroundColor: palette.paperRaised }]}>
              <View style={styles.quotaRow}>
                <Text style={[typography.body, { color: palette.ink }]}>Lượt Quét OCR hôm nay:</Text>
                <Text style={[typography.body, { color: palette.indigo, fontWeight: '700' }]}>
                  {isVip ? 'Không giới hạn ♾️' : `${remainingScans}/3 còn lại`}
                </Text>
              </View>
              <View style={[styles.quotaRow, { marginTop: 8 }]}>
                <Text style={[typography.body, { color: palette.ink }]}>Lượt Tạo Phòng Đấu:</Text>
                <Text style={[typography.body, { color: palette.indigo, fontWeight: '700' }]}>
                  {isVip ? 'Không giới hạn ♾️' : `${remainingBattles}/3 còn lại`}
                </Text>
              </View>
            </View>

            {/* Privileges Comparison Table */}
            <View style={styles.perksList}>
              <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', marginBottom: 8 }]}>
                ĐẶC QUYỀN VIP ARCHMAGE:
              </Text>

              <View style={styles.perkRow}>
                <Text>⚡</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  OCR Scan tài liệu không giới hạn số trang
                </Text>
                <Text style={{ color: '#10B981', fontWeight: '700' }}>{isVip ? 'Bật' : 'VIP'}</Text>
              </View>

              <View style={styles.perkRow}>
                <Text>⚔️</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Tạo phòng Realtime Battle tùy chỉnh luật chơi
                </Text>
                <Text style={{ color: '#10B981', fontWeight: '700' }}>{isVip ? 'Bật' : 'VIP'}</Text>
              </View>

              <View style={styles.perkRow}>
                <Text>🛡️</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Tặng 2 Bùa Đóng Băng Chuỗi (Streak Freeze) mỗi tuần
                </Text>
                <Text style={{ color: '#10B981', fontWeight: '700' }}>{isVip ? 'Bật' : 'VIP'}</Text>
              </View>

              <View style={styles.perkRow}>
                <Text>🌟</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Nhân đôi EXP tu luyện (2x EXP) sau mỗi trận đấu
                </Text>
                <Text style={{ color: '#10B981', fontWeight: '700' }}>{isVip ? 'Bật' : 'VIP'}</Text>
              </View>

              <View style={styles.perkRow}>
                <Text>🔮</Text>
                <Text style={[typography.body, { color: palette.ink, flex: 1, marginLeft: 8 }]}>
                  Hào quang Hoàng Gia (Golden Aura) trên Avatar 3D
                </Text>
                <Text style={{ color: '#10B981', fontWeight: '700' }}>{isVip ? 'Bật' : 'VIP'}</Text>
              </View>
            </View>

            {/* Upgrade / Switch Tier Button */}
            <View style={{ marginTop: spacing.md, gap: 8 }}>
              <Button onPress={handleToggleVip}>
                {isVip ? 'Chuyển về Học Giả Thường' : '👑 Kích Hoạt VIP Ngay (Demo)'}
              </Button>
              <Button variant="secondary" onPress={() => setModalVisible(false)}>
                Đóng
              </Button>
            </View>
          </Card>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    padding: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quotaBox: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.xs,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  perksList: {
    marginVertical: spacing.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
});
