import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Model3DView } from '@/shared/Model3DView';
import { Model3DErrorBoundary } from '@/shared/Model3DErrorBoundary';
import { radii } from '@/core/theme/tokens';

export type RpgCombatState = 'idle' | 'player_attack' | 'enemy_attack' | 'victory';
export type RpgSpellElement = 'fire_arrow' | 'lightning_spear' | 'frost_meteor';

export interface RpgCombatArena3DProps {
  combatState: RpgCombatState;
  combo?: number;
  triggerKey?: number;
  playerHp?: number;
  playerMaxHp?: number;
  bossHp?: number;
  bossMaxHp?: number;
  playerLabel?: string;
  bossLabel?: string;
  arenaTheme?: 'colosseum' | 'sanctuary' | 'library';
  height?: number;
  reduceMotion?: boolean;
}

const SPELLS: Array<{ id: RpgSpellElement; label: string; emoji: string }> = [
  { id: 'fire_arrow', label: 'Tên Lửa', emoji: '🏹🔥' },
  { id: 'lightning_spear', label: 'Thương Sét', emoji: '⚡🔱' },
  { id: 'frost_meteor', label: 'Băng Tinh', emoji: '❄️☄️' },
];

export const RpgCombatArena3D = memo(function RpgCombatArena3D({
  combatState,
  combo = 0,
  triggerKey = 0,
  playerHp = 3,
  playerMaxHp = 3,
  bossHp = 100,
  bossMaxHp = 100,
  playerLabel = 'Đại Pháp Sư (Bạn)',
  bossLabel = 'Golem Hắc Thạch',
  height = 228,
}: RpgCombatArena3DProps) {
  const [spell, setSpell] = useState<RpgSpellElement>('fire_arrow');
  const projAnim = useRef(new Animated.Value(0)).current;
  const rockAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (combatState === 'player_attack') {
      projAnim.setValue(0);
      Animated.timing(projAnim, { toValue: 1, duration: 480, useNativeDriver: true }).start();
    } else if (combatState === 'enemy_attack') {
      rockAnim.setValue(0);
      Animated.timing(rockAnim, { toValue: 1, duration: 620, useNativeDriver: true }).start();
    }
  }, [combatState, triggerKey, projAnim, rockAnim]);

  const playerPct = Math.max(0, Math.min(100, Math.round((playerHp / Math.max(1, playerMaxHp)) * 100)));
  const bossPct = Math.max(0, Math.min(100, Math.round((bossHp / Math.max(1, bossMaxHp)) * 100)));

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.stageRow}>
        <View style={{ flex: 1 }}>
          <Model3DErrorBoundary>
            <Model3DView
              model="character"
              height={height - 32}
              autoRotate={false}
              animationName={
                combatState === 'player_attack'
                  ? 'Cast_Spell'
                  : combatState === 'enemy_attack'
                  ? 'Hit_Reaction'
                  : combatState === 'victory'
                  ? 'Victory_Dance'
                  : 'Idle'
              }
              style={{ borderWidth: 0, backgroundColor: 'transparent' }}
            />
          </Model3DErrorBoundary>
        </View>
        <View style={{ flex: 1 }}>
          <Model3DErrorBoundary>
            <Model3DView
              model="bossGolem"
              height={height - 32}
              autoRotate={false}
              animationName={
                combatState === 'enemy_attack'
                  ? 'Cast_Spell'
                  : combatState === 'player_attack'
                  ? 'Hit_Reaction'
                  : 'Idle'
              }
              style={{ borderWidth: 0, backgroundColor: 'transparent' }}
            />
          </Model3DErrorBoundary>
        </View>
      </View>

      {combatState === 'player_attack' ? (
        <Animated.Text
          style={{
            position: 'absolute',
            top: '44%',
            left: '22%',
            fontSize: 28,
            transform: [
              { translateX: projAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 150] }) },
              { scale: projAnim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0.8, 1.35, 1.6] }) },
            ],
          }}
        >
          {spell === 'fire_arrow' ? '🏹🔥' : spell === 'lightning_spear' ? '⚡🔱' : '❄️☄️'}
        </Animated.Text>
      ) : null}

      {combatState === 'enemy_attack' ? (
        <Animated.Text
          style={{
            position: 'absolute',
            top: '18%',
            left: '16%',
            fontSize: 30,
            transform: [
              { translateY: rockAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 82] }) },
            ],
          }}
        >
          🪨🪨💥
        </Animated.Text>
      ) : null}

      <View style={styles.hudTop} pointerEvents="none">
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.fighterName} numberOfLines={1}>🧙‍♂️ {playerLabel}</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${playerPct}%`, backgroundColor: '#10B981' }]} />
          </View>
        </View>
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>{combo >= 2 ? `🔥 x${combo}` : 'VS'}</Text>
        </View>
        <View style={{ flex: 1, gap: 3, alignItems: 'flex-end' }}>
          <Text style={[styles.fighterName, { color: '#FCA5A5' }]} numberOfLines={1}>{bossLabel} 👹</Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${bossPct}%`, backgroundColor: '#EF4444' }]} />
          </View>
        </View>
      </View>

      <View style={styles.weaponRow}>
        {SPELLS.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setSpell(s.id)}
            style={[
              styles.weaponChip,
              spell === s.id && { backgroundColor: 'rgba(251, 191, 36, 0.25)', borderColor: '#FBBF24' },
            ]}
          >
            <Text style={styles.weaponText}>{s.emoji} {s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#0B0F2E',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.38)',
    position: 'relative',
    marginBottom: 12,
  },
  stageRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 22,
  },
  hudTop: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fighterName: { color: '#E0E7FF', fontSize: 11, fontWeight: '800' },
  hpTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    overflow: 'hidden',
  },
  hpFill: { height: '100%', borderRadius: 4 },
  vsBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.24)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  vsText: { color: '#FDE68A', fontSize: 11, fontWeight: '900' },
  weaponRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  weaponChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.28)',
  },
  weaponText: { color: '#F8FAFC', fontSize: 10.5, fontWeight: '800' },
});
