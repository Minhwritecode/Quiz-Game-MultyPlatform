import { useState } from 'react';
import { AppIcon } from '@/shared/AppIcon';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useMembershipStore } from '../state/useMembershipStore';
import { radii, spacing, typography } from '@/core/theme/tokens';
import { usePalette } from '@/shared/ui';
import { VipCheckoutModal } from './VipCheckoutModal';

export function VipBadge() {
  const palette = usePalette();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const tier = useMembershipStore((state) => state.tier);
  const privileges = useMembershipStore((state) => state.getPrivileges());
  const isVip = tier === 'archmage';

  return (
    <>
      <Pressable
        onPress={() => setCheckoutOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Gói thành viên: ${privileges.title}`}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: isVip ? palette.goldTint : palette.paperRaised,
            borderColor: isVip ? palette.gold : palette.paperMuted,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <AppIcon
          name={isVip ? 'diamond' : 'sparkles-outline'}
          size={13}
          color={isVip ? palette.gold : palette.indigo}
        />
        <Text
          style={[
            typography.caption,
            { color: isVip ? palette.gold : palette.ink, fontWeight: '800' },
          ]}
        >
          {isVip ? 'PRO' : 'Free · Nâng cấp'}
        </Text>
      </Pressable>

      <VipCheckoutModal visible={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </>
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
