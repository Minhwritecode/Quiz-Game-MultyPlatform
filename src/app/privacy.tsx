import { errorMessage } from '@/core/domain/failure';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { dependencies } from '@/composition/dependencies';
import { useAuthStore } from '@/core/state/useAuthStore';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

type LegalTab = 'privacy' | 'terms' | 'refund';

export default function PrivacyScreen() {
  const palette = usePalette();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<LegalTab>('privacy');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [finished, setFinished] = useState(false);

  const open = async (url: string | undefined) => {
    if (!url) {
      setMessage('Trang hỗ trợ chưa được cấu hình cho bản thử nghiệm này.');
      return;
    }
    try {
      if (new URL(url).protocol !== 'https:') throw new Error();
      await Linking.openURL(url);
    } catch {
      setMessage('Không mở được trang. Vui lòng thử lại sau.');
    }
  };

  const remove = async () => {
    if (busy || confirmation !== 'DELETE') return;
    setBusy(true);
    setMessage('');
    try {
      const result = await dependencies.deleteCurrentAccount();
      useAuthStore.getState().clear();
      usePapyrusStore.setState({ questionSets: [], sourceDocument: null, hydrated: true });
      setFinished(true);
      setMessage(
        result.cleanupRequired
          ? 'Tài khoản trên máy chủ đã được xóa. Chưa dọn hết dữ liệu trên thiết bị; hãy xóa dữ liệu ứng dụng trong cài đặt hệ điều hành trước khi dùng lại.'
          : 'Đã xóa tài khoản, dữ liệu cloud và dữ liệu học trên thiết bị này.'
      );
    } catch (error) {
      setMessage(errorMessage(error, 'Không thể xóa tài khoản.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar title="Pháp lý & Quyền riêng tư" />

      {/* 3-Tab Legal Hub: Privacy | Terms of Service | Refund Policy */}
      <View style={[styles.tabBar, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
        {(
          [
            { key: 'privacy', label: 'Quyền riêng tư' },
            { key: 'terms', label: 'Điều khoản' },
            { key: 'refund', label: 'Hoàn tiền' },
          ] as Array<{ key: LegalTab; label: string }>
        ).map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabBtn, active && { backgroundColor: palette.indigo }]}
            >
              <Text
                style={[
                  typography.caption,
                  { color: active ? '#FFFFFF' : palette.inkMuted, fontWeight: '800' },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'privacy' && (
        <Card style={styles.docCard}>
          <Badge tone="primary">CHÍNH SÁCH QUYỀN RIÊNG TƯ</Badge>
          <Text style={[typography.body, { color: palette.ink, marginTop: spacing.sm, lineHeight: 22 }]}>
            Ảnh tài liệu được OCR trực tiếp trên thiết bị. Khi bạn chọn tạo câu hỏi AI, chỉ văn bản đã duyệt mới được gửi tới dịch vụ AI. Bộ câu hỏi chỉ đồng bộ lên cloud khi bạn chủ động kích hoạt. Báo cáo lỗi đã lọc sạch thông tin nhạy cảm, mật khẩu và phiên đăng nhập.
          </Text>
          <View style={styles.btnStack}>
            <Button variant="secondary" onPress={() => void open(process.env.EXPO_PUBLIC_PRIVACY_URL)}>
              Chính sách quyền riêng tư (Web)
            </Button>
            <Button variant="secondary" onPress={() => void open(process.env.EXPO_PUBLIC_SUPPORT_URL)}>
              Hỗ trợ / Gửi phản hồi
            </Button>
          </View>
        </Card>
      )}

      {tab === 'terms' && (
        <Card style={styles.docCard}>
          <Badge tone="primary">ĐIỀU KHOẢN SỬ DỤNG (TERMS OF SERVICE)</Badge>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>
            1. Quyền sử dụng & Nội dung người dùng
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 20 }]}>
            Bạn giữ toàn quyền sở hữu đối với mọi bộ câu hỏi, ghi chú và tài liệu đưa vào Papyrus. Nghiêm cấm đăng tải nội dung vi phạm bản quyền, ngôn từ thù ghét hoặc gian lận điểm xếp hạng ELO.
          </Text>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            2. Đấu trường công bằng & Kiểm duyệt
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 20 }]}>
            Hệ thống xếp hạng ELO chỉ tính điểm ở trận Ranked hợp lệ; trận mời bạn bè được tách riêng (Unrated) để chống cày điểm. Mọi câu hỏi vi phạm có thể bị gắn cờ và xử lý trong hàng đợi kiểm duyệt.
          </Text>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            3. Giới hạn trách nhiệm AI
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 20 }]}>
            Câu hỏi do AI sinh tự động mang tính hỗ trợ ôn tập; người dùng nên kiểm tra lại đáp án trước khi sử dụng trong kỳ thi chính thức.
          </Text>
        </Card>
      )}

      {tab === 'refund' && (
        <Card style={styles.docCard}>
          <Badge tone="reward">CHÍNH SÁCH HOÀN TIỀN & GIA HẠN (REFUND POLICY)</Badge>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>
            1. Gói Đại Pháp Sư (VIP Archmage)
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 20 }]}>
            Gói VIP mở khóa không giới hạn lượt Scan/AI, tạo phòng đấu không giới hạn, nhân đôi điểm EXP và báo cáo phiên đấu nâng cao. Bạn có thể hủy gia hạn bất kỳ lúc nào; quyền lợi vẫn giữ nguyên tới hết chu kỳ đã thanh toán.
          </Text>
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.md }]}>
            2. Hoàn tiền trong 7 ngày
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 20 }]}>
            Nếu phát sinh lỗi thanh toán trùng lặp hoặc sự cố kỹ thuật khiến bạn không sử dụng được quyền lợi VIP, hãy liên hệ bộ phận hỗ trợ trong vòng 7 ngày kể từ ngày giao dịch để được hoàn tiền 100% (với giao dịch qua App Store / Google Play, quy trình hoàn tiền tuân theo chính sách của kho ứng dụng tương ứng).
          </Text>
        </Card>
      )}

      {message ? (
        <Text accessibilityRole="alert" style={{ color: palette.ink, marginVertical: 16 }}>
          {message}
        </Text>
      ) : null}

      {user && !finished ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text style={[typography.title, { color: palette.danger, marginBottom: spacing.xs }]}>
            Xóa tài khoản & toàn bộ dữ liệu
          </Text>
          <Text style={{ color: palette.ink, lineHeight: 20 }}>
            Xóa vĩnh viễn tài khoản, bộ câu hỏi cloud, lịch sử cloud và phòng liên quan. Tất cả dữ liệu học cục bộ trên thiết bị này, kể cả chưa đồng bộ, cũng sẽ bị xóa. Không thể hoàn tác.
          </Text>
          <View style={{ marginVertical: 16 }}>
            <TextInput
              accessibilityLabel="Type DELETE to confirm"
              placeholder="Nhập DELETE để xác nhận"
              placeholderTextColor={palette.inkMuted}
              value={confirmation}
              onChangeText={setConfirmation}
              autoCapitalize="characters"
              editable={!busy}
              style={{
                minHeight: 48,
                borderWidth: 1,
                borderColor: palette.inkMuted,
                borderRadius: 12,
                padding: 12,
                color: palette.ink,
              }}
            />
          </View>
          <Button variant="danger" disabled={busy || confirmation !== 'DELETE'} onPress={() => void remove()}>
            {busy ? 'Đang xóa…' : 'Xóa tài khoản và dữ liệu'}
          </Button>
        </Card>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Button onPress={() => router.replace('/auth')}>Về đăng nhập</Button>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    gap: 4,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.pill,
  },
  docCard: {
    padding: spacing.lg,
    borderRadius: radii.md,
  },
  btnStack: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
