import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconTile, Screen, usePalette } from '@/shared/ui';
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
  const sets = usePapyrusStore((state) => state.questionSets);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState('');
  const [csvError, setCsvError] = useState('');
  const [csvBusy, setCsvBusy] = useState(false);
  const [visibleCount, setVisibleCount] = useState(SETS_PAGE_SIZE);

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

  const filtered = useMemo(
    () => sets.filter((item) => `${item.title} ${item.subject}`.toLowerCase().includes(query.toLowerCase())),
    [query, sets]
  );

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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitles}>
          <Text style={[typography.label, { color: palette.indigo }]}>{t.library.tag}</Text>
          <Text style={[typography.heading, { color: palette.ink, marginTop: spacing.xs }]}>
            {t.library.title}
          </Text>
          <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
            {t.library.subtitle}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Button icon="add" onPress={() => router.push('/create/generate?mode=manual')} variant="primary">{t.home.createManualBtn}</Button>
          <Button icon="sparkles" onPress={() => router.push('/create/scan')} variant="secondary">{t.home.createAiBtn}</Button>
          <Button icon="cloud-upload-outline" onPress={() => { setCsvError(''); setCsvModalOpen(true); }} variant="ghost">
            {language === 'vi' ? 'Nhập CSV' : 'Import CSV'}
          </Button>
        </View>
      </View>
      {actionError ? <Text accessibilityRole="alert" style={[typography.caption, { color: palette.danger, marginBottom: spacing.md }]}>{actionError}</Text> : null}

      {/* Search Input */}
      <View style={[styles.search, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}>
        <Ionicons name="search" size={20} color={palette.inkMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t.library.searchPlaceholder}
          placeholderTextColor={palette.inkMuted}
          style={[styles.searchInput, { color: palette.ink }]}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={18} color={palette.inkMuted} />
          </Pressable>
        )}
      </View>

      {/* Meta Bar */}
      <View style={styles.meta}>
        <Text style={[typography.caption, { color: palette.inkMuted }]}>
          {t.library.displayMeta} {filtered.length} / {sets.length} {t.library.questionsCount}
        </Text>
        <Badge tone="success">{t.library.offlineFirst}</Badge>
      </View>
      <View style={{ marginBottom: spacing.md }}><Button variant="ghost" icon="time-outline" onPress={() => router.push('/study/history')}>{t.study.historyTitle}</Button></View>

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
        filtered.slice(0, visibleCount).map((set) => (
          <Card
            key={set.id}
            onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })}
            style={styles.setCard}
          >
            <IconTile
              icon={set.questions.length ? 'book-outline' : 'document-text-outline'}
              tint={set.questions.length ? 'primary' : 'reward'}
            />
            <View style={styles.copy}>
              <Text style={[typography.title, { color: palette.ink }]}>{set.title}</Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 2 }]}>
                {set.subject || t.library.uncategorized}
              </Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 6 }]}>
                {set.questions.length} {t.library.questionsCount} · {t.library.updated}{' '}
                {new Date(set.updatedAt).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US')}
              </Text>
            </View>
            <View style={styles.trailing}>
              <Badge tone={set.syncStatus === 'failed' ? 'danger' : set.syncStatus === 'pending' ? 'reward' : 'success'}>
                {set.syncStatus === 'failed'
                  ? language === 'vi' ? 'Lỗi đồng bộ' : 'Sync failed'
                  : set.syncStatus === 'pending'
                  ? t.library.pendingSync
                  : t.library.synced}
              </Badge>
              <View style={styles.actionIcons}>
                {set.questions.length >= 3 && (
                  <>
                    <Pressable
                      onPress={(e) => {
                        // @ts-ignore
                        e.stopPropagation?.();
                        router.push({ pathname: '/games/survival', params: { setId: set.id } });
                      }}
                      style={[styles.gameIconBtn, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}
                      accessibilityRole="button"
                      accessibilityLabel="Play Survival Game"
                    >
                      <Ionicons name="skull" size={17} color={palette.danger} />
                    </Pressable>
                    <Pressable
                      onPress={(e) => {
                        // @ts-ignore
                        e.stopPropagation?.();
                        router.push({ pathname: '/games/match', params: { setId: set.id } });
                      }}
                      style={styles.gameIconBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Play Match Game"
                    >
                      <Ionicons name="extension-puzzle" size={18} color={palette.gold} />
                    </Pressable>
                  </>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Nhân bản: ${set.title}`}
                  disabled={actionBusyId === set.id}
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleDuplicateSet(set);
                  }}
                  style={styles.utilityIconBtn}
                >
                  <Ionicons name="copy-outline" size={17} color={palette.indigo} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Xuất CSV: ${set.title}`}
                  disabled={actionBusyId === set.id}
                  onPress={(event) => {
                    event.stopPropagation();
                    void handleExportCsv(set);
                  }}
                  style={styles.utilityIconBtn}
                >
                  <Ionicons name="download-outline" size={18} color={palette.mint} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t.home.editSet}: ${set.title}`} disabled={actionBusyId === set.id} onPress={(event) => { event.stopPropagation(); router.push({ pathname: '/create/generate', params: { mode: 'manual', setId: set.id } }); }} style={styles.utilityIconBtn}>
                  <Ionicons name="create-outline" size={18} color={palette.indigo} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`${t.home.deleteSet}: ${set.title}`} disabled={actionBusyId === set.id} onPress={(event) => { event.stopPropagation(); confirmDelete(set.id); }} style={styles.utilityIconBtn}>
                  <Ionicons name="trash-outline" size={18} color={palette.danger} />
                </Pressable>
                <Ionicons name="chevron-forward" size={20} color={palette.indigo} />
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

      {/* Bulk CSV Import Modal */}
      <Modal visible={csvModalOpen} transparent animationType="fade" onRequestClose={() => setCsvModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCsvModalOpen(false)}>
          <Pressable style={styles.modalWrap} onPress={() => undefined}>
            <Card style={styles.modalCard}>
              <Text style={[typography.title, { color: palette.ink }]}>📥 Nhập bộ câu hỏi hàng loạt (CSV)</Text>
              <Text style={[typography.caption, { color: palette.inkMuted, marginTop: 4 }]}>
                Dán nội dung file CSV chuẩn (hỗ trợ mẫu 12 cột hoặc mẫu gọn Question,A,B,C,D,Correct).
              </Text>

              <Pressable
                onPress={() => {
                  setCsvText(SAMPLE_QUIZ_CSV);
                  setCsvError('');
                }}
                style={[styles.samplePill, { backgroundColor: palette.indigoTint, borderColor: palette.indigo }]}
              >
                <Ionicons name="document-text-outline" size={15} color={palette.indigo} />
                <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700' }]}>
                  Chèn nhanh dữ liệu CSV mẫu
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
                style={[styles.csvInput, { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paper }]}
              />

              {csvError ? (
                <Text accessibilityRole="alert" style={[typography.caption, { color: palette.danger, marginBottom: spacing.sm }]}>
                  {csvError}
                </Text>
              ) : null}

              <View style={styles.modalActions}>
                <View style={{ flex: 1 }}>
                  <Button variant="ghost" onPress={() => setCsvModalOpen(false)} fullWidth>
                    Hủy
                  </Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button variant="primary" disabled={csvBusy || !csvText.trim()} onPress={() => void handleImportCsv()} fullWidth>
                    {csvBusy ? 'Đang nhập...' : 'Nhập vào thư viện'}
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerTitles: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  copy: { flex: 1 },
  trailing: { alignItems: 'flex-end', gap: spacing.xs },
  actionIcons: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  gameIconBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  utilityIconBtn: { width: 44, height: 44, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(79, 70, 229, 0.08)' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalWrap: { width: '100%', maxWidth: 520 },
  modalCard: { padding: spacing.lg, borderRadius: radii.lg },
  samplePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, marginTop: spacing.sm },
  csvInput: { minHeight: 130, maxHeight: 220, borderWidth: 1, borderRadius: radii.sm, padding: spacing.sm, marginVertical: spacing.md, fontFamily: 'monospace', fontSize: 12, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: spacing.sm },
});
