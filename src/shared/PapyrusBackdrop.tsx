import { memo, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Pattern, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Subtle Warm Paper / Dark Obsidian editorial backdrop rendered behind `<Screen>`:
 * - Ambient warm copper & lapis radial washes for depth without visual noise.
 * - Crisp SVG dot-grid + micro paper flecks across open canvas while keeping Cards smooth.
 * - Minimalist corner astrolabe & scroll geometry watermark for Papyrus brand character.
 */
export const PapyrusBackdrop = memo(function PapyrusBackdrop({ isDark }: { isDark: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const dotPatternId = `papyrus-dot-${uid}`;
  const copperGlowId = `papyrus-copper-${uid}`;
  const lapisGlowId = `papyrus-lapis-${uid}`;

  const dotPrimary = isDark ? '#9BB1DA' : '#7C6543';
  const dotSecondary = isDark ? '#F5B73B' : '#9A5804';
  const ringStroke = isDark ? '#F5B73B' : '#9A5804';
  const folioStroke = isDark ? '#7BA4FF' : '#1C3F94';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden={true}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={copperGlowId} cx="84%" cy="6%" r="58%">
            <Stop offset="0%" stopColor={isDark ? '#F5B73B' : '#C9841A'} stopOpacity={isDark ? 0.11 : 0.14} />
            <Stop offset="55%" stopColor={isDark ? '#F5B73B' : '#C9841A'} stopOpacity={isDark ? 0.03 : 0.05} />
            <Stop offset="100%" stopColor={isDark ? '#F5B73B' : '#C9841A'} stopOpacity={0} />
          </RadialGradient>

          <RadialGradient id={lapisGlowId} cx="12%" cy="88%" r="60%">
            <Stop offset="0%" stopColor={isDark ? '#4F7DF0' : '#1C3F94'} stopOpacity={isDark ? 0.13 : 0.09} />
            <Stop offset="58%" stopColor={isDark ? '#4F7DF0' : '#1C3F94'} stopOpacity={isDark ? 0.04 : 0.03} />
            <Stop offset="100%" stopColor={isDark ? '#4F7DF0' : '#1C3F94'} stopOpacity={0} />
          </RadialGradient>

          <Pattern id={dotPatternId} width="22" height="22" patternUnits="userSpaceOnUse">
            <Circle cx="11" cy="11" r="1.05" fill={dotPrimary} fillOpacity={isDark ? 0.11 : 0.17} />
            <Circle cx="3" cy="19" r="0.55" fill={dotSecondary} fillOpacity={isDark ? 0.06 : 0.09} />
          </Pattern>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${dotPatternId})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${copperGlowId})`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${lapisGlowId})`} />
      </Svg>

      {/* Top-right subtle scholarly astrolabe watermark */}
      <View style={styles.topWatermark}>
        <Svg width={270} height={270} viewBox="0 0 270 270">
          <Circle
            cx="150"
            cy="120"
            r="108"
            stroke={ringStroke}
            strokeWidth={1}
            strokeOpacity={isDark ? 0.1 : 0.12}
            strokeDasharray="4 6"
            fill="none"
          />
          <Circle
            cx="150"
            cy="120"
            r="74"
            stroke={ringStroke}
            strokeWidth={1}
            strokeOpacity={isDark ? 0.08 : 0.09}
            fill="none"
          />
          <Line
            x1="56"
            y1="214"
            x2="244"
            y2="26"
            stroke={ringStroke}
            strokeWidth={1}
            strokeOpacity={isDark ? 0.07 : 0.08}
          />
          <Path
            d="M150 38 L156 46 L150 54 L144 46 Z"
            fill={ringStroke}
            fillOpacity={isDark ? 0.11 : 0.12}
          />
        </Svg>
      </View>

      {/* Bottom-left subtle bound-scroll watermark */}
      <View style={styles.bottomWatermark}>
        <Svg width={220} height={220} viewBox="0 0 220 220">
          <Circle
            cx="84"
            cy="136"
            r="88"
            stroke={folioStroke}
            strokeWidth={1}
            strokeOpacity={isDark ? 0.1 : 0.08}
            fill="none"
          />
          <Circle
            cx="84"
            cy="136"
            r="58"
            stroke={folioStroke}
            strokeWidth={1}
            strokeOpacity={isDark ? 0.07 : 0.06}
            strokeDasharray="3 5"
            fill="none"
          />
        </Svg>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  topWatermark: {
    position: 'absolute',
    top: -42,
    right: -52,
  },
  bottomWatermark: {
    position: 'absolute',
    bottom: 24,
    left: -58,
  },
});
