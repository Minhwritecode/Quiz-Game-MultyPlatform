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
import QuestArena3D from '@/shared/visuals/QuestArena3D';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';

const FAQS = [
  {
    q: 'Làm thế nào để tạo quiz trắc nghiệm?',
    a: 'Papyrus hỗ trợ cả tạo trắc nghiệm thủ công (kèm đoạn code minh hoạ) lẫn tạo tự động bằng AI từ chủ đề bất kỳ hoặc tài liệu PDF chỉ trong vài giây.',
  },
  {
    q: 'Chế độ PvP theo lượt hoạt động thế nào?',
    a: 'Người chơi luân phiên chọn chủ đề và độ khó cho mỗi vòng đấu. Cả phòng cùng giải câu hỏi trong thời gian giới hạn và nhận điểm tốc độ 10 bậc.',
  },
  {
    q: 'Người tham gia có cần đăng ký tài khoản không?',
    a: 'Không bắt buộc. Người chơi chỉ cần nhập mã phòng 6 ký tự hoặc quét mã QR cùng một biệt danh là có thể tham gia thi đấu ngay.',
  },
  {
    q: 'Trận đấu multiplayer hỗ trợ tối đa bao nhiêu người?',
    a: 'Chủ phòng có thể tuỳ chỉnh linh hoạt từ 2 đến 10 người chơi cùng thời gian mỗi câu trước khi bắt đầu trận đấu.',
  },
  {
    q: 'Ứng dụng hỗ trợ những thiết bị nào?',
    a: 'Hỗ trợ đa nền tảng gồm Android, iOS và Web với hiệu ứng 3D WebGL tối ưu cho cả màn hình điện thoại và máy tính.',
  },
];

const QUEST_CALLOUTS = [
  { label: 'THỜI GIAN THỰC', value: 'Live Lobby' },
  { label: 'TRÍ TUỆ NHÂN TẠO', value: 'Đề biến hoá' },
  { label: 'CHẾ ĐỘ MỚI', value: 'PvP theo lượt' },
];

const QUEST_PILLARS = [
  {
    icon: 'sparkles-outline' as const,
    tag: '01 · AI FORGE',
    title: 'Nhiệm vụ kiến tạo tức thì',
    desc: 'Biến ghi chú, chủ đề lập trình hoặc giáo trình PDF thành câu hỏi 4 đáp án kèm đoạn code minh hoạ chỉ trong vài giây.',
  },
  {
    icon: 'flash-outline' as const,
    tag: '02 · PVP DUELS',
    title: 'Đấu trí nhanh, rõ, kịch tính',
    desc: 'Hỗ trợ đầy đủ Đấu tốc độ, Sinh tồn 3 mạng và PvP chọn đề theo lượt với hệ thống tính điểm tốc độ 10 bậc công bằng.',
  },
  {
    icon: 'trophy-outline' as const,
    tag: '03 · GUILD RANK',
    title: 'Bảng vàng học giả sống động',
    desc: 'Tự động cộng dồn điểm XP, chuỗi thắng và kỷ lục cá nhân lên bảng xếp hạng theo tuần, tháng và chuyên môn.',
  },
];

const GUILD_FEED = [
  { title: 'Đấu trường TypeScript · Vòng 4', players: '6/8 học giả', tag: 'Đang mở' },
  { title: 'Sinh tồn Sinh học tế bào', players: '4/6 học giả', tag: 'Trực tiếp' },
  { title: 'PvP Theo lượt · Giải thuật & Python', players: '2/4 học giả', tag: 'PvP Turn' },
];

const USE_CASES = [
  { icon: 'school-outline' as const, title: 'Lớp học & Ôn thi', desc: 'Tạo đề từ PDF bài giảng, bật thời gian đọc đề 3–10s và xuất báo cáo CSV cuối giờ.' },
  { icon: 'people-outline' as const, title: 'Team Building & Sự kiện', desc: 'Quét mã QR vào phòng không cần đăng ký, tung biểu cảm trực tiếp siêu sôi động.' },
  { icon: 'briefcase-outline' as const, title: 'Đào tạo Doanh nghiệp', desc: 'Nhập bộ câu hỏi hàng loạt từ CSV, đo tốc độ phản xạ & tỷ lệ hoàn thành từng phiên.' },
  { icon: 'code-slash-outline' as const, title: 'Đấu trường Lập trình ELO', desc: 'Câu hỏi kèm Code Snippet, PvP chọn chủ đề theo lượt và leo hạng ELO chuẩn quốc tế.' },
];

