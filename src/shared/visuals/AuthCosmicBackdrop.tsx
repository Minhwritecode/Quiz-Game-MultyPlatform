import { memo } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

const AMBIENT_COLORS: Record<string, { top: string; bottom: string }> = {
  signIn: { top: 'rgba(99, 102, 241, 0.22)', bottom: 'rgba(56, 189, 248, 0.14)' },
  signUp: { top: 'rgba(16, 185, 129, 0.20)', bottom: 'rgba(99, 102, 241, 0.15)' },
  forgot: { top: 'rgba(56, 189, 248, 0.22)', bottom: 'rgba(129, 140, 248, 0.14)' },
  resetPassword: { top: 'rgba(168, 85, 247, 0.22)', bottom: 'rgba(99, 102, 241, 0.14)' },
  twoFactor: { top: 'rgba(245, 158, 11, 0.20)', bottom: 'rgba(99, 102, 241, 0.14)' },
};

/**
 * Calm, minimalist, distraction-free ambient aurora backdrop behind the centered Auth Modal.
 */
export const AuthCosmicBackdrop = memo(function AuthCosmicBackdrop({
  mode = 'signIn',
}: {
  mode?: string;
  reduceMotion?: boolean;
}) {
  const glow = AMBIENT_COLORS[mode] ?? AMBIENT_COLORS.signIn!;

  return (
    <View pointerEvents="none" style={styles.root}>
      <View
        style={[
          styles.orbTop,
          { backgroundColor: glow.top },
          Platform.OS === 'web'
            ? ({
                filter: 'blur(90px)',
                transition: 'background-color 520ms ease',
              } as unknown as ViewStyle)
            : undefined,
        ]}
      />
      <View
        style={[
          styles.orbBottom,
          { backgroundColor: glow.bottom },
          Platform.OS === 'web'
            ? ({
                filter: 'blur(100px)',
                transition: 'background-color 520ms ease',
              } as unknown as ViewStyle)
            : undefined,
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#050818',
    overflow: 'hidden',
  },
  orbTop: {
    position: 'absolute',
    top: -110,
    left: '12%',
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  orbBottom: {
    position: 'absolute',
    bottom: -120,
    right: '8%',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
});
