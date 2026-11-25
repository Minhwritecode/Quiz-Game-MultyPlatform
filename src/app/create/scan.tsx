import { useAuthStore } from '@/core/state/useAuthStore';
import { randomUUID } from 'expo-crypto';
import { AppError, errorMessage } from '@/core/domain/failure';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, IconTile, PageHeader, ProgressBar, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { createSourceDocument } from '@/features/scan-ocr/domain/sourceDocument';
import { sanitizeOcrAndDocumentText } from '@/features/scan-ocr/domain/ocrCleaner';
import {
  buildCombinedSourceText,
  createScanPage,
  MAX_SCAN_PAGES,
  MAX_SOURCE_CHARS,
  removeScanPage,
  reorderScanPages,
  togglePageNeedsReview,
  togglePageSelected,
  updatePageText,
  type ScanPage,
} from '@/features/scan-ocr/domain/scanSession';
import { dependencies } from '@/composition/dependencies';
import { useMembershipStore } from '@/features/membership/state/useMembershipStore';
import { useStreakStore } from '@/features/streak/state/useStreakStore';
import { sfx } from '@/core/audio/sfx';

const { pickSourceImages, captureSourceImage, recognizeLocalImage } = dependencies.intake;

const OCR_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: 'vie+eng', label: '🇻🇳🇬🇧 Việt + Anh' },
  { code: 'vie', label: '🇻🇳 Tiếng Việt' },
  { code: 'eng', label: '🇬🇧 English' },
  { code: 'jpn+eng', label: '🇯🇵 日本語' },
  { code: 'kor+eng', label: '🇰🇷 한국어' },
  { code: 'chi_sim+eng', label: '🇨🇳 中文' },
  { code: 'fra+deu+spa+eng', label: '🇪🇺 FR/DE/ES' },
  { code: 'rus+eng', label: '🇷🇺 Русский' },
  { code: 'ara+eng', label: '🇸🇦 العربية' },
];

