import { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from '@/shared/ui';

const REACTIONS = ['🔥', '🎉', '👏', '🤯', '⚡'] as const;

interface FloatingEmoji {
  id: number;
  emoji: string;
  leftPct: number;
  translateY: Animated.Value;
  opacity: Animated.Value;
}

export function LiveReactionsBar({ label = 'Cảm xúc trực tiếp' }: { label?: string }) {
  const palette = usePalette();
  const [floaters, setFloaters] = useState<FloatingEmoji[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const nextId = useRef(1);

  const triggerReaction = (emoji: string) => {
    const id = nextId.current++;
    const translateY = new Animated.Value(0);
    const opacity = new Animated.Value(1);
    const leftPct = 15 + ((id * 23) % 70);

    setCounts((prev) => ({ ...prev, [emoji]: (prev[emoji] ?? 0) + 1 }));
    setFloaters((prev) => [...prev.slice(-10), { id, emoji, leftPct, translateY, opacity }]);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -96,
        duration: 1100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 1100,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFloaters((prev) => prev.filter((item) => item.id !== id));
    });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: palette.paperRaised, borderColor: palette.paperMuted }]}>
      <View pointerEvents="none" style={styles.floatLayer}>
        {floaters.map((item) => (
          <Animated.Text
            key={item.id}
            style={[
              styles.floater,
              {
                left: `${item.leftPct}%`,
                opacity: item.opacity,
                transform: [{ translateY: item.translateY }],
              },
            ]}
          >
            {item.emoji}
          </Animated.Text>
        ))}
      </View>

      <Text style={[typography.caption, { color: palette.inkMuted, fontWeight: '700', marginBottom: spacing.xs }]}>
        {label}
      </Text>
      <View style={styles.row}>
        {REACTIONS.map((emoji) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`Gửi cảm xúc ${emoji}`}
            onPress={() => triggerReaction(emoji)}
            style={({ pressed }) => [
              styles.emojiBtn,
              {
                backgroundColor: palette.paper,
                borderColor: palette.paperMuted,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
            {(counts[emoji] ?? 0) > 0 ? (
              <Text style={[styles.countText, { color: palette.indigo }]}>{counts[emoji]}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    position: 'relative',
    overflow: 'visible',
  },
  floatLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    height: 110,
    zIndex: 20,
  },
  floater: {
    position: 'absolute',
    bottom: 0,
    fontSize: 26,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  emojiBtn: {
    flex: 1,
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  emoji: { fontSize: 18 },
  countText: { fontSize: 12, fontWeight: '800' },
});
