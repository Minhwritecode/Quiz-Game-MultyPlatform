import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, BottomNav, Card, IconTile, PageHeader, Screen, usePalette } from '@/shared/ui';
import { spacing, typography } from '@/core/theme/tokens';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';

export default function LibraryScreen() {
  const router = useRouter();
  const palette = usePalette();
  const [query, setQuery] = useState('');
  const sets = usePapyrusStore((state) => state.questionSets);
  const filtered = useMemo(() => sets.filter((item) => `${item.title} ${item.subject}`.toLowerCase().includes(query.toLowerCase())), [query, sets]);
  return <Screen bottomNav><View style={styles.header}><View><Text style={[typography.label, { color: palette.indigo }]}>YOUR MATERIAL</Text><PageHeader title="Question library" subtitle="Everything you create, ready for a quiet study session or a friendly battle." /></View><Pressable onPress={() => router.push('/create/scan')} style={[styles.addButton, { backgroundColor: palette.indigo }]}><Ionicons name="add" size={24} color={palette.white} /></Pressable></View><View style={[styles.search, { borderColor: palette.paperMuted, backgroundColor: palette.paperRaised }]}><Ionicons name="search" size={20} color={palette.inkMuted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search sets or subjects" placeholderTextColor={palette.inkMuted} style={[styles.searchInput, { color: palette.ink }]} /></View><View style={styles.meta}><Text style={[typography.caption, { color: palette.inkMuted }]}>{filtered.length} study sets</Text><Badge tone="success">LOCAL-FIRST</Badge></View>{filtered.map((set) => <Card key={set.id} onPress={() => router.push({ pathname: '/study/[setId]', params: { setId: set.id } })} style={styles.setCard}><IconTile icon={set.questions.length ? 'book-outline' : 'document-text-outline'} tint={set.questions.length ? 'primary' : 'reward'} /><View style={styles.copy}><Text style={[typography.title, { color: palette.ink }]}>{set.title}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 3 }]}>{set.subject}</Text><Text style={[typography.caption, { color: palette.inkMuted, marginTop: 8 }]}>{set.questions.length} questions · Updated {new Date(set.updatedAt).toLocaleDateString()}</Text></View><View style={styles.trailing}><Badge tone={set.syncStatus === 'pending' ? 'reward' : 'success'}>{set.syncStatus}</Badge><Ionicons name="chevron-forward" size={18} color={palette.inkMuted} /></View></Card>)}</Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  addButton: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  search: { minHeight: 52, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  searchInput: { flex: 1, fontSize: 15 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.lg },
  setCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  copy: { flex: 1 },
  trailing: { alignItems: 'flex-end', gap: spacing.md },
});
