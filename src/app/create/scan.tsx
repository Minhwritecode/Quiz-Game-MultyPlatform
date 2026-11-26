import { useAuthStore } from '@/core/state/useAuthStore';
import { randomUUID } from 'expo-crypto';
import { AppError, errorMessage } from '@/core/domain/failure';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ProgressBar, Screen, TopBar, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { createSourceDocument } from '@/features/scan-ocr/domain/sourceDocument';
import { sanitizeOcrAndDocumentText } from '@/features/scan-ocr/domain/ocrCleaner';
import {
  buildReviewedSourceText,
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
  { code: 'vie+eng', label: 'Việt + Anh' },
  { code: 'vie', label: 'Tiếng Việt' },
  { code: 'eng', label: 'English' },
  { code: 'jpn+eng', label: '日本語' },
  { code: 'kor+eng', label: '한국어' },
  { code: 'chi_sim+eng', label: '中文' },
  { code: 'fra+deu+spa+eng', label: 'FR / DE / ES' },
  { code: 'rus+eng', label: 'Русский' },
  { code: 'ara+eng', label: 'العربية' },
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

  const [showOcrSettings, setShowOcrSettings] = useState(false);
  const [message, setMessage] = useState('');
  const sourceText = useMemo(() => buildReviewedSourceText(pages, text), [pages, text]);
  const sourceTooLong = sourceText.length > MAX_SOURCE_CHARS;

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
      setPages(updated);
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
            text: rawText,
            needsReview: rawText.length < 24,
            status: rawText ? 'done' : 'error',
          })
        );
      }

      const nextPages = replacePageId
        ? pages.map((p) => (p.id === replacePageId ? newlyScanned[0]! : p))
        : [...pages, ...newlyScanned];

      setPages(nextPages);
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
    setMessage('');
    try {
      const picked = await dependencies.intake.pickRichSourceDocument();
      if (!picked) return;
      if (!picked.extractedText) {
        setMessage(`Không tìm thấy văn bản trong ${picked.name}. Với bản scan, thử chọn ảnh hoặc dán đoạn cần học.`);
        return;
      }
      const newPage = createScanPage({
        id: randomUUID(),
        title: picked.name,
        text: picked.extractedText,
        needsReview: false,
      });
      setPages((current) => [...current, newPage]);
      sfx.playCorrect();
    } catch (error) {
      setMessage(errorMessage(error, 'Không đọc được tệp. Hãy chọn lại tệp hoặc dán văn bản.'));
    } finally {
      setBusy(false);
    }
  };

  const continueToShape = async () => {
    if (busy || !sourceText || sourceTooLong) return;
    setMessage('');
    setBusy(true);
    try {
      const account = useAuthStore.getState().user?.id;
      const document = createSourceDocument(randomUUID(), sourceText);
      const firstIncludedPage = pages.find((page) => page.selected && page.text.trim());
      if (firstIncludedPage) document.title = firstIncludedPage.title;
      await dependencies.sources.save(document);
      if (useAuthStore.getState().user?.id !== account) return;
      saveSourceDocument(document);
      router.push('/create/generate');
    } catch (error) {
      setMessage(errorMessage(error, 'Không lưu được tài liệu. Hãy thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  const reviewCount = pages.filter((p) => p.selected && p.needsReview).length;

  return (
    <Screen contentStyle={styles.screen}>
      <TopBar
        title="Tạo bộ câu hỏi"
        right={<Text style={[typography.caption, { color: palette.inkMuted }]}>Bước 1 / 3</Text>}
      />

      <View style={styles.intro}>
        <Text accessibilityRole="header" style={[typography.heading, styles.heading, { color: palette.ink }]}>
          Nhập tài liệu
        </Text>
        <Text style={[typography.body, { color: palette.inkMuted }]}>
          Chọn tệp, chụp trang sách hoặc dán đoạn bạn muốn ôn.
        </Text>
      </View>

      <View style={styles.sources}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void chooseDocument()}
          style={({ pressed }) => [
            styles.fileButton,
            { backgroundColor: palette.paperRaised, borderColor: pressed ? palette.indigo : palette.paperMuted },
          ]}
        >
          <Ionicons name="document-outline" size={23} color={palette.indigo} />
          <View style={styles.sourceCopy}>
            <Text style={[typography.title, { color: palette.ink }]}>Chọn tệp</Text>
            <Text style={[typography.caption, { color: palette.inkMuted }]}>PDF, DOCX, Markdown, TXT · tối đa 20 MB</Text>
          </View>
          <Ionicons name="add" size={20} color={palette.indigo} />
        </Pressable>
        <View style={styles.captureRow}>
          <View style={styles.captureAction}>
            <Button disabled={busy} variant="ghost" icon="camera-outline" onPress={() => void chooseImage(true)} fullWidth>
              Chụp ảnh
            </Button>
          </View>
          <View style={styles.captureAction}>
            <Button disabled={busy} variant="ghost" icon="images-outline" onPress={() => void chooseImage(false)} fullWidth>
              Chọn ảnh
            </Button>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showOcrSettings }}
          onPress={() => setShowOcrSettings((current) => !current)}
          style={styles.ocrToggle}
        >
          <Ionicons name="options-outline" size={16} color={palette.inkMuted} />
          <Text style={[typography.caption, styles.sourceCopy, { color: palette.inkMuted }]}>
            Ngôn ngữ ảnh · {OCR_LANGUAGES.find((item) => item.code === ocrLanguage)?.label}
          </Text>
          <Ionicons name={showOcrSettings ? 'chevron-up' : 'chevron-down'} size={14} color={palette.inkMuted} />
        </Pressable>
        {showOcrSettings && (
          <View style={styles.langWrap}>
            {OCR_LANGUAGES.map((item) => {
              const active = ocrLanguage === item.code;
              return (
                <Pressable
                  key={item.code}
                  disabled={busy}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => setOcrLanguage(item.code)}
                  style={[
                    styles.langChip,
                    {
                      backgroundColor: active ? palette.indigoTint : palette.paperRaised,
                      borderColor: active ? palette.indigoBorder : palette.paperMuted,
                    },
                  ]}
                >
                  <Text style={[typography.caption, { color: active ? palette.indigoDeep : palette.ink }]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {Platform.OS === 'web' && (
          <Text style={[typography.caption, { color: palette.inkMuted }]}>
            Khi đăng nhập trên web, ảnh có thể được gửi đi để nhận diện chữ.
          </Text>
        )}
      </View>

      {scanProgress && (
        <Card style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800', flex: 1 }]} numberOfLines={1}>
              Ảnh {scanProgress.current}/{scanProgress.total} · {scanProgress.stage}
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
              Nội dung đã nhập
            </Text>
            {reviewCount > 0 && <Badge tone="reward">{reviewCount} mục cần rà soát</Badge>}
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
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: pg.selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => setPages(togglePageSelected(pages, pg.id))}
                  style={styles.pageTitle}
                >
                  <Ionicons
                    name={pg.selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={pg.selected ? palette.indigo : palette.inkMuted}
                  />
                  <Text style={[typography.body, styles.sourceCopy, { color: palette.ink, fontWeight: '700' }]} numberOfLines={2}>
                    {idx + 1}. {pg.title}
                  </Text>
                </Pressable>

                <View style={styles.pageTools}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đưa lên"
                    disabled={busy || idx === 0}
                    onPress={() => setPages(reorderScanPages(pages, idx, idx - 1))}
                    style={[styles.miniBtn, { opacity: idx === 0 ? 0.35 : 1 }]}
                  >
                    <Ionicons name="arrow-up" size={15} color={palette.ink} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Đưa xuống"
                    disabled={busy || idx === pages.length - 1}
                    onPress={() => setPages(reorderScanPages(pages, idx, idx + 1))}
                    style={[styles.miniBtn, { opacity: idx === pages.length - 1 ? 0.35 : 1 }]}
                  >
                    <Ionicons name="arrow-down" size={15} color={palette.ink} />
                  </Pressable>
                  {pg.uri ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Xoay trang 90 độ"
                      disabled={busy}
                      onPress={() => void rotatePage90(pg)}
                      style={styles.miniBtn}
                    >
                      <Ionicons name="refresh-circle-outline" size={17} color={palette.indigo} />
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" accessibilityLabel="Chụp lại" disabled={busy} onPress={() => void chooseImage(true, pg.id)} style={styles.miniBtn}>
                    <Ionicons name="camera-reverse-outline" size={15} color={palette.indigo} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={pg.needsReview ? 'Bỏ đánh dấu rà soát' : 'Đánh dấu cần rà soát'}
                    disabled={busy}
                    onPress={() => setPages(togglePageNeedsReview(pages, pg.id))}
                    style={[styles.miniBtn, pg.needsReview && { backgroundColor: '#FEF3C7' }]}
                  >
                    <Ionicons name="flag-outline" size={15} color={pg.needsReview ? '#D97706' : palette.inkMuted} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Xóa mục" disabled={busy} onPress={() => setPages(removeScanPage(pages, pg.id))} style={styles.miniBtn}>
                    <Ionicons name="trash-outline" size={15} color={palette.danger} />
                  </Pressable>
                </View>
              </View>

              <TextInput
                accessibilityLabel={`Nội dung ${pg.title}`}
                placeholder="Chưa đọc được chữ. Bạn có thể nhập lại ở đây."
                placeholderTextColor={palette.inkMuted}
                editable={!busy}
                value={pg.text}
                onChangeText={(val) => setPages(updatePageText(pages, pg.id, val))}
                multiline
                style={[styles.pageEditor, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
              />
            </Card>
          ))}
        </View>
      )}

      <View style={styles.review}>
        <Text style={[typography.title, { color: palette.ink }]}>
          {pages.length ? 'Văn bản bổ sung' : 'Dán văn bản'}
        </Text>
        <TextInput
          accessibilityLabel={pages.length ? 'Văn bản bổ sung' : 'Văn bản tài liệu'}
          value={text}
          onChangeText={setText}
          editable={!busy}
          multiline
          maxLength={MAX_SOURCE_CHARS}
          textAlignVertical="top"
          placeholder={pages.length ? 'Thêm đoạn ghi chú nếu cần…' : 'Dán ghi chú hoặc đoạn trích ở đây…'}
          placeholderTextColor={palette.inkMuted}
          style={[styles.textArea, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
        />
        <Text style={[typography.caption, { color: sourceTooLong ? palette.danger : palette.inkMuted }]}>
          {sourceTooLong
            ? 'Nội dung vượt 30.000 ký tự. Hãy rút ngắn văn bản hoặc bỏ chọn một mục.'
            : `${sourceText.length.toLocaleString('vi-VN')} / 30.000 ký tự`}
        </Text>
      </View>

      {message ? <Text accessibilityRole="alert" style={[typography.body, { color: palette.danger }]}>{message}</Text> : null}
      <View style={styles.footer}>
        <Button disabled={busy || !sourceText || sourceTooLong} icon="arrow-forward" fullWidth onPress={() => void continueToShape()}>
          {busy ? 'Đang xử lý…' : 'Tiếp tục'}
        </Button>
        <Text style={[typography.caption, { color: palette.inkMuted }]}>
          Văn bản đã duyệt dùng để tạo câu hỏi và được đồng bộ khi bạn đăng nhập.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { maxWidth: 640 },
  intro: { gap: spacing.xs, marginTop: spacing.xs, marginBottom: spacing.lg },
  heading: { fontSize: 28, lineHeight: 34 },
  sources: { gap: spacing.xs },
  fileButton: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderRadius: radii.md,
  },
  sourceCopy: { flex: 1, minWidth: 0 },
  captureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  captureAction: { flex: 1, minWidth: 116 },
  ocrToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  langChip: { paddingHorizontal: spacing.sm, minHeight: 38, justifyContent: 'center', borderRadius: radii.sm, borderWidth: 1 },
  review: { gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.sm },
  footer: { gap: spacing.sm, marginTop: spacing.sm },
  sessionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: spacing.xs },
  pageCard: { padding: spacing.sm, borderRadius: radii.md, marginBottom: spacing.xs },
  pageTopRow: { gap: spacing.xs, marginBottom: spacing.xs },
  pageTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 36 },
  pageTools: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  miniBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  pageEditor: { borderWidth: 1, borderRadius: radii.sm, padding: 8, minHeight: 54, maxHeight: 120, fontSize: 13 },
  textArea: { minHeight: 110, borderWidth: 1, borderRadius: radii.sm, padding: spacing.md, fontSize: 15, lineHeight: 22 },
});
