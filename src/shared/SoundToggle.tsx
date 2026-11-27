import { useState } from 'react';
import { AppIcon } from '@/shared/AppIcon';
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
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: !isMuted ? palette.mintTint : palette.paperRaised,
          borderColor: !isMuted ? palette.mint : palette.paperMuted,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <AppIcon
        name={!isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
        size={14}
        color={!isMuted ? palette.mint : palette.inkMuted}
      />
      <Text
        style={[
          typography.caption,
          {
            fontWeight: '800',
            color: !isMuted ? palette.mint : palette.inkMuted,
          },
        ]}
      >
        {!isMuted ? 'BGM' : 'Mute'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
});
