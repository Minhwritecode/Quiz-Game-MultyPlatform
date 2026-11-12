import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/core/theme/tokens';

/** Lightweight illustration used by native apps and by the web fallback. */
export default function PapyrusScene({ reduceMotion = false }: { reduceMotion?: boolean }) {
  return (
    <View style={styles.stage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.glow, reduceMotion && styles.glowStill]} />
      <View style={[styles.sheet, styles.sheetBack]}><View style={styles.rule} /><View style={styles.rule} /><View style={styles.rule} /></View>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}><Ionicons name="sparkles" size={16} color={colors.indigo} /><Text style={styles.sheetLabel}>STUDY NOTES</Text></View>
        <Text style={styles.question}>What helps ideas stick?</Text>
        <View style={styles.answer}><Ionicons name="checkmark-circle" size={17} color={colors.mint} /><Text style={styles.answerText}>Active recall</Text></View>
        <View style={styles.answerMuted}><View style={styles.dot} /><Text style={styles.mutedText}>Review over time</Text></View>
      </View>
      <View style={styles.stamp}><Ionicons name="flash" size={18} color={colors.white} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  glow: { position: 'absolute', width: 210, height: 210, borderRadius: 110, backgroundColor: '#6D64F0', opacity: 0.45, transform: [{ scale: 1.12 }] },
  glowStill: { transform: [{ scale: 1 }] },
  sheet: { width: 230, minHeight: 182, padding: spacing.lg, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E0E7FF', transform: [{ rotate: '-4deg' }], shadowColor: '#18134A', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 7 },
  sheetBack: { position: 'absolute', backgroundColor: '#E0E7FF', transform: [{ rotate: '7deg' }, { translateX: 18 }, { translateY: 10 }], opacity: 0.8, minHeight: 164 },
  rule: { height: 1, backgroundColor: '#E2E8F0', marginTop: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sheetLabel: { ...typography.label, color: colors.indigo, fontSize: 10 },
  question: { ...typography.title, color: colors.ink, marginTop: spacing.lg },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, padding: 10, backgroundColor: '#ECFDF5', borderRadius: 10 },
  answerText: { ...typography.caption, fontWeight: '700', color: '#065F46' },
  answerMuted: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, paddingHorizontal: 10 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#CBD5E1' },
  mutedText: { ...typography.caption, color: '#64748B' },
  stamp: { position: 'absolute', right: '12%', top: '13%', width: 44, height: 44, borderRadius: 15, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '9deg' }] },
});
