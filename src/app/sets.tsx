import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconTile, OnlineStatusDot, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useI18n } from '@/core/i18n';
import { dependencies } from '@/composition/dependencies';
import { saveQuestionSet } from '@/features/question-sets/domain/saveQuestionSet';
import {
  exportQuestionSetToCsv,
  parseQuizCsv,
  SAMPLE_QUIZ_CSV,
} from '@/features/question-sets/domain/csvTransfer';
import { cloneQuestionSet } from '@/features/study/domain/setAnalytics';
import type { QuestionSet } from '@/core/domain/models';

const SETS_PAGE_SIZE = 10;

export default function LibraryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const [query, setQuery] = useState('');
  const syncMessage = usePapyrusStore((state) => state.syncMessage);
  const sets = usePapyrusStore((state) => state.questionSets);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SETS_PAGE_SIZE);
  const [menuSet, setMenuSet] = useState<QuestionSet | null>(null);

  const handleDuplicateSet = async (original: QuestionSet) => {
    setActionBusyId(original.id);
    setActionError('');
    try {
      const stamp = Date.now();
      const cloned = cloneQuestionSet(
        original,
        `copy-${stamp}-${Math.random().toString(36).slice(2, 6)}`,
        (idx) => `q-copy-${stamp}-${idx}`,
        language === 'vi' ? '(Bản sao)' : '(Copy)'
      );
      await saveQuestionSet(dependencies.questionSets, cloned);
      usePapyrusStore.getState().saveQuestionSet(cloned);
    } catch {
      setActionError(language === 'vi' ? 'Không thể nhân bản bộ câu hỏi lúc này.' : 'Could not duplicate this set.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleImportCsv = async () => {
    if (csvBusy) return;
    setCsvError('');
    setCsvBusy(true);
    try {
      const parsed = parseQuizCsv(csvText);
      const newSet: QuestionSet = {
        id: `csv-set-${Date.now()}`,
        title: parsed.title,
        subject: parsed.subject,
        questions: parsed.questions,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };
      await saveQuestionSet(dependencies.questionSets, newSet);
      usePapyrusStore.getState().saveQuestionSet(newSet);
      setCsvModalOpen(false);
      setCsvText('');
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : 'Không thể đọc dữ liệu CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  const handleExportCsv = async (set: QuestionSet) => {
    const csv = exportQuestionSetToCsv(set);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${set.title.replace(/[^a-z0-9-_]+/gi, '_') || 'papyrus-quiz'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    await Share.share({ title: `${set.title}.csv`, message: csv }).catch(() => undefined);
  };

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sets;
    return sets.filter((item) =>
      `${item.title} ${item.subject}`.toLowerCase().includes(normalizedQuery)
    );
  }, [query, sets]);

  const visibleSets = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const removeSet = async (id: string) => {
    setActionBusyId(id);
    setActionError('');
    try {
      await dependencies.questionSets.remove(id);
      await dependencies.study.clearProgress(id).catch(() => undefined);
      usePapyrusStore.getState().deleteQuestionSet(id);
    } catch {
      setActionError(t.home.deleteSetError);
    } finally {
      setActionBusyId(null);
    }
  };

  const confirmDelete = (id: string) => {
    const doDelete = () => void removeSet(id);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm(t.home.confirmDeleteSet)) doDelete();
      return;
    }
    Alert.alert(t.home.deleteSet, t.home.confirmDeleteSet, [
      { text: language === 'vi' ? 'Hủy' : 'Cancel', style: 'cancel' },
      { text: t.home.deleteSet, style: 'destructive', onPress: doDelete },
    ]);
  };

  return (
    <Screen bottomNav>
      {/* Stacked Clean Header — Zero Horizontal Crush on Any Viewport */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={[typography.label, { color: palette.indigo }]}>{t.library.tag}</Text>
          <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
            {t.library.title}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
            {t.library.subtitle}
          </Text>
        </View>

        <View style={styles.primaryActions}>
          <View style={styles.actionFlex}>
            <Button icon="sparkles" onPress={() => router.push('/create/scan')} variant="primary" fullWidth>
              {t.home.createAiBtn}
            </Button>
          </View>
          <View style={styles.actionFlex}>
            <Button
              icon="add"
              onPress={() => router.push('/create/generate?mode=manual')}
              variant="secondary"
              fullWidth
            >
              {t.home.createManualBtn}
            </Button>
          </View>
        </View>

        <View style={styles.utilityRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setCsvError('');
              setCsvModalOpen(true);
            }}
            style={[styles.utilityChip, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
          >
            <Ionicons name="cloud-upload-outline" size={15} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
              {language === 'vi' ? 'Nhập CSV' : 'Import CSV'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/sync')}
            style={[styles.utilityChip, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
          >
            <Ionicons name="sync-outline" size={15} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
              {language === 'vi' ? 'Đồng bộ' : 'Sync'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/study/history')}
            style={[styles.utilityChip, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}
          >
            <Ionicons name="time-outline" size={15} color={palette.indigo} />
            <Text style={[typography.caption, { color: palette.ink, fontWeight: '700' }]}>
              {t.study.historyTitle}
            </Text>
          </Pressable>
        </View>
      </View>

      {actionError ? (
        <Text accessibilityRole="alert" style={[typography.caption, { color: palette.danger, marginBottom: spacing.md }]}>
          {actionError}
        </Text>
      ) : null}

      {!!syncMessage && (
        <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: palette.inkMuted, marginBottom: spacing.sm }]}>
          {syncMessage}
        </Text>
      )}

      {/* Search Input */}
      <View style={[styles.search, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
        <Ionicons name="search" size={19} color={palette.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.library.searchPlaceholder}
          placeholderTextColor={palette.inkMuted}
          style={[styles.searchInput, { color: palette.ink }]}
        />
        {query.length > 0 && (
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={language === 'vi' ? 'Xóa tìm kiếm' : 'Clear search'}
            onPress={() => setQuery('')}
          >
            <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
          </Pressable>
        )}
      </View>

      {/* Meta Bar */}
      <View style={styles.meta}>
        <Text style={[typography.caption, { color: palette.inkMuted }]}>
          {t.library.displayMeta} {filtered.length} / {sets.length} bộ câu hỏi
        </Text>
        <OnlineStatusDot />
      </View>

      {/* Sets List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="library-outline"
          title={t.library.emptyTitle}
          message={
            query
              ? language === 'vi'
                ? `Không có kết quả nào phù hợp với từ khóa "${query}".`
                : `No question sets matched "${query}".`
              : t.library.emptyDesc
          }
        />
      ) : (
        visibleSets.map((set) => (
          <Card
            key={set.id}
            onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })}
            style={styles.setCard}
          >
            <View style={styles.setRowTop}>
              <IconTile
                icon={set.questions.length ? 'book-outline' : 'document-text-outline'}
                tint={set.questions.length ? 'primary' : 'reward'}
              />
              <View style={styles.copy}>
                <Text style={[typography.title, { color: palette.ink }]} numberOfLines={2}>
                  {set.title}
                </Text>
                <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]} numberOfLines={1}>
                  {set.subject || t.library.uncategorized} · {set.questions.length} {t.library.questionsCount}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={language === 'vi' ? `Tùy chọn cho ${set.title}` : `Options for ${set.title}`}
                disabled={actionBusyId === set.id}
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation?.();
                  setMenuSet(set);
                }}
                style={[styles.moreBtn, { backgroundColor: palette.paper }]}
              >
                <Ionicons name="ellipsis-horizontal" size={20} color={palette.inkMuted} />
              </Pressable>
            </View>

            <View style={[styles.setRowFooter, { borderTopColor: palette.paperMuted }]}>
              <View style={styles.footerLeft}>
                <Badge
                  tone={
                    set.syncStatus === 'conflict'
                      ? 'danger'
                      : set.syncStatus === 'pending' || set.syncStatus === 'failed'
                      ? 'reward'
                      : 'success'
                  }
                >
                  {set.syncStatus === 'conflict'
                    ? language === 'vi'
                      ? 'Xung đột'
                      : 'Conflict'
                    : set.syncStatus === 'failed'
                    ? language === 'vi'
                      ? 'Chờ thử lại'
                      : 'Retry pending'
                    : set.syncStatus === 'pending'
                    ? t.library.pendingSync
                    : t.library.synced}
                </Badge>
                <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 12 }]}>
                  {new Date(set.updatedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
                </Text>
              </View>

              <View style={styles.studyPill}>
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '800' }]}>
                  {language === 'vi' ? 'Học ngay' : 'Study'}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={palette.indigo} />
              </View>
            </View>
          </Card>
        ))
      )}

      {filtered.length > visibleCount && (
        <View style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>
          <Button variant="secondary" onPress={() => setVisibleCount((c) => c + SETS_PAGE_SIZE)} fullWidth>
            {language === 'vi'
              ? `Xem thêm bộ câu hỏi (${filtered.length - visibleCount} còn lại)`
              : `Load more sets (${filtered.length - visibleCount} remaining)`}
          </Button>
        </View>
      )}

      {/* Clean Action Sheet for Set Options */}
      <Modal
        visible={Boolean(menuSet)}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuSet(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuSet(null)}>
          <Pressable style={styles.sheetWrap} onPress={() => undefined}>
            {menuSet ? (
              <Card style={styles.modalCard}>
                <View style={styles.sheetHeader}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[typography.title, { color: palette.ink }]} numberOfLines={2}>
                      {menuSet.title}
                    </Text>
                    <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                      {menuSet.questions.length} {t.library.questionsCount}
                    </Text>
                  </View>
                  <Pressable onPress={() => setMenuSet(null)} hitSlop={8} accessibilityRole="button">
                    <Ionicons name="close" size={22} color={palette.inkMuted} />
                  </Pressable>
                </View>

                <View style={styles.sheetList}>
                  {menuSet.questions.length >= 3 && (
                    <>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const id = menuSet.id;
                          setMenuSet(null);
                          router.push({ pathname: '/games/survival', params: { setId: id } });
                        }}
                        style={styles.sheetItem}
                      >
                        <Ionicons name="skull-outline" size={20} color={palette.danger} />
                        <Text style={[typography.body, { color: palette.ink }]}>
                          {language === 'vi' ? 'Chơi Đấu trường Sinh tồn 3D' : 'Play 3D Survival Arena'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          const id = menuSet.id;
                          setMenuSet(null);
                          router.push({ pathname: '/games/match', params: { setId: id } });
                        }}
                        style={styles.sheetItem}
                      >
                        <Ionicons name="extension-puzzle-outline" size={20} color={palette.gold} />
                        <Text style={[typography.body, { color: palette.ink }]}>
                          {language === 'vi' ? 'Chơi Ghép thẻ Thư viện 3D' : 'Play 3D Match Pairs'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const id = menuSet.id;
                      setMenuSet(null);
                      router.push({ pathname: '/create/generate', params: { mode: 'manual', setId: id } });
                    }}
                    style={styles.sheetItem}
                  >
                    <Ionicons name="create-outline" size={20} color={palette.indigo} />
                    <Text style={[typography.body, { color: palette.ink }]}>{t.home.editSet}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const target = menuSet;
                      setMenuSet(null);
                      void handleDuplicateSet(target);
                    }}
                    style={styles.sheetItem}
                  >
                    <Ionicons name="copy-outline" size={20} color={palette.indigo} />
                    <Text style={[typography.body, { color: palette.ink }]}>
                      {language === 'vi' ? 'Nhân bản bộ câu hỏi' : 'Duplicate set'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const target = menuSet;
                      setMenuSet(null);
                      void handleExportCsv(target);
                    }}
                    style={styles.sheetItem}
                  >
                    <Ionicons name="download-outline" size={20} color={palette.mint} />
                    <Text style={[typography.body, { color: palette.ink }]}>
                      {language === 'vi' ? 'Xuất tệp CSV' : 'Export CSV'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      const id = menuSet.id;
                      setMenuSet(null);
                      confirmDelete(id);
                    }}
                    style={styles.sheetItem}
                  >
                    <Ionicons name="trash-outline" size={20} color={palette.danger} />
                    <Text style={[typography.body, { color: palette.danger, fontWeight: '700' }]}>
                      {t.home.deleteSet}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal visible={csvModalOpen} transparent animationType="fade" onRequestClose={() => setCsvModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCsvModalOpen(false)}>
          <Pressable style={styles.modalWrap} onPress={() => undefined}>
            <Card style={styles.modalCard}>
              <Text style={[typography.title, { color: palette.ink }]}>
                {language === 'vi' ? 'Nhập bộ câu hỏi hàng loạt (CSV)' : 'Bulk Import Question Set (CSV)'}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
                {language === 'vi'
                  ? 'Dán nội dung CSV chuẩn (hỗ trợ mẫu 12 cột hoặc Question,A,B,C,D,Correct).'
                  : 'Paste standard CSV content (12-column format or Question,A,B,C,D,Correct).'}
              </Text>

              <Pressable
                onPress={() => {
                  setCsvText(SAMPLE_QUIZ_CSV);
                  setCsvError('');
                }}
                style={[styles.samplePill, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
              >
                <Ionicons name="document-text-outline" size={15} color={palette.indigo} />
                <Text style={[typography.caption, { color: palette.indigoDeep, fontWeight: '700' }]}>
                  {language === 'vi' ? 'Chèn nhanh dữ liệu CSV mẫu' : 'Insert sample CSV'}
                </Text>
              </Pressable>

              <TextInput
                value={csvText}
                onChangeText={setCsvText}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                placeholder='"Question","A","B","C","D","Correct"'
                placeholderTextColor={palette.inkMuted}
                style={[
                  styles.csvInput,
                  { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper },
                ]}
              />

              {csvError ? (
                <Text accessibilityRole="alert" style={[typography.caption, { color: palette.danger, marginBottom: spacing.sm }]}>
                  {csvError}
                </Text>
              ) : null}

              <View style={styles.modalActions}>
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" onPress={() => setCsvModalOpen(false)} fullWidth>
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    variant="primary"
                    disabled={csvBusy || !csvText.trim()}
                    onPress={() => void handleImportCsv()}
                    fullWidth
                  >
                    {csvBusy
                      ? language === 'vi'
                        ? 'Đang nhập...'
                        : 'Importing...'
                      : language === 'vi'
                      ? 'Nhập vào thư viện'
                      : 'Import to library'}
                  </Button>
                </View>
              </View>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'column',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  headerTitles: { width: '100%' },
  primaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionFlex: { flex: 1, minWidth: 148 },
  utilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  utilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  search: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15 },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  setCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
    gap: spacing.md,
  },
  setRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  copy: { flex: 1, minWidth: 0 },
  moreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  studyPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 10, 36, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalWrap: { width: '100%', maxWidth: 520 },
  sheetWrap: { width: '100%', maxWidth: 420 },
  modalCard: { padding: spacing.lg, borderRadius: radii.lg },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  sheetList: { gap: 4 },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.sm,
  },
  samplePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  csvInput: {
    minHeight: 130,
    maxHeight: 220,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginVertical: spacing.md,
    fontFamily: 'monospace',
    fontSize: 12,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
});