const PLAN_ROWS: Array<{ feature: string; free: string; vip: string }> = [
  { feature: 'Số người chơi / phòng', free: 'Tối đa 10', vip: 'Mở rộng ưu tiên' },
  { feature: 'Số bộ câu hỏi & Nhập CSV', free: 'Không giới hạn cục bộ', vip: 'Không giới hạn + Cloud' },
  { feature: 'Lượt Scan OCR & AI mỗi ngày', free: '3 lượt / ngày', vip: 'Không giới hạn' },
  { feature: 'Phòng đấu tạo mỗi ngày', free: '3 phòng / ngày', vip: 'Không giới hạn' },
  { feature: 'Hệ số thưởng EXP & Hào quang 3D', free: '1x EXP', vip: '2x EXP + Hào quang Vàng' },
  { feature: 'Báo cáo phiên đấu & Đấu ELO', free: 'Có sẵn ✓', vip: 'Đầy đủ ✓' },
];

export default function LandingShowcaseScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [quickRoomCode, setQuickRoomCode] = useState('');
  const [interactive3D, setInteractive3D] = useState(false);
  const tier = useMembershipStore((s) => s.tier);
  const toggleTier = useMembershipStore((s) => s.toggleTier);

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
      <TopBar title="Đấu trường Papyrus" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── 1. MODERN QUEST ARENA HERO + 3D ASTROLABE STAGE ── */}
        <Card color={palette.indigo} style={[styles.heroCard, isWide && styles.heroCardWide]}>
          <View style={styles.heroCopy}>
            <View style={styles.badgeRow}>
              <Badge tone="reward">✦ Modern Quest Arena</Badge>
              <Badge tone="success">AI + 3D Interactive</Badge>
            </View>

            <Text
              style={[
                typography.heading,
                {
                  color: palette.white,
                  marginTop: spacing.md,
                  fontSize: isWide ? 30 : 24,
                  lineHeight: isWide ? 38 : 31,
                },
              ]}
            >
              Đấu trường Trắc nghiệm Trí tuệ & Lập trình Thời gian thực
            </Text>

            <Text style={[typography.body, { color: '#E0E7FF', marginTop: spacing.sm, lineHeight: 22 }]}>
              Tạo đề thi trong chớp mắt bằng AI, mở phòng 2–10 người qua mã PIN/QR, tranh tài PvP theo lượt và chinh phục bảng vàng học giả.
            </Text>

            {/* 3 Callout Chips */}
            <View style={styles.calloutGrid}>
              {QUEST_CALLOUTS.map((item) => (
                <View key={item.label} style={styles.calloutPill}>
                  <Text style={styles.calloutLabel} numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text style={styles.calloutValue} numberOfLines={1}>
                    {item.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.heroActions}>
              <Button variant="reward" icon="sparkles" onPress={() => router.push('/ai-quiz')}>
                Tạo Quiz AI
              </Button>
              <Button variant="secondary" icon="game-controller-outline" onPress={() => router.push('/battle')}>
                Vào Đấu trường
              </Button>
            </View>
          </View>

          {/* 3D Animated Quest Astrolabe Stage (Three.js WebGL on Web / Blender GLB + Animated Crest on Native) */}
          <View style={[styles.stageBox, isWide ? styles.stageBoxWide : styles.stageBoxMobile]}>
            <QuestArena3D height={isWide ? 240 : 185} interactive3D={interactive3D} />
            <Pressable
              onPress={() => setInteractive3D((v) => !v)}
              style={styles.toggle3dBtn}
              accessibilityRole="button"
              accessibilityLabel="Chuyển chế độ 3D"
            >
              <Ionicons name="cube-outline" size={14} color="#E0E7FF" />
              <Text style={styles.toggle3dText}>
                {interactive3D ? '3D GLB Bật' : 'Tương tác 3D'}
              </Text>
            </Pressable>
          </View>
        </Card>

        {/* ── 2. QUICK JOIN BAR ── */}
        <Card style={styles.quickJoinCard}>
          <View style={styles.joinTextWrap}>
            <Text style={[typography.title, { color: palette.ink, fontSize: 16 }]}>
              🎮 Tham gia nhanh bằng mã phòng
            </Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>
              Nhập mã 6 ký tự từ chủ phòng để vào thẳng sàn đấu
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

        {/* ── 3. GUILD CHRONICLE + INTERACTIVE BATTLE PREVIEW (CLEAN 2-COL ON WIDE) ── */}
        <View style={[styles.showcaseSplit, isWide && styles.showcaseSplitWide]}>
          {/* Interactive Battle Preview */}
          <Card style={[styles.previewCard, isWide && { flex: 1.15 }]}>
            <View style={styles.previewHeader}>
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                TypeScript · PvP Vòng 01
              </Text>
              <Badge tone="success">● Mô phỏng trực tiếp</Badge>
            </View>

            <Text style={[typography.title, { color: palette.ink, fontSize: 16, marginVertical: spacing.xs }]}>
              Utility type nào chuyển mọi trường của interface thành tùy chọn?
            </Text>

            <View style={styles.miniCode}>
              <Text style={styles.miniCodeText}>{'type Draft = ???<UserProfile>;'}</Text>
            </View>

            <View style={styles.previewOptions}>
              <View style={[styles.previewOpt, { borderColor: '#EF4444' }]}>
                <Text style={{ color: '#EF4444', fontWeight: '900' }}>▲ A</Text>
                <Text style={[typography.caption, { color: palette.ink }]}>Required&lt;T&gt;</Text>
              </View>
              <View style={[styles.previewOpt, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Text style={{ color: '#10B981', fontWeight: '900' }}>◆ B</Text>
                <Text style={[typography.caption, { color: '#10B981', fontWeight: '700' }]}>Partial&lt;T&gt; ✓ (+1,500 đ)</Text>
              </View>
              <View style={[styles.previewOpt, { borderColor: '#F59E0B' }]}>
                <Text style={{ color: '#F59E0B', fontWeight: '900' }}>● C</Text>
                <Text style={[typography.caption, { color: palette.ink }]}>Readonly&lt;T&gt;</Text>
              </View>
              <View style={[styles.previewOpt, { borderColor: '#3B82F6' }]}>
                <Text style={{ color: '#3B82F6', fontWeight: '900' }}>■ D</Text>
                <Text style={[typography.caption, { color: palette.ink }]}>Record&lt;K, T&gt;</Text>
              </View>
            </View>

            <View style={[styles.previewFooter, { borderTopColor: palette.paperMuted }]}>
              <Ionicons name="flash" size={16} color="#F59E0B" />
              <Text style={[typography.caption, { color: palette.inkMuted, flex: 1 }]}>
                Điểm tốc độ 10 bậc — trả lời chuẩn càng nhanh, hệ số thưởng càng cao.
              </Text>
            </View>
          </Card>

          {/* Guild Chronicle Board */}
          <Card style={[styles.guildCard, isWide && { flex: 0.85 }]}>
            <View style={styles.guildHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[typography.label, { color: palette.indigo }]}>BẢNG TIN ĐẤU TRƯỜNG</Text>
                <Text style={[typography.title, { color: palette.ink, fontSize: 18, marginTop: 2 }]}>
                  Biên niên sử Học giả
                </Text>
              </View>
              <View style={styles.liveDotPill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveDotText}>ONLINE</Text>
              </View>
            </View>

            <View style={styles.guildList}>
              {GUILD_FEED.map((item, idx) => (
                <View
                  key={idx}
                  style={[styles.guildRow, { backgroundColor: palette.paper, borderColor: palette.paperMuted }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      👥 {item.players}
                    </Text>
                  </View>
                  <Badge tone={idx === 2 ? 'primary' : 'success'}>{item.tag}</Badge>
                </View>
              ))}
            </View>

            <View style={{ marginTop: spacing.md }}>
              <Button variant="secondary" icon="trophy-outline" onPress={() => router.push('/leaderboard')} fullWidth>
                Xem Bảng xếp hạng
              </Button>
            </View>
          </Card>
        </View>

        {/* ── 4. THREE QUEST PILLARS ── */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: spacing.sm, marginBottom: spacing.sm }]}>
          3 trụ cột của Đấu trường Papyrus
        </Text>
        <View style={[styles.pillarsGrid, isWide && styles.pillarsGridWide]}>
          {QUEST_PILLARS.map((pillar) => (
            <Card key={pillar.tag} style={styles.pillarCard}>
              <View style={styles.pillarTop}>
                <View style={[styles.featIconWrap, { backgroundColor: palette.indigoTint }]}>
                  <Ionicons name={pillar.icon} size={22} color={palette.indigo} />
                </View>
                <Text style={[typography.label, { color: palette.indigo, fontSize: 11 }]}>{pillar.tag}</Text>
              </View>
              <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm, fontSize: 16 }]}>
                {pillar.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 19 }]}>
                {pillar.desc}
              </Text>
            </Card>
          ))}
        </View>

        {/* ── 5. 3-STEP JOURNEY ── */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          3 bước từ ghi chú đến phòng đấu
        </Text>
        <View style={[styles.stepsWrap, isWide && styles.stepsWrapWide]}>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>01</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]}>Nạp tài liệu học</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Nhập chủ đề, soạn câu hỏi kèm code hoặc tải PDF cho AI.</Text>
            </View>
          </Card>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>02</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]}>Mở phòng 2–10 người</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Chọn chế độ Speed, Sinh tồn hoặc PvP theo lượt và gửi mã PIN.</Text>
            </View>
          </Card>
          <Card style={styles.stepCard}>
            <Text style={[styles.stepNum, { color: palette.indigo }]}>03</Text>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title, { color: palette.ink, fontSize: 15 }]}>Chơi để nhớ sâu</Text>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Đua tốc độ 10 bậc, xem giải thích đáp án và leo bảng vàng.</Text>
            </View>
          </Card>
        </View>

        {/* ── 5B. REAL-WORLD USE CASES ── */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Phù hợp cho mọi bối cảnh học tập & sự kiện
        </Text>
        <View style={[styles.pillarsGrid, isWide && styles.pillarsGridWide]}>
          {USE_CASES.map((uc) => (
            <Card key={uc.title} style={styles.useCaseCard}>
              <View style={[styles.featIconWrap, { backgroundColor: palette.indigoTint }]}>
                <Ionicons name={uc.icon} size={20} color={palette.indigo} />
              </View>
              <Text style={[typography.title, { color: palette.ink, fontSize: 15, marginTop: spacing.xs }]}>
                {uc.title}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4, lineHeight: 18 }]}>
                {uc.desc}
              </Text>
            </Card>
          ))}
        </View>

        {/* ── 5C. FREE VS VIP PRO PLAN COMPARISON ── */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          So sánh gói Học Giả (Free) & Đại Pháp Sư (VIP)
        </Text>
        <Card style={styles.planCard}>
          <View style={[styles.planHeaderRow, { borderBottomColor: palette.paperMuted }]}>
            <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '800', flex: 1.4 }]}>
              TÍNH NĂNG
            </Text>
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '800', flex: 0.8, textAlign: 'center' }]}>
              Free
            </Text>
            <Text style={[typography.caption, { color: palette.gold, fontWeight: '800', flex: 0.9, textAlign: 'center' }]}>
              👑 VIP
            </Text>
          </View>
          {PLAN_ROWS.map((row) => (
            <View key={row.feature} style={[styles.planRow, { borderBottomColor: palette.paperMuted }]}>
              <Text style={[typography.caption, { color: palette.ink, flex: 1.4, fontWeight: '600' }]}>
                {row.feature}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, flex: 0.8, textAlign: 'center' }]}>
                {row.free}
              </Text>
              <Text style={[typography.caption, { color: palette.indigo, flex: 0.9, textAlign: 'center', fontWeight: '700' }]}>
                {row.vip}
              </Text>
            </View>
          ))}
          <View style={styles.planCtaRow}>
            <Badge tone={tier === 'archmage' ? 'reward' : 'neutral'}>
              {tier === 'archmage' ? '👑 Bạn đang dùng VIP Archmage' : '📜 Gói hiện tại: Học Giả Free'}
            </Badge>
            <Button variant={tier === 'archmage' ? 'secondary' : 'reward'} icon="sparkles" onPress={toggleTier}>
              {tier === 'archmage' ? 'Chuyển về Free (Demo)' : 'Trải nghiệm VIP ngay'}
            </Button>
          </View>
        </Card>

        {/* ── 6. FAQ ACCORDION ── */}
        <Text style={[typography.title, { color: palette.ink, fontSize: 19, marginTop: spacing.lg, marginBottom: spacing.sm }]}>
          Câu hỏi thường gặp (FAQ)
        </Text>

        <View style={styles.faqList}>
          {FAQS.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <Card key={index} style={styles.faqCard}>
                <Pressable onPress={() => setOpenFaqIndex(isOpen ? null : index)} style={styles.faqHeader}>
                  <Text style={[typography.title, { color: palette.ink, flex: 1, fontSize: 15 }]}>
                    {faq.q}
                  </Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={palette.indigo} />
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
            © {new Date().getFullYear()} Papyrus Quest Arena • Phiên bản 0.2.0
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 4 }]}>
            Nền tảng trắc nghiệm AI, PvP thời gian thực & 3D đa nền tảng
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
    overflow: 'hidden',
    gap: spacing.lg,
  },
  heroCardWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroCopy: { flex: 1.2, minWidth: 0 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  calloutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  calloutPill: {
    flexGrow: 1,
    minWidth: 96,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
  },
  calloutLabel: { fontSize: 9, fontWeight: '800', color: '#C7D2FE', letterSpacing: 0.6 },
  calloutValue: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  heroActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, flexWrap: 'wrap' },
  stageBox: {
    borderRadius: radii.md,
    backgroundColor: 'rgba(15, 23, 42, 0.26)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  stageBoxWide: { flex: 0.8, minWidth: 260, height: 250 },
  stageBoxMobile: { width: '100%', height: 195 },
  toggle3dBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  toggle3dText: { color: '#E0E7FF', fontSize: 11, fontWeight: '700' },
  quickJoinCard: { padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.md },
  joinTextWrap: { marginBottom: spacing.xs },
  joinInputRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center', marginTop: spacing.xs },
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
  showcaseSplit: { gap: spacing.md, marginBottom: spacing.md },
  showcaseSplitWide: { flexDirection: 'row', alignItems: 'stretch' },
  previewCard: { padding: spacing.md, borderRadius: radii.lg },
  previewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  miniCode: { backgroundColor: '#0F172A', borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 8, marginBottom: spacing.xs },
  miniCodeText: { fontFamily: 'monospace', fontSize: 12, color: '#38BDF8' },
  previewOptions: { gap: spacing.xs, marginVertical: spacing.xs },
  previewOpt: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1.5 },
  previewFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, marginTop: spacing.xs },
  guildCard: { padding: spacing.md, borderRadius: radii.lg, justifyContent: 'space-between' },
  guildHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.md },
  liveDotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  liveDotText: { color: '#059669', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  guildList: { gap: spacing.xs },
  guildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  pillarsGrid: { gap: spacing.sm },
  pillarsGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  pillarCard: { padding: spacing.md, borderRadius: radii.md, flex: 1, minWidth: 240 },
  useCaseCard: { padding: spacing.md, borderRadius: radii.md, flexBasis: '47%', flexGrow: 1, minWidth: 220 },
  planCard: { padding: spacing.md, borderRadius: radii.lg, marginBottom: spacing.sm },
  planHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: spacing.sm, borderBottomWidth: 1, gap: spacing.xs },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, gap: spacing.xs },
  planCtaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  pillarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  featIconWrap: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepsWrap: { gap: spacing.xs, marginBottom: spacing.sm },
  stepsWrapWide: { flexDirection: 'row' },
  stepCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.md, flex: 1, minWidth: 220 },
  stepNum: { fontSize: 22, fontWeight: '900', minWidth: 32 },
  faqList: { gap: spacing.xs },
  faqCard: { padding: spacing.md, borderRadius: radii.md },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  faqBody: { paddingTop: spacing.sm, marginTop: spacing.sm, borderTopWidth: 1 },
  footer: { paddingTop: spacing.xl, marginTop: spacing.xl, borderTopWidth: 1 },
});
