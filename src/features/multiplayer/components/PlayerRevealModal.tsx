import { Modal, StyleSheet, Text, View } from 'react-native';
import { Button, Card, usePalette } from '@/shared/ui';
import { radii, spacing, typography } from '@/core/theme/tokens';

interface PlayerRevealModalProps {
  visible: boolean;
  wasCorrect: boolean;
  didNotAnswer: boolean;
  pointsEarned: number;
  totalScore: number;
  rank?: number;
  explanation?: string;
  onDismiss: () => void;
}

export function PlayerRevealModal({
  visible,
  wasCorrect,
  didNotAnswer,
  pointsEarned,
  totalScore,
  rank,
  explanation,
  onDismiss,
}: PlayerRevealModalProps) {
  const palette = usePalette();

  const title = didNotAnswer
    ? 'Hết thời gian!'
    : wasCorrect
    ? 'Chính xác tuyệt đối!'
    : 'Chưa chính xác!';

  const subtitle = didNotAnswer
    ? 'Đồng hồ đếm ngược đã kết thúc trước khi bạn chọn.'
    : wasCorrect
    ? 'Bạn đã ghi điểm thần tốc trong vòng này.'
    : 'Tiếp tục rèn luyện! Vòng tiếp theo sắp bắt đầu.';

  const symbol = wasCorrect ? '✓' : didNotAnswer ? '◷' : '✦';
  const symbolColor = wasCorrect ? '#10B981' : didNotAnswer ? '#F59E0B' : '#EF4444';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Card style={styles.card}>
          <View style={[styles.symbolWrap, { backgroundColor: `${symbolColor}20`, borderColor: symbolColor }]}>
            <Text style={[styles.symbolText, { color: symbolColor }]}>{symbol}</Text>
          </View>

          <Text style={[typography.heading, { color: palette.ink, textAlign: 'center', marginTop: spacing.sm }]}>
            {title}
          </Text>

          <Text style={[typography.caption, { color: palette.inkMuted, textAlign: 'center', marginTop: 2, marginBottom: spacing.md }]}>
            {subtitle}
          </Text>

          {/* STATS ROW */}
          <View style={[styles.statsGrid, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
            <View style={styles.statItem}>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Điểm vòng này</Text>
              <Text style={[styles.statValue, { color: wasCorrect ? '#10B981' : palette.inkMuted }]}>
                {wasCorrect ? `+${pointsEarned.toLocaleString()}` : '+0'}
              </Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: palette.paperMuted }]} />

            <View style={styles.statItem}>
              <Text style={[typography.caption, { color: palette.inkMuted }]}>Tổng điểm</Text>
              <Text style={[styles.statValue, { color: palette.indigo }]}>
                {totalScore.toLocaleString()}
              </Text>
            </View>

            {rank ? (
              <>
                <View style={[styles.statDivider, { backgroundColor: palette.paperMuted }]} />
                <View style={styles.statItem}>
                  <Text style={[typography.caption, { color: palette.inkMuted }]}>Xếp hạng</Text>
                  <Text style={[styles.statValue, { color: '#F59E0B' }]}>#{rank}</Text>
                </View>
              </>
            ) : null}
          </View>

          {/* EXPLANATION */}
          {explanation ? (
            <View style={[styles.explanationBox, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
              <Text style={[typography.caption, { color: palette.indigo, fontWeight: '700', marginBottom: 2 }]}>
                💡 Giải thích kiến thức:
              </Text>
              <Text style={[typography.caption, { color: palette.ink, lineHeight: 18 }]}>
                {explanation}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionWrap}>
            <Button variant="reward" onPress={onDismiss}>
              Xem Bảng Xếp Hạng →
            </Button>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
  },
  symbolWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolText: {
    fontSize: 32,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'space-around',
    marginVertical: spacing.sm,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
  },
  explanationBox: {
    width: '100%',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.xs,
  },
  actionWrap: {
    width: '100%',
    marginTop: spacing.md,
  },
});
