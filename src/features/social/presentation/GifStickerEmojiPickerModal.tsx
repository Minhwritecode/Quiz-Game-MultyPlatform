import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';
import {
  EMOJI_PICKER_CATEGORIES,
  searchGifsAndStickers,
  type StickerOrGifItem,
} from '@/composition/social';
import type { SocialMediaItem } from '../domain/models';

/**
 * Unified GIF, Sticker & Emoji Library Picker (Section 5.2)
 * Reusable across Thread Composer, Comments, Nested Replies, Stories & Messaging Center!
 */
export function GifStickerEmojiPickerModal({
  visible,
  onClose,
  onSelectEmoji,
  onSelectMedia,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectMedia: (media: SocialMediaItem) => void;
}) {
  const palette = usePalette();
  const [tab, setTab] = useState<'sticker' | 'gif' | 'emoji'>('sticker');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [items, setItems] = useState<StickerOrGifItem[]>([]);
  const [attribution, setAttribution] = useState<string | undefined>(undefined);
  const [favourites, setFavourites] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || tab === 'emoji') return;
    let active = true;
    const t = setTimeout(() => {
      void searchGifsAndStickers({
        query,
        kind: tab,
        category,
        limit: 16,
      }).then((res) => {
        if (!active) return;
        setItems(res.items);
        setAttribution(res.attribution);
      });
    }, 220);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [category, query, tab, visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Card style={[styles.sheet, { backgroundColor: palette.paper }]}>
          <View style={styles.header}>
            <Text style={[typography.title, { color: palette.ink }]}>Nhãn dán, GIF & Biểu cảm</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={palette.inkMuted} />
            </Pressable>
          </View>

          <View style={styles.tabRow}>
            {(
              [
                { id: 'sticker', label: 'Nhãn dán' },
                { id: 'gif', label: 'GIF' },
                { id: 'emoji', label: 'Biểu cảm' },
              ] as const
            ).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[
                  styles.tabBtn,
                  {
                    backgroundColor: tab === t.id ? palette.indigo : palette.paperRaised,
                    borderColor: tab === t.id ? palette.indigo : palette.paperMuted,
                  },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: tab === t.id ? palette.onPrimary : palette.ink }}>
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm GIF hoặc nhãn dán..."
            placeholderTextColor={palette.inkMuted}
            style={[
              styles.searchInput,
              { color: palette.ink, borderColor: palette.paperMuted, backgroundColor: palette.paperRaised },
            ]}
          />

          {tab !== 'emoji' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {[
                  { id: 'all', label: 'Tất cả' },
                  { id: 'trending', label: 'Xu hướng' },
                  { id: 'study', label: 'Học tập' },
                  { id: 'celebrate', label: 'Chúc mừng' },
                  { id: 'funny', label: 'Hài hước' },
                  { id: 'love', label: 'Yêu thích' },
                ].map((cat) => (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategory(cat.id)}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: category === cat.id ? palette.indigoTint : palette.paperRaised,
                        borderColor: category === cat.id ? palette.indigo : palette.paperMuted,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: palette.ink }}>{cat.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={styles.grid}>
                {items.map((it) => {
                  const isFav = favourites.includes(it.id);
                  return (
                    <Pressable
                      key={it.id}
                      onPress={() => {
                        onSelectMedia({
                          id: `${it.kind}-${Date.now()}`,
                          kind: it.kind,
                          uri: it.uri,
                          thumbnailUri: it.uri,
                          altText: it.title,
                          attribution: it.attribution,
                        });
                        onClose();
                      }}
                      onLongPress={() =>
                        setFavourites((prev) =>
                          prev.includes(it.id) ? prev.filter((x) => x !== it.id) : [...prev, it.id]
                        )
                      }
                      style={[styles.stickerTile, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}
                    >
                      <Image source={{ uri: it.uri }} style={styles.stickerImg} resizeMode="contain" />
                      <Text style={{ fontSize: 10.5, fontWeight: '700', color: palette.inkMuted }} numberOfLines={1}>
                        {isFav ? '⭐ ' : ''}
                        {it.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {attribution ? (
                <Text style={{ fontSize: 10.5, color: palette.inkMuted, textAlign: 'right' }}>{attribution}</Text>
              ) : null}
            </>
          ) : (
            <ScrollView style={{ maxHeight: 300 }} contentContainerStyle={{ gap: 12 }}>
              {EMOJI_PICKER_CATEGORIES.map((grp) => (
                <View key={grp.id} style={{ gap: 6 }}>
                  <Text style={{ fontSize: 11.5, fontWeight: '800', color: palette.indigo }}>{grp.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {grp.emojis
                      .filter((e) => !query.trim() || grp.label.toLowerCase().includes(query.trim().toLowerCase()) || e.includes(query))
                      .map((em) => (
                        <Pressable
                          key={em}
                          onPress={() => {
                            onSelectEmoji(em);
                            onClose();
                          }}
                          style={[styles.emojiCell, { backgroundColor: palette.paperRaised }]}
                        >
                          <Text style={{ fontSize: 24 }}>{em}</Text>
                        </Pressable>
                      ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: spacing.sm,
  },
  sheet: { width: '100%', maxWidth: 520, gap: 10, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabRow: { flexDirection: 'row', gap: 6 },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  searchInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  catChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill, borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  stickerTile: {
    width: '31%',
    minWidth: 92,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 6,
    alignItems: 'center',
    gap: 4,
  },
  stickerImg: { width: 76, height: 76 },
  emojiCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
