import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Card, EmptyState, IconTile, Screen, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { useI18n } from '@/core/i18n';

export default function LibraryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const { language, t } = useI18n();
  const [query, setQuery] = useState('');
  const sets = usePapyrusStore((state) => state.questionSets);

  const filtered = useMemo(
    () => sets.filter((item) => `${item.title} ${item.subject}`.toLowerCase().includes(query.toLowerCase())),
    [query, sets]
  );

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
        <Button
          icon="add"
          onPress={() => router.push('/create/scan')}
          variant="primary"
        >
          {t.library.newBtn}
        </Button>
      </View>

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
              <Badge tone={set.syncStatus === 'pending' ? 'reward' : 'success'}>
                {set.syncStatus === 'pending' ? t.library.pendingSync : t.library.synced}
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
    padding: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
});
