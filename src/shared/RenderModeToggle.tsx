import { Pressable, StyleSheet, Text } from 'react-native';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from './ui';

interface RenderModeToggleProps {
  compact?: boolean;
}

export function RenderModeToggle({ compact = false }: RenderModeToggleProps) {
  const palette = usePalette();
  const render3DMode = usePapyrusStore((state) => state.render3DMode);
  const toggleRender3DMode = usePapyrusStore((state) => state.toggleRender3DMode);

  return (
    <Pressable
      onPress={toggleRender3DMode}
      accessibilityRole="button"
      accessibilityLabel={render3DMode ? 'Đổi sang chế độ 2D' : 'Đổi sang chế độ 3D'}
      style={[
        styles.pill,
        {
          backgroundColor: render3DMode ? 'rgba(79, 70, 229, 0.15)' : palette.paperRaised,
          borderColor: render3DMode ? '#6366F1' : palette.paperMuted,
        },
      ]}
    >
      <Text style={[typography.caption, { color: render3DMode ? '#6366F1' : palette.ink, fontWeight: '700' }]}>
        {render3DMode ? '🔮 3D' : '🎭 2D'}
      </Text>
      {!compact && (
        <Text style={[typography.caption, { color: palette.inkMuted, fontSize: 11, marginLeft: 3 }]}>
          {render3DMode ? 'Realm' : 'Lite'}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
