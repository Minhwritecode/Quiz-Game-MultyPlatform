import { Canvas, useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// @ts-expect-error -- three ships ESM without bundled @types/three
import * as THREE from 'three';
// @ts-expect-error -- three examples loader is untyped JS
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModelDataUri } from '@/shared/modelLoader';
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

const SPELLS: Array<{ id: RpgSpellElement; label: string; color: string; glow: string; emoji: string }> = [
  { id: 'fire_arrow', label: 'Tên Lửa', color: '#F97316', glow: '#FBBF24', emoji: '🏹🔥' },
  { id: 'lightning_spear', label: 'Thương Sét', color: '#22D3EE', glow: '#818CF8', emoji: '⚡🔱' },
  { id: 'frost_meteor', label: 'Băng Tinh', color: '#38BDF8', glow: '#A78BFA', emoji: '❄️☄️' },
];

function decodeDataUri(uri: string): ArrayBuffer {
  const idx = uri.indexOf(',');
  const b64 = idx >= 0 ? uri.slice(idx + 1) : uri;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function disposeObj(root: any) {
  root?.traverse?.((child: any) => {
    child.geometry?.dispose?.();
    const mats = Array.isArray(child.material) ? child.material : child.material ? [child.material] : [];
    for (const m of mats) {
      m?.dispose?.();
    }
  });
}

function ArenaBattleScene({
  combatState,
  triggerKey = 0,
  spell,
  combo = 0,
  arenaTheme = 'colosseum',
  orbitYawRef,
}: {
  combatState: RpgCombatState;
  triggerKey: number;
  spell: RpgSpellElement;
  combo: number;
  arenaTheme: 'colosseum' | 'sanctuary' | 'library';
  orbitYawRef: React.MutableRefObject<number>;
}) {
  const worldRef = useRef<any>(null);
  const heroGroupRef = useRef<any>(null);
  const bossGroupRef = useRef<any>(null);
  const arrowGroupRef = useRef<any>(null);
  const shockRingRef = useRef<any>(null);
  const bouldersGroupRef = useRef<any>(null);
  const sparksGroupRef = useRef<any>(null);
  const impactLightRef = useRef<any>(null);

  const heroMixerRef = useRef<any>(null);
  const heroActionsRef = useRef<Map<string, any>>(new Map());
  const bossMixerRef = useRef<any>(null);
  const bossActionsRef = useRef<Map<string, any>>(new Map());

  const [heroScene, setHeroScene] = useState<any>(null);
  const [bossScene, setBossScene] = useState<any>(null);

  // Timeline 0 -> 1.35s per combat trigger
  const animProgressRef = useRef(99);
  const activeModeRef = useRef<RpgCombatState>('idle');

  const spellCfg = SPELLS.find((s) => s.id === spell) ?? SPELLS[0]!;

  // Load both Hero Archmage GLB & Boss Golem GLB onto the SAME 3D Arena Floor
  useEffect(() => {
    let mounted = true;
    let hRoot: any = null;
    let bRoot: any = null;
    const loader = new GLTFLoader();

    Promise.all([loadModelDataUri('character'), loadModelDataUri('bossGolem')])
      .then(([heroUri, bossUri]) => {
        if (!mounted) return;
        loader.parse(decodeDataUri(heroUri), '', (gltf: any) => {
          if (!mounted) {
            disposeObj(gltf.scene);
            return;
          }
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const s = 1.85 / Math.max(sz.x, sz.y, sz.z, 0.01);
          root.scale.setScalar(s);
          // Face toward the Boss on the right (+X, -Z)
          root.rotation.y = Math.PI * 0.36;
          if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            heroMixerRef.current = mixer;
            heroActionsRef.current.clear();
            for (const clip of gltf.animations) {
              heroActionsRef.current.set(clip.name, mixer.clipAction(clip));
            }
            heroActionsRef.current.get('Idle')?.play();
          }
          hRoot = root;
          setHeroScene(root);
        });

        loader.parse(decodeDataUri(bossUri), '', (gltf: any) => {
          if (!mounted) {
            disposeObj(gltf.scene);
            return;
          }
          const root = gltf.scene;
          const box = new THREE.Box3().setFromObject(root);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const s = 2.35 / Math.max(sz.x, sz.y, sz.z, 0.01);
          root.scale.setScalar(s);
          // Angle toward the hero while leaving the molten core visible to the camera.
          root.rotation.y = -Math.PI * 0.39;
          if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
            const mixer = new THREE.AnimationMixer(root);
            bossMixerRef.current = mixer;
            bossActionsRef.current.clear();
            for (const clip of gltf.animations) {
              bossActionsRef.current.set(clip.name, mixer.clipAction(clip));
            }
            bossActionsRef.current.get('Idle')?.play();
          }
          bRoot = root;
          setBossScene(root);
        });
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      heroMixerRef.current?.stopAllAction?.();
      bossMixerRef.current?.stopAllAction?.();
      disposeObj(hRoot);
      disposeObj(bRoot);
    };
  }, []);

  // Trigger synchronized GLB animations + 3D projectiles on combatState/triggerKey
  useEffect(() => {
    activeModeRef.current = combatState;
    if (combatState === 'idle') return;
    animProgressRef.current = 0;

    const playClip = (map: Map<string, any>, name: string) => {
      const act = map.get(name) ?? map.get('Idle');
      if (!act) return;
      map.forEach((a) => {
        if (a !== act) a.fadeOut(0.18);
      });
      act.reset().fadeIn(0.15).play();
    };

    if (combatState === 'player_attack') {
      playClip(heroActionsRef.current, 'Cast_Spell');
      setTimeout(() => playClip(bossActionsRef.current, 'Hit_Reaction'), 260);
      setTimeout(() => {
        playClip(heroActionsRef.current, 'Idle');
        playClip(bossActionsRef.current, 'Idle');
      }, 1150);
    } else if (combatState === 'enemy_attack') {
      playClip(bossActionsRef.current, 'Cast_Spell');
      setTimeout(() => playClip(heroActionsRef.current, 'Hit_Reaction'), 320);
      setTimeout(() => {
        playClip(bossActionsRef.current, 'Idle');
        playClip(heroActionsRef.current, 'Idle');
      }, 1250);
    } else if (combatState === 'victory') {
      playClip(heroActionsRef.current, 'Victory_Dance');
      playClip(bossActionsRef.current, 'Hit_Reaction');
    }
  }, [combatState, triggerKey]);

  const boulderOffsets = useMemo(
    () => [
      { dx: -0.28, dz: 0.16, delay: 0.0, scale: 0.34, rotSpeed: 5.5 },
      { dx: 0.24, dz: -0.18, delay: 0.07, scale: 0.29, rotSpeed: -6.2 },
      { dx: 0.0, dz: 0.26, delay: 0.12, scale: 0.38, rotSpeed: 4.8 },
      { dx: -0.34, dz: -0.22, delay: 0.16, scale: 0.26, rotSpeed: -7.1 },
      { dx: 0.32, dz: 0.12, delay: 0.20, scale: 0.31, rotSpeed: 6.4 },
    ],
    []
  );

  const sparkDirs = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return {
          vx: Math.cos(a) * (0.9 + (i % 3) * 0.4),
          vy: 0.45 + (i % 4) * 0.35,
          vz: Math.sin(a) * (0.9 + (i % 2) * 0.4),
        };
      }),
    []
  );

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.08);
    const elapsed = state.clock.elapsedTime;
    heroMixerRef.current?.update(dt);
    bossMixerRef.current?.update(dt);

    if (animProgressRef.current < 2.0) {
      animProgressRef.current += dt;
    }
    const p = animProgressRef.current;
    const mode = activeModeRef.current;

    // Gentle orbit + camera impact shake
    let shakeX = 0;
    let shakeY = 0;
    if (mode === 'player_attack' && p > 0.30 && p < 0.62) {
      const k = 1 - (p - 0.30) / 0.32;
      shakeX = Math.sin(elapsed * 65) * 0.11 * k;
      shakeY = Math.cos(elapsed * 55) * 0.08 * k;
    } else if (mode === 'enemy_attack' && p > 0.38 && p < 0.85) {
      const k = 1 - (p - 0.38) / 0.47;
      shakeX = Math.sin(elapsed * 72) * 0.16 * k;
      shakeY = Math.cos(elapsed * 62) * 0.12 * k;
    }

    if (worldRef.current) {
      worldRef.current.rotation.y += (orbitYawRef.current - worldRef.current.rotation.y) * 0.12;
      worldRef.current.position.set(shakeX, -0.82 + shakeY, 0);
    }

    // Hero & Boss base positions on the 3D Arena Floor (over-the-shoulder perspective)
    const heroBase: [number, number, number] = [-1.55, 0.04, 0.72];
    const bossBase: [number, number, number] = [1.55, 0.04, -0.68];

    if (heroGroupRef.current) {
      let hx = heroBase[0];
      let hy = heroBase[1] + Math.sin(elapsed * 2.4) * 0.03;
      let hz = heroBase[2];
      if (mode === 'player_attack' && p < 0.45) {
        const lunge = Math.sin((p / 0.45) * Math.PI);
        hx += lunge * 0.32;
        hz -= lunge * 0.16;
        hy += lunge * 0.12;
      } else if (mode === 'enemy_attack' && p > 0.36 && p < 0.95) {
        const crush = Math.sin(((p - 0.36) / 0.59) * Math.PI);
        hy -= crush * 0.24; // Buried / staggered down under boulders!
        hx -= crush * 0.18;
      }
      heroGroupRef.current.position.set(hx, hy, hz);
    }

    if (bossGroupRef.current) {
      let bx = bossBase[0];
      let by = bossBase[1] + Math.sin(elapsed * 1.9 + 1) * 0.04;
      let bz = bossBase[2];
      if (mode === 'player_attack' && p > 0.30 && p < 0.82) {
        const hit = Math.sin(((p - 0.30) / 0.52) * Math.PI);
        bx += hit * 0.38;
        bz -= hit * 0.22;
      } else if (mode === 'enemy_attack' && p < 0.45) {
        const slam = Math.sin((p / 0.45) * Math.PI);
        by += slam * 0.26;
        bx -= slam * 0.25;
      }
      bossGroupRef.current.position.set(bx, by, bz);
    }

    // 1. 3D BLAZING FIRE ARROW / SPEAR PROJECTILE (Hero -> Boss)
    if (arrowGroupRef.current) {
      if (mode === 'player_attack' && p >= 0.08 && p <= 0.36) {
        const u = (p - 0.08) / 0.28;
        arrowGroupRef.current.visible = true;
        const ax = THREE.MathUtils.lerp(heroBase[0] + 0.35, bossBase[0] - 0.15, u);
        const ay = THREE.MathUtils.lerp(1.05, 1.25, u) + Math.sin(u * Math.PI) * 0.42;
        const az = THREE.MathUtils.lerp(heroBase[2] - 0.15, bossBase[2] + 0.1, u);
        arrowGroupRef.current.position.set(ax, ay, az);
        arrowGroupRef.current.lookAt(bossBase[0], 1.25, bossBase[2]);
      } else {
        arrowGroupRef.current.visible = false;
      }
    }

    // Impact Shockwave Ring + Exploding 3D Fire Sparks on Boss!
    if (shockRingRef.current) {
      if (mode === 'player_attack' && p >= 0.32 && p <= 0.82) {
        const u = (p - 0.32) / 0.50;
        shockRingRef.current.visible = true;
        shockRingRef.current.position.set(bossBase[0] - 0.1, 1.15, bossBase[2] + 0.1);
        shockRingRef.current.scale.setScalar(0.35 + u * 2.4);
      } else {
        shockRingRef.current.visible = false;
      }
    }

    if (sparksGroupRef.current) {
      if (mode === 'player_attack' && p >= 0.32 && p <= 0.90) {
        const u = (p - 0.32) / 0.58;
        sparksGroupRef.current.visible = true;
        sparksGroupRef.current.children.forEach((child: any, idx: number) => {
          const dir = sparkDirs[idx % sparkDirs.length]!;
          child.position.set(
            bossBase[0] + dir.vx * u,
            1.15 + dir.vy * u - 1.4 * u * u,
            bossBase[2] + dir.vz * u
          );
          child.rotation.x += dt * 8;
          child.rotation.y += dt * 9;
          child.scale.setScalar(Math.max(0.01, (1 - u) * 0.14));
        });
      } else {
        sparksGroupRef.current.visible = false;
      }
    }

    // 2. 3D CRUSHING ROCK AVALANCHE / BOULDER BURIAL (Boss -> Hero!)
    if (bouldersGroupRef.current) {
      if (mode === 'enemy_attack' && p >= 0.12 && p <= 1.18) {
        bouldersGroupRef.current.visible = true;
        bouldersGroupRef.current.children.forEach((rock: any, idx: number) => {
          const cfg = boulderOffsets[idx % boulderOffsets.length]!;
          const localP = Math.max(0, p - 0.12 - cfg.delay);
          if (localP <= 0) {
            rock.visible = false;
            return;
          }
          rock.visible = true;
          const flightDur = 0.34;
          if (localP < flightDur) {
            const u = localP / flightDur;
            const rx = THREE.MathUtils.lerp(bossBase[0] - 0.3, heroBase[0] + cfg.dx, u);
            const ry = THREE.MathUtils.lerp(1.55, 0.28, u) + Math.sin(u * Math.PI) * 1.35;
            const rz = THREE.MathUtils.lerp(bossBase[2] + 0.2, heroBase[2] + cfg.dz, u);
            rock.position.set(rx, ry, rz);
            rock.rotation.x += dt * cfg.rotSpeed;
            rock.rotation.z += dt * cfg.rotSpeed;
            rock.scale.setScalar(cfg.scale);
          } else {
            // Boulders pile & settle around the buried Hero, then crumble away
            const settleU = Math.min(1, (localP - flightDur) / 0.55);
            const bounce = Math.abs(Math.sin(settleU * Math.PI * 2)) * (1 - settleU) * 0.28;
            rock.position.set(heroBase[0] + cfg.dx * 1.15, 0.22 + bounce, heroBase[2] + cfg.dz * 1.15);
            rock.scale.setScalar(cfg.scale * Math.max(0.05, 1 - settleU * 0.85));
          }
        });
      } else {
        bouldersGroupRef.current.visible = false;
      }
    }

    if (impactLightRef.current) {
      if (mode === 'player_attack' && p >= 0.28 && p <= 0.72) {
        impactLightRef.current.intensity = 5.5 * (1 - (p - 0.28) / 0.44);
        impactLightRef.current.color.set(spellCfg.color);
        impactLightRef.current.position.set(bossBase[0], 1.4, bossBase[2] + 0.4);
      } else if (mode === 'enemy_attack' && p >= 0.36 && p <= 0.88) {
        impactLightRef.current.intensity = 5.0 * (1 - (p - 0.36) / 0.52);
        impactLightRef.current.color.set('#EF4444');
        impactLightRef.current.position.set(heroBase[0], 1.2, heroBase[2] + 0.4);
      } else {
        impactLightRef.current.intensity = combo >= 3 ? 2.2 : 0.9;
        impactLightRef.current.color.set('#F59E0B');
      }
    }
  });

  const floorColor =
    arenaTheme === 'sanctuary' ? '#0D3B38' : arenaTheme === 'library' ? '#2A1842' : '#16143A';
  const ringColor =
    arenaTheme === 'sanctuary' ? '#10B981' : arenaTheme === 'library' ? '#F59E0B' : '#6366F1';

  return (
    <>
      <hemisphereLight args={['#CFDFFF', '#49384C', 0.9]} />
      <directionalLight position={[-3, 5, 5]} intensity={2.15} color="#FFEDD2" />
      <directionalLight position={[2.8, 2.4, -3.5]} intensity={1.7} color="#73CBD8" />
      <pointLight ref={impactLightRef} position={[0, 2, 1.5]} intensity={1.0} color="#F59E0B" />

      <group ref={worldRef} position={[0, -0.82, 0]}>
        {/* 3D Stylized RPG Colosseum Stone Floor + Glowing Rune Rings + Torch Pillars */}
        <mesh position={[0, -0.14, 0]}>
          <cylinderGeometry args={[3.45, 3.7, 0.28, 36]} />
          <meshStandardMaterial color={floorColor} roughness={0.48} metalness={0.22} />
        </mesh>
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.85, 3.02, 40]} />
          <meshStandardMaterial color={ringColor} emissive={ringColor} emissiveIntensity={0.55} />
        </mesh>
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.35, 1.44, 32]} />
          <meshStandardMaterial color="#C88B43" emissive="#C88B43" emissiveIntensity={0.5} />
        </mesh>

        {/* 4 Background Colosseum Torch Pillars */}
        {([-2.55, -0.88, 0.88, 2.55] as const).map((px, idx) => (
          <group key={idx} position={[px, 0, -2.35 + Math.abs(px) * 0.18]}>
            <mesh position={[0, 0.85, 0]}>
              <cylinderGeometry args={[0.16, 0.21, 1.7, 12]} />
              <meshStandardMaterial color="#272456" roughness={0.45} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.82, 0]}>
              <octahedronGeometry args={[0.15, 0]} />
              <meshStandardMaterial
                color={idx % 2 === 0 ? '#F97316' : '#22D3EE'}
                emissive={idx % 2 === 0 ? '#F97316' : '#22D3EE'}
                emissiveIntensity={2.5}
              />
            </mesh>
          </group>
        ))}

        {/* Player 3D Archmage Scholar */}
        <group ref={heroGroupRef} position={[-1.55, 0.04, 0.72]}>
          {heroScene ? <primitive object={heroScene} /> : null}
          {combo >= 2 ? (
            <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.68, 0.82, 24]} />
              <meshStandardMaterial color="#FBBF24" emissive="#F59E0B" emissiveIntensity={2.8} />
            </mesh>
          ) : null}
        </group>

        {/* Enemy 3D Obsidian Magma Boss Golem */}
        <group ref={bossGroupRef} position={[1.55, 0.04, -0.68]}>
          {bossScene ? <primitive object={bossScene} /> : null}
        </group>

        {/* 3D Blazing Fire Arrow / Lightning Spear Projectile */}
        <group ref={arrowGroupRef} visible={false}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 1.05, 10]} />
            <meshStandardMaterial color={spellCfg.glow} emissive={spellCfg.color} emissiveIntensity={3.2} />
          </mesh>
          <mesh position={[0, 0, 0.62]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.16, 0.42, 10]} />
            <meshStandardMaterial color={spellCfg.color} emissive={spellCfg.color} emissiveIntensity={4.2} />
          </mesh>
        </group>

        {/* 3D Expanding Impact Shockwave */}
        <mesh ref={shockRingRef} visible={false} rotation={[Math.PI / 3, 0.3, 0]}>
          <torusGeometry args={[0.48, 0.05, 10, 28]} />
          <meshStandardMaterial color={spellCfg.glow} emissive={spellCfg.color} emissiveIntensity={3.8} />
        </mesh>

        {/* 14 Exploding 3D Fire/Arcane Sparks */}
        <group ref={sparksGroupRef} visible={false}>
          {sparkDirs.map((_, i) => (
            <mesh key={i}>
              <octahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? spellCfg.color : '#FDE047'}
                emissive={i % 2 === 0 ? spellCfg.color : '#F59E0B'}
                emissiveIntensity={3.5}
              />
            </mesh>
          ))}
        </group>

        {/* 5 Crushing 3D Magma Boulders (Boss -> Hero Rock Burial!) */}
        <group ref={bouldersGroupRef} visible={false}>
          {boulderOffsets.map((_, i) => (
            <mesh key={i}>
              <dodecahedronGeometry args={[1, 0]} />
              <meshStandardMaterial
                color={i % 2 === 0 ? '#451A03' : '#312E81'}
                emissive="#EA580C"
                emissiveIntensity={1.25}
                roughness={0.55}
              />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}

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
  arenaTheme = 'colosseum',
  height = 228,
  reduceMotion = false,
}: RpgCombatArena3DProps) {
  const [spell, setSpell] = useState<RpgSpellElement>('fire_arrow');
  const orbitYawRef = useRef(0);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const playerPct = Math.max(0, Math.min(100, Math.round((playerHp / Math.max(1, playerMaxHp)) * 100)));
  const bossPct = Math.max(0, Math.min(100, Math.round((bossHp / Math.max(1, bossMaxHp)) * 100)));

  return (
    <View style={[styles.container, { height }]}>
      {!reduceMotion ? (
        <Model3DErrorBoundary>
          <div
            style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'pan-y' }}
            onPointerDown={(e) => {
              draggingRef.current = true;
              lastXRef.current = e.clientX;
            }}
            onPointerMove={(e) => {
              if (!draggingRef.current) return;
              const dx = e.clientX - lastXRef.current;
              lastXRef.current = e.clientX;
              orbitYawRef.current = Math.max(-0.65, Math.min(0.65, orbitYawRef.current + dx * 0.008));
            }}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerCancel={() => {
              draggingRef.current = false;
            }}
          >
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0.95, 4.35], fov: 44 }}
              gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
              style={{ width: '100%', height: '100%', background: 'transparent' }}
            >
              <ArenaBattleScene
                combatState={combatState}
                triggerKey={triggerKey}
                spell={spell}
                combo={combo}
                arenaTheme={arenaTheme}
                orbitYawRef={orbitYawRef}
              />
            </Canvas>
          </div>
        </Model3DErrorBoundary>
      ) : null}

      {/* Top Versus RPG HUD */}
      <View style={styles.hudTop} pointerEvents="none">
        <View style={styles.fighterHud}>
          <Text style={styles.fighterName} numberOfLines={1}>
            🧙‍♂️ {playerLabel}
          </Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${playerPct}%`, backgroundColor: '#10B981' }]} />
          </View>
        </View>

        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>{combo >= 2 ? `🔥 x${combo}` : 'VS'}</Text>
        </View>

        <View style={[styles.fighterHud, { alignItems: 'flex-end' }]}>
          <Text style={[styles.fighterName, { color: '#FCA5A5' }]} numberOfLines={1}>
            {bossLabel} 👹
          </Text>
          <View style={styles.hpTrack}>
            <View style={[styles.hpFill, { width: `${bossPct}%`, backgroundColor: '#EF4444' }]} />
          </View>
        </View>
      </View>

      {/* Dynamic Combat Callout Banner */}
      {combatState === 'player_attack' ? (
        <View style={[styles.calloutPill, { backgroundColor: 'rgba(16, 185, 129, 0.88)' }]} pointerEvents="none">
          <Text style={styles.calloutText}>🏹 BẮN TRÚNG ĐÍCH! CHÍ MẠNG 🔥</Text>
        </View>
      ) : combatState === 'enemy_attack' ? (
        <View style={[styles.calloutPill, { backgroundColor: 'rgba(220, 38, 38, 0.90)' }]} pointerEvents="none">
          <Text style={styles.calloutText}>🪨 GOLEM HẤT ĐÁ CHÔN VÙI! ĐỠ ĐÒN!</Text>
        </View>
      ) : null}

      {/* Bottom Interactive Spell/Weapon Selector */}
      <View style={styles.weaponRow}>
        {SPELLS.map((s) => {
          const active = spell === s.id;
          return (
            <Pressable
              key={s.id}
              accessibilityRole="button"
              onPress={() => setSpell(s.id)}
              style={[
                styles.weaponChip,
                active && { backgroundColor: 'rgba(251, 191, 36, 0.25)', borderColor: '#FBBF24' },
              ]}
            >
              <Text style={styles.weaponText}>
                {s.emoji} {s.label}
              </Text>
            </Pressable>
          );
        })}
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
  hudTop: {
    position: 'absolute',
    top: 8,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fighterHud: {
    flex: 1,
    gap: 3,
  },
  fighterName: {
    color: '#E0E7FF',
    fontSize: 11,
    fontWeight: '800',
  },
  hpTrack: {
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  hpFill: {
    height: '100%',
    borderRadius: 4,
  },
  vsBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.24)',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  vsText: {
    color: '#FDE68A',
    fontSize: 11,
    fontWeight: '900',
  },
  calloutPill: {
    position: 'absolute',
    top: 44,
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  calloutText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  weaponRow: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  weaponChip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.28)',
  },
  weaponText: {
    color: '#F8FAFC',
    fontSize: 10.5,
    fontWeight: '800',
  },
});