export default function ScanScreen() {
  const router = useRouter();
  const palette = usePalette();
  const saveSourceDocument = usePapyrusStore((state) => state.saveSourceDocument);
  const [text, setText] = useState('');
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [ocrLanguage, setOcrLanguage] = useState('vie+eng');
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; ratio: number; stage: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const syncManualFromPages = (nextPages: ScanPage[]) => {
    setPages(nextPages);
    const { combinedText } = buildCombinedSourceText(nextPages);
    if (combinedText) setText(combinedText);
  };

  // Rotate scanned image 90 degrees clockwise (Canvas on Web + automatic re-OCR)
  const rotatePage90 = async (page: ScanPage) => {
    if (busy || !page.uri) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      Alert.alert('Xoay trang', 'Bạn có thể dùng nút Chụp lại bên cạnh để căn thẳng trang sách trên camera.');
      return;
    }
    setBusy(true);
    try {
      const rotatedUri = await new Promise<string>((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalHeight || img.height;
          canvas.height = img.naturalWidth || img.width;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context unavailable'));
            return;
          }
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          resolve(canvas.toDataURL('image/jpeg', 0.88));
        };
        img.onerror = () => reject(new Error('Failed to load image for rotation'));
        img.src = page.uri!;
      });

      setScanProgress({ current: 1, total: 1, ratio: 0.2, stage: 'Đang nhận diện lại sau khi xoay 90°...' });
      const reOcr = (
        await recognizeLocalImage(rotatedUri, {
          language: ocrLanguage,
          onProgress: (ratio, stage) => setScanProgress({ current: 1, total: 1, ratio, stage }),
        })
      ).trim();

      const updated = pages.map((p) =>
        p.id === page.id
          ? {
              ...p,
              uri: rotatedUri,
              text: reOcr || p.text,
              needsReview: reOcr.length < 24,
              status: reOcr ? ('done' as const) : p.status,
            }
          : p
      );
      syncManualFromPages(updated);
      sfx.playCorrect();
    } catch {
      Alert.alert('Không thể xoay ảnh', 'Vui lòng thử chụp lại trang này.');
    } finally {
      setScanProgress(null);
      setBusy(false);
    }
  };

  const chooseImage = async (camera = false, replacePageId?: string) => {
    if (busy) return;
    if (!useMembershipStore.getState().canScan()) {
      Alert.alert(
        'Đạt giới hạn quét hôm nay',
        'Học Giả Tập Sự được quét tối đa 3 tài liệu/ngày. Bạn có thể nâng cấp lên VIP để quét không giới hạn!'
      );
      return;
    }
    setBusy(true);
    try {
      const images = await (camera ? captureSourceImage() : pickSourceImages());
      if (images.length === 0) return;
      const remainingSlots = replacePageId ? 1 : Math.max(0, MAX_SCAN_PAGES - pages.length);
      if (!replacePageId && images.length > remainingSlots) {
        throw new AppError('validation', `Tối đa ${MAX_SCAN_PAGES} trang mỗi phiên quét (còn ${remainingSlots} chỗ trống).`);
      }

      const newlyScanned: ScanPage[] = [];
      for (let i = 0; i < images.length; i++) {
        setScanProgress({ current: i + 1, total: images.length, ratio: 0.08, stage: 'Đang chuẩn bị ảnh...' });
        const uri = images[i]!;
        const rawText = sanitizeOcrAndDocumentText(
          await recognizeLocalImage(uri, {
            language: ocrLanguage,
            onProgress: (ratio, stage) => {
              setScanProgress({ current: i + 1, total: images.length, ratio, stage });
            },
          })
        );
        newlyScanned.push(
          createScanPage({
            id: replacePageId ?? `page-${Date.now()}-${i}`,
            uri,
            title: replacePageId ? 'Trang chụp lại' : `Trang ${pages.length + i + 1}`,
            text: rawText || '(Chưa nhận diện được chữ — chạm để sửa hoặc chọn lại ngôn ngữ OCR phù hợp)',
            needsReview: rawText.length < 24,
            status: rawText ? 'done' : 'error',
          })
        );
      }

      const nextPages = replacePageId
        ? pages.map((p) => (p.id === replacePageId ? newlyScanned[0]! : p))
        : [...pages, ...newlyScanned];

      syncManualFromPages(nextPages);
      useMembershipStore.getState().consumeScan();
      useStreakStore.getState().recordActivity('scan_ocr');
      sfx.playCorrect();
    } catch (error) {
      Alert.alert('Không đọc được ảnh', errorMessage(error, 'Vui lòng chọn hoặc chụp lại ảnh.'));
    } finally {
      setScanProgress(null);
      setBusy(false);
    }
  };

  const chooseDocument = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const picked = await dependencies.intake.pickRichSourceDocument();
      if (picked) {
        let extracted = picked.extractedText.trim();
        if (!extracted) {
          Alert.alert(
            'Đã nạp file tài liệu',
            `File "${picked.name}" là file scan ảnh hoặc nén phức tạp. Hãy dán nội dung bổ sung hoặc dùng AI Quiz -> Kho tri thức để bóc tách phía server.`
          );
          return;
        }
        const combinedLen = text.trim().length + extracted.length;
        if (combinedLen > MAX_SOURCE_CHARS) {
          extracted = extracted.slice(0, Math.max(0, MAX_SOURCE_CHARS - text.trim().length));
        }
        const newPage = createScanPage({
          id: `doc-${Date.now()}`,
          title: `${picked.name} (${picked.kind.toUpperCase()})`,
          text: extracted.slice(0, MAX_SOURCE_CHARS),
          needsReview: false,
        });
        syncManualFromPages([...pages, newPage]);
        sfx.playCorrect();
        return;
      }
    } catch (error) {
      Alert.alert('Không nhập được tài liệu', errorMessage(error, 'Vui lòng chọn lại file PDF/DOCX/MD/TXT.'));
    } finally {
      setBusy(false);
    }
  };

  const continueToShape = async () => {
    const built = pages.length > 0 ? buildCombinedSourceText(pages) : null;
    const sourceText = (built && built.selectedCount > 0 ? built.combinedText : text).trim();
    if (!sourceText || sourceText.length > MAX_SOURCE_CHARS) {
      Alert.alert('Thiếu nội dung tài liệu', `Hãy quét, nhập file hoặc dán tài liệu từ 1–${MAX_SOURCE_CHARS.toLocaleString()} ký tự.`);
      return;
    }
    setBusy(true);
    try {
      const account = useAuthStore.getState().user?.id;
      const document = createSourceDocument(randomUUID(), sourceText);
      if (pages.length > 0 && pages[0]?.title) {
        document.title = pages[0].title;
      }
      await dependencies.sources.save(document);
      if (useAuthStore.getState().user?.id !== account) return;
      saveSourceDocument(document);
      router.push('/create/generate');
    } catch (error) {
      Alert.alert('Không lưu được tài liệu', errorMessage(error, 'Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const reviewCount = pages.filter((p) => p.selected && p.needsReview).length;

  return (
    <Screen>
      <TopBar title="Tạo bộ câu hỏi từ tài liệu" />
      <PageHeader
        eyebrow="BƯỚC 1 / 3 · NGUỒN TÀI LIỆU & OCR ĐA TRANG"
        title="Nhập tài liệu học tập"
        subtitle="Quét nhiều trang liên tiếp, sắp xếp/chụp lại, đánh dấu đoạn cần sửa sau OCR hoặc nhập thẳng PDF, DOCX, Markdown, TXT."
      />

      {/* Progress Steps */}
      <View style={styles.steps}>
        <View style={[styles.step, { backgroundColor: palette.indigo }]}>
          <Text style={{ color: palette.white, fontWeight: '800' }}>01</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} />
        <View style={[styles.step, { backgroundColor: palette.paperMuted }]}>
          <Text style={{ color: palette.inkMuted, fontWeight: '800' }}>02</Text>
        </View>
        <View style={[styles.stepLine, { backgroundColor: palette.paperMuted }]} />
        <View style={[styles.step, { backgroundColor: palette.paperMuted }]}>
          <Text style={{ color: palette.inkMuted, fontWeight: '800' }}>03</Text>
        </View>
      </View>

      {/* Multilingual OCR Language Selector */}
      <View style={styles.langSection}>
        <Text style={[typography.label, { color: palette.indigo, marginBottom: spacing.xs }]}>
          NGÔN NGỮ NHẬN DIỆN OCR ĐA QUỐC GIA
        </Text>
        <View style={styles.langWrap}>
          {OCR_LANGUAGES.map((item) => {
            const active = ocrLanguage === item.code;
            return (
              <Pressable
                key={item.code}
                disabled={busy}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                onPress={() => setOcrLanguage(item.code)}
                style={[
                  styles.langChip,
                  {
                    backgroundColor: active ? palette.indigo : palette.paperRaised,
                    borderColor: active ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : palette.ink }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Capture / Pick Cards */}
      <View style={styles.captureRow}>
        <Card onPress={() => void chooseImage(true)} style={styles.captureCard}>
          <IconTile icon="camera-outline" tint="primary" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>Quét Camera</Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
            Chụp tối đa {MAX_SCAN_PAGES} trang
          </Text>
        </Card>
        <Card onPress={() => void chooseImage(false)} style={styles.captureCard}>
          <IconTile icon="images-outline" tint="success" />
          <Text style={[typography.title, { color: palette.ink, marginTop: spacing.sm }]}>Chọn Ảnh OCR</Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
            {busy ? 'Đang nhận diện…' : `${pages.length}/${MAX_SCAN_PAGES} trang trong phiên`}
          </Text>
        </Card>
      </View>

      {scanProgress && (
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', flex: 1 }]} numberOfLines={1}>
              🔍 Trang {scanProgress.current}/{scanProgress.total} · {scanProgress.stage}
            </Text>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', fontVariant: ['tabular-nums'] }]}>
              {Math.round(scanProgress.ratio * 100)}%
            </Text>
          </View>
          <ProgressBar progress={scanProgress.ratio} tone="primary" />
        </Card>
      )}

      {/* Multi-Page Scan Session Manager */}
      {pages.length > 0 && (
        <View style={{ marginTop: spacing.lg }}>
          <View style={styles.sessionHeader}>
            <Text style={[typography.title, { color: palette.ink }]}>
              📑 Phiên quét ({pages.filter((p) => p.selected).length}/{pages.length} trang chọn)
            </Text>
            {reviewCount > 0 && <Badge tone="reward">⚠️ {reviewCount} trang cần soát lỗi</Badge>}
          </View>

          {pages.map((pg, idx) => (
            <Card
              key={pg.id}
              style={[
                styles.pageCard,
                {
                  borderColor: pg.needsReview ? '#F59E0B' : pg.selected ? palette.indigo : palette.paperMuted,
                  borderWidth: 1.5,
                  opacity: pg.selected ? 1 : 0.6,
                },
              ]}
            >
              <View style={styles.pageTopRow}>
                <Pressable
                  onPress={() => syncManualFromPages(togglePageSelected(pages, pg.id))}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
                >
                  <Ionicons
                    name={pg.selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={pg.selected ? palette.indigo : palette.inkMuted}
                  />
                  <Text style={[typography.body, { color: palette.ink, fontWeight: '800', flex: 1 }]} numberOfLines={1}>
                    {idx + 1}. {pg.title}
                  </Text>
                </Pressable>

                <View style={styles.pageTools}>
                  <Pressable
                    disabled={idx === 0}
                    onPress={() => syncManualFromPages(reorderScanPages(pages, idx, idx - 1))}
                    style={[styles.miniBtn, { opacity: idx === 0 ? 0.35 : 1 }]}
                  >
                    <Ionicons name="arrow-up" size={15} color={palette.ink} />
                  </Pressable>
                  <Pressable
                    disabled={idx === pages.length - 1}
                    onPress={() => syncManualFromPages(reorderScanPages(pages, idx, idx + 1))}
                    style={[styles.miniBtn, { opacity: idx === pages.length - 1 ? 0.35 : 1 }]}
                  >
                    <Ionicons name="arrow-down" size={15} color={palette.ink} />
                  </Pressable>
                  {pg.uri ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xoay trang 90 độ"
                      onPress={() => void rotatePage90(pg)}
                      style={styles.miniBtn}
                    >
                      <Ionicons name="refresh-circle-outline" size={17} color={palette.indigo} />
                    </Pressable>
                  ) : null}
                  <Pressable onPress={() => void chooseImage(true, pg.id)} style={styles.miniBtn}>
                    <Ionicons name="camera-reverse-outline" size={15} color={palette.indigo} />
                  </Pressable>
                  <Pressable
                    onPress={() => syncManualFromPages(togglePageNeedsReview(pages, pg.id))}
                    style={[styles.miniBtn, pg.needsReview && { backgroundColor: '#FEF3C7' }]}
                  >
                    <Ionicons name="flag-outline" size={15} color={pg.needsReview ? '#D97706' : palette.inkMuted} />
                  </Pressable>
                  <Pressable onPress={() => syncManualFromPages(removeScanPage(pages, pg.id))} style={styles.miniBtn}>
                    <Ionicons name="trash-outline" size={15} color={palette.danger} />
                  </Pressable>
                </View>
              </View>

              <TextInput
                value={pg.text}
                onChangeText={(val) => syncManualFromPages(updatePageText(pages, pg.id, val))}
                multiline
                style={[styles.pageEditor, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
              />
            </Card>
          ))}
        </View>
      )}

      {/* Document Import (PDF / DOCX / MD / TXT) + Manual Text Area */}
      <Text style={[typography.title, { color: palette.ink, marginTop: spacing.lg, marginBottom: spacing.xs }]}>
        Nhập file tài liệu hoặc dán văn bản
      </Text>
      <Button disabled={busy} icon="document-text-outline" variant="secondary" onPress={() => void chooseDocument()}>
        📄 Nhập PDF / DOCX / Markdown / TXT
      </Button>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        maxLength={MAX_SOURCE_CHARS}
        textAlignVertical="top"
        placeholder="Dán đoạn ghi chú, giáo trình, hoặc nội dung trích xuất từ OCR…"
        placeholderTextColor={palette.inkMuted}
        style={[styles.textArea, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
      />
      <Text style={[typography.caption, { color: palette.inkMuted, marginTop: spacing.xs }]}>
        {text.length.toLocaleString()} / {MAX_SOURCE_CHARS.toLocaleString()} ký tự · Đánh dấu cờ vàng những trang cần chỉnh sửa trước khi tạo đề.
      </Text>

      <Card color={palette.mintTint} style={styles.privacy}>
        <IconTile icon="lock-closed-outline" tint="success" />
        <Text style={[typography.caption, { color: palette.mint, flex: 1 }]}>
          Kiểm soát quyền riêng tư · Ảnh được OCR cục bộ trên thiết bị. Khi đăng nhập, văn bản đã duyệt được lưu kèm nguồn để đồng bộ; AI nhận văn bản riêng khi bạn tạo đề.
        </Text>
      </Card>

      <Button disabled={busy} icon="arrow-forward" onPress={() => void continueToShape()}>
        {busy ? 'Đang xử lý tài liệu…' : 'Tiếp tục thiết lập câu hỏi'}
      </Button>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  langSection: { marginBottom: spacing.md },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  langChip: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1 },
  step: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 1, marginHorizontal: spacing.sm },
  captureRow: { flexDirection: 'row', gap: spacing.sm },
  captureCard: { flex: 1, minHeight: 132 },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: spacing.xs },
  pageCard: { padding: spacing.sm, borderRadius: radii.md, marginBottom: spacing.xs },
  pageTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  pageTools: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pageEditor: { borderWidth: 1, borderRadius: radii.sm, padding: 8, minHeight: 54, maxHeight: 120, fontSize: 13 },
  textArea: { marginTop: spacing.sm, minHeight: 120, borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, lineHeight: 22 },
  privacy: { marginVertical: spacing.lg, flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
