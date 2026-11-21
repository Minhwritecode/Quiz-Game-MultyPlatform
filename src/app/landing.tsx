import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

const FAQS = [
  {
    q: 'Làm thế nào để tạo quiz trắc nghiệm?',
    a: 'Papyrus hỗ trợ cả tạo trắc nghiệm thủ công lẫn tạo tự động bằng AI. Bạn chỉ cần nhập chủ đề bất kỳ hoặc tải lên tài liệu PDF ôn tập để tạo câu hỏi trong vài giây.',
  },
  {
    q: 'AI có thể tự sinh câu hỏi từ tài liệu PDF không?',
    a: 'Có. Tính năng AI Quiz có thể đọc và trích xuất kiến thức từ giáo trình, slide bài giảng hoặc đề cương PDF để thiết kế bộ câu hỏi trắc nghiệm chất lượng cao kèm 4 lựa chọn.',
  },
  {
    q: 'Người tham gia có cần đăng ký tài khoản không?',
    a: 'Không bắt buộc. Người chơi chỉ cần nhập mã phòng 6 ký tự hoặc quét mã QR cùng một biệt danh là có thể tham gia thi đấu ngay.',
  },
  {
    q: 'Trận đấu multiplayer diễn ra theo thời gian thực thế nào?',
    a: 'Khi chủ phòng bắt đầu trận, tất cả người chơi nhận câu hỏi đồng thời. Bảng xếp hạng cập nhật điểm số trực tiếp sau mỗi câu hỏi.',
  },
  {
    q: 'Tôi có thể tự tạo câu hỏi thủ công không?',
    a: 'Hoàn toàn được! Công cụ soạn thảo câu hỏi cho phép bạn tự do thêm câu hỏi, tùy chỉnh 4 đáp án và chọn đáp án chính xác.',
  },
  {
    q: 'Ứng dụng hỗ trợ những thiết bị nào?',
    a: 'Hỗ trợ đa nền tảng gồm Android, iOS và Web với giao diện tối ưu hóa độ phân giải cao.',
  },
];

const HIGHLIGHT_FEATURES = [
  {
    icon: 'flash-outline' as const,
    title: 'Real-time Multiplayer',
    desc: 'Đồng bộ câu hỏi và tính điểm tức thì cho toàn bộ người chơi trong phòng.',
  },
  {
    icon: 'trophy-outline' as const,
    title: 'Bảng điểm Trực tiếp',
    desc: 'Theo dõi sự thay đổi thứ hạng sau từng câu hỏi với hiệu ứng kịch tính.',
  },
  {
    icon: 'sparkles-outline' as const,
    title: 'Sinh Quiz bằng AI',
    desc: 'Tự động tạo câu hỏi trắc nghiệm từ bất kỳ chủ đề hoặc file PDF bài giảng.',
  },
  {
    icon: 'qr-code-outline' as const,
    title: 'Quét QR Vào Phòng',
    desc: 'Người chơi tham gia chỉ với 1 thao tác quét mã hoặc nhập mã 6 ký tự.',
  },
];

