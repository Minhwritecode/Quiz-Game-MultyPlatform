import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconTile, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useI18n } from '@/core/i18n';
import { dependencies } from '@/composition/dependencies';

export default function LibraryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const [query, setQuery] = useState('');
  const sets = usePapyrusStore((state) => state.questionSets);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

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
        filtered.map((set) => (
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
              <Badge tone={set.syncStatus === 'pending' || set.syncStatus === 'failed' ? 'reward' : 'success'}>
                {set.syncStatus === 'pending' || set.syncStatus === 'failed' ? t.library.pendingSync : t.library.synced}
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
});
