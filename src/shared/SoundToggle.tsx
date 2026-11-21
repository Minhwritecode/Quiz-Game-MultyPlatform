import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { sfx } from '@/core/audio/sfx';
import { usePapyrusStore } from '@/core/state/usePapyrusStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from './ui';

export function SoundToggle() {
  const palette = usePalette();
  const bgmMuted = usePapyrusStore((state) => state.bgmMuted);
  const toggleBgmMuted = usePapyrusStore((state) => state.toggleBgmMuted);
  const [, setTrigger] = useState(0);

  const handleToggle = () => {
    toggleBgmMuted();
    const isPlaying = sfx.toggleBGM();
    setTrigger((prev) => prev + 1);
    if (!isPlaying) {
      sfx.stopBGM();
    }
  };

  const isMuted = bgmMuted;

  return (
    <Pressable
      onPress={handleToggle}
      accessibilityRole="button"
      accessibilityLabel={isMuted ? 'Bật âm thanh và nhạc nền' : 'Tắt âm thanh'}
      style={[
        styles.pill,
        {
          backgroundColor: !isMuted ? 'rgba(16, 185, 129, 0.15)' : palette.paperRaised,
          borderColor: !isMuted ? '#10B981' : palette.paperMuted,
        },
      ]}
    >
      <Text style={[typography.caption, { fontWeight: '700' }]}>
        {!isMuted ? '🔊 BGM' : '🔇 Mute'}
      </Text>
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