export default function LandingShowcaseScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [quickRoomCode, setQuickRoomCode] = useState('');

  const handleQuickJoin = () => {
    const code = quickRoomCode.trim().toUpperCase();
    if (!code) return;
    router.push({
      pathname: '/multiplayer/join',
      params: { room: code },
    });
  };

  return (
    <Screen scroll={false}>
      <TopBar title="Giới thiệu & Mở rộng" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* HERO SECTION */}
        <Card color={palette.indigo} style={styles.heroCard}>
          <View style={styles.badgeRow}>
            <Badge tone="reward">⚡ AI Powered</Badge>
            <Badge tone="success">Multiplayer Live</Badge>
            <Badge tone="primary">Real-Time</Badge>
          </View>

          <Text style={[typography.heading, { color: palette.white, marginTop: spacing.md, fontSize: 26, lineHeight: 34 }]}>
            Nền tảng Trắc nghiệm Trực tuyến Thông minh với AI
          </Text>

          <Text style={[typography.body, { color: '#E0E7FF', marginTop: spacing.sm, lineHeight: 22 }]}>
            Tạo bài thi chớp nhoáng với AI, chia sẻ mã phòng QR, thi đấu xếp hạng thời gian thực và trải nghiệm học tập không giới hạn.
          </Text>

          <View style={styles.heroActions}>
            <Button
              variant="reward"
              icon="sparkles"
              onPress={() => router.push('/ai-quiz')}
            >
              Tạo Quiz AI
            </Button>
            <Button
              variant="secondary"
              icon="people-outline"
              onPress={() => router.push('/multiplayer/join')}
            >
              Vào phòng Live
            </Button>
          </View>
        </Card>

        {/* QUICK JOIN BAR */}
        <Card style={styles.quickJoinCard}>
          <View style={styles.joinTextWrap}>
            <Text style={[typography.title, { color: palette.ink, fontSize: 17 }]}>
              🎮 Bạn có mã phòng thi đấu?
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              Nhập mã 6 ký tự để tham gia ngay cùng bạn bè
            </Text>
          </View>

          <View style={styles.joinInputRow}>
            <TextInput
              value={quickRoomCode}
              onChangeText={(text) => setQuickRoomCode(text.toUpperCase())}
              placeholder="MÃ PHÒNG"
              placeholderTextColor={palette.inkMuted}
              autoCapitalize="characters"
              maxLength={8}
              style={[
                styles.quickInput,
                { color: palette.indigo, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
              ]}
            />
            <Button variant="reward" onPress={handleQuickJoin}>
              Tham gia
            </Button>
          </View>
        </Card>

        {/* STUDYWARS INTERACTIVE BATTLE PREVIEW */}
        <Card style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
              Sinh học · Vòng 01
            </Text>
            <Badge tone="success">● Trận đấu mô phỏng</Badge>
          </View>

          <Text style={[typography.title, { color: palette.ink, fontSize: 18, marginVertical: spacing.xs }]}>
            {'Bào quan nào được ví như "nhà máy năng lượng" của tế bào?'}
          </Text>

          <View style={styles.previewOptions}>
            <View style={[styles.previewOpt, { borderColor: '#EF4444' }]}>
              <Text style={{ color: '#EF4444', fontWeight: '900' }}>▲ A</Text>
              <Text style={[typography.caption, { color: palette.ink }]}>Nhân tế bào</Text>
            </View>
            <View style={[styles.previewOpt, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
              <Text style={{ color: '#10B981', fontWeight: '900' }}>◆ B</Text>
              <Text style={[typography.caption, { color: '#10B981', fontWeight: '700' }]}>Ty thể (Mitochondria) ✓</Text>
            </View>
            <View style={[styles.previewOpt, { borderColor: '#F59E0B' }]}>
              <Text style={{ color: '#F59E0B', fontWeight: '900' }}>● C</Text>
              <Text style={[typography.caption, { color: palette.ink }]}>Ribosome</Text>
            </View>
            <View style={[styles.previewOpt, { borderColor: '#3B82F6' }]}>
              <Text style={{ color: '#3B82F6', fontWeight: '900' }}>■ D</Text>
              <Text style={[typography.caption, { color: palette.ink }]}>Bộ máy Golgi</Text>
            </View>
          </View>

          <View style={[styles.previewFooter, { borderTopColor: palette.paperMuted }]}>
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text style={[typography.caption, { color: palette.inkMuted, flex: 1 }]}>
              Trả lời càng nhanh, điểm ghi được càng cao (tối đa 1,000 đ/câu).
            </Text>
          </View>
        </Card>

        {/* 3-STEP STUDYWARS JOURNEY */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 20, marginVertical: spacing.md }]}>
          Quy trình 3 bước từ ghi chú đến phòng đấu
        </Text>
        <View style={[styles.stepsWrap, isWide && styles.stepsWrapWide]}>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>01</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>Nạp tài liệu học</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Gõ chủ đề, dán ghi chú hoặc tải file PDF để AI phân tích ý chính.</Text>
            </View>
          </Card>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>02</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>Mở phòng thi đấu</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Xem lại câu hỏi, lấy mã phòng 6 ký tự và rủ bạn bè cùng tham gia.</Text>
            </View>
          </Card>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>03</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>Chơi để nhớ sâu</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Đua tốc độ, xem giải thích chi tiết đáp án và leo bục vinh danh.</Text>
            </View>
          </Card>
        </View>

        {/* FEATURE CARDS */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 20, marginVertical: spacing.md }]}>
          Tại sao chọn nền tảng này?
        </Text>

        <View style={[styles.featuresGrid, isWide && styles.featuresGridWide]}>
          {HIGHLIGHT_FEATURES.map((feat, i) => (
            <Card key={i} style={styles.featureCard}>
              <View style={[styles.featIconWrap, { backgroundColor: palette.paperRaised }]}>
                <Ionicons name={feat.icon} size={28} color={palette.indigo} />
              </View>
              <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm, fontSize: 16 }]}>
                {feat.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 18 }]}>
                {feat.desc}
              </Text>
            </Card>
          ))}
        </View>

        {/* FAQ ACCORDION */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          Câu hỏi thường gặp (FAQ)
        </Text>

        <View style={styles.faqList}>
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <Card key={index} style={styles.faqCard}>
                <Pressable
                  onPress={() => setOpenFaqIndex(isOpen ? null : index)}
                  style={styles.faqHeader}
                >
                  <Text style={[typography.title, { color: palette.ink, flex: 1, fontSize: 15 }]}>
                    {faq.q}
                  </Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={palette.indigo}
                  />
                </Pressable>

                {isOpen && (
                  <View style={[styles.faqBody, { borderTopColor: palette.paperMuted }]}>
                    <Text style={[typography.caption, { color: palette.inkMuted, lineHeight: 20, fontSize: 14 }]}>
                      {faq.a}
                    </Text>
                  </View>
                )}
              </Card>
            );
          })}
        </View>

        {/* FOOTER */}
        <View style={[styles.footer, { borderTopColor: palette.paperMuted }]}>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center' }]}>
            © {new Date().getFullYear()} Papyrus Quiz Platform • Phiên bản 0.2.0
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
            Tích hợp toàn diện các tính năng AI & Multiplayer thời gian thực
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 960, alignSelf: 'center', paddingBottom: 60 },
  heroCard: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: 'wrap',
  },
  quickJoinCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  joinTextWrap: {
    marginBottom: spacing.xs,
  },
  joinInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  quickInput: {
    flex: 1,
    minWidth: 160,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  featuresGrid: {
    gap: spacing.sm,
  },
  featuresGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  featureCard: {
    padding: spacing.md,
    borderRadius: radii.md,
    flex: 1,
    minWidth: 260,
  },
  previewCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewOptions: {
    gap: spacing.xs,
    marginVertical: spacing.sm,
  },
  previewOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  previewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    marginTop: spacing.xs,
  },
  stepsWrap: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  stepsWrapWide: {
    flexDirection: 'row',
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    flex: 1,
    minWidth: 220,
  },
  stepNum: {
    fontSize: 22,
    fontWeight: '900',
    minWidth: 32,
  },
  featIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqList: {
    gap: spacing.xs,
  },
  faqCard: {
    padding: spacing.md,
    borderRadius: radii.md,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  faqBody: {
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
    borderTopWidth: 1,
  },
  footer: {
    paddingTop: spacing.xl,
    marginTop: spacing.xl,
    borderTopWidth: 1,
  },
});
