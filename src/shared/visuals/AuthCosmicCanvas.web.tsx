import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
// @ts-expect-error -- three ships ESM without bundled @types/three in this repo
import * as THREE from 'three';

export type AuthVisualMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

const MODE_COLORS: Record<AuthVisualMode, { primary: string; secondary: string; accent: string }> = {
  signIn: { primary: '#6366F1', secondary: '#F59E0B', accent: '#38BDF8' },
  signUp: { primary: '#10B981', secondary: '#FBBF24', accent: '#A78BFA' },
  forgot: { primary: '#06B6D4', secondary: '#EC4899', accent: '#F59E0B' },
  resetPassword: { primary: '#8B5CF6', secondary: '#F59E0B', accent: '#34D399' },
};

const PARTICLE_COUNT = 320;

/**
 * Generates 3 distinct 3D Sacred Constellation Shapes for seamless vertex morphing:
 * - signIn: Arcane Portal Ring + Keyhole Shield
 * - signUp: Ascending 5-Point Star Crown
 * - forgot / resetPassword: Cosmic Time Hourglass Spiral
 */
function buildConstellationTargets() {
  const signInPos = new Float32Array(PARTICLE_COUNT * 3);
  const signUpPos = new Float32Array(PARTICLE_COUNT * 3);
  const forgotPos = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const u = i / PARTICLE_COUNT;
    const angle = u * Math.PI * 2 * 5;

    // 1. SignIn: Dual Portal Ring
    const r1 = i % 2 === 0 ? 2.35 : 1.55;
    const a1 = u * Math.PI * 2;
    signInPos[i * 3] = Math.cos(a1) * r1;
    signInPos[i * 3 + 1] = Math.sin(a1) * r1 + 0.35;
    signInPos[i * 3 + 2] = Math.sin(a1 * 3) * 0.45 - 2.3;

    // 2. SignUp: 5-Point Ascending Starburst Crown
    const starA = u * Math.PI * 2;
    const starMod = 1.55 + 0.85 * Math.cos(starA * 5);
    signUpPos[i * 3] = Math.cos(starA) * starMod;
    signUpPos[i * 3 + 1] = Math.sin(starA) * starMod + 0.42;
    signUpPos[i * 3 + 2] = Math.cos(starA * 5) * 0.55 - 2.2;

    // 3. Forgot / Reset: Double-Cone Cosmic Hourglass Helix
    const yNorm = (u - 0.5) * 3.6;
    const hourglassR = 0.28 + Math.abs(yNorm) * 0.92;
    forgotPos[i * 3] = Math.cos(angle * 2) * hourglassR;
    forgotPos[i * 3 + 1] = yNorm + 0.35;
    forgotPos[i * 3 + 2] = Math.sin(angle * 2) * hourglassR - 2.3;
  }

  return { signInPos, signUpPos, forgotPos };
}

function MorphingCosmicField({ mode }: { mode: AuthVisualMode }) {
  const palette = MODE_COLORS[mode];
  const outerRingRef = useRef<any>(null);
  const innerRingRef = useRef<any>(null);
  const coreGroupRef = useRef<any>(null);
  const pointsRef = useRef<any>(null);
  const burstRef = useRef(1.0);

  const targets = useMemo(() => buildConstellationTargets(), []);
  const liveGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targets.signInPos), 3));
    return geo;
  }, [targets]);

  useEffect(() => {
    // Trigger an energetic morph impulse whenever the user switches Login <-> SignUp <-> Forgot!
    burstRef.current = 1.0;
  }, [mode]);

  useEffect(() => {
    return () => {
      liveGeometry.dispose();
    };
  }, [liveGeometry]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.08);
    const t = state.clock.elapsedTime;

    if (burstRef.current > 0) {
      burstRef.current = Math.max(0, burstRef.current - dt * 1.6);
    }

    const goal =
      mode === 'signUp'
        ? targets.signUpPos
        : mode === 'forgot' || mode === 'resetPassword'
        ? targets.forgotPos
        : targets.signInPos;

    // Smooth GPU-friendly spring interpolation of all 320 3D constellation vertices
    const posAttr = liveGeometry.getAttribute('position');
    if (posAttr) {
      const arr = posAttr.array as Float32Array;
      const lerpRate = Math.min(1, dt * 5.2);
      const swirl = burstRef.current * 0.38;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const gx = goal[ix]! + Math.sin(t * 3 + i) * swirl;
        const gy = goal[ix + 1]! + Math.cos(t * 2.5 + i) * swirl;
        const gz = goal[ix + 2]!;
        arr[ix] = arr[ix]! + (gx - arr[ix]!) * lerpRate;
        arr[ix + 1] = arr[ix + 1]! + (gy - arr[ix + 1]!) * lerpRate;
        arr[ix + 2] = arr[ix + 2]! + (gz - arr[ix + 2]!) * lerpRate;
      }
      posAttr.needsUpdate = true;
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.z = Math.sin(t * 0.25) * 0.14;
      pointsRef.current.rotation.y = Math.cos(t * 0.3) * 0.18;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += dt * (0.28 + burstRef.current * 2.2);
      outerRingRef.current.rotation.x = (mode === 'signUp' ? 0.95 : mode === 'forgot' ? 1.35 : 0.48) + Math.sin(t * 0.5) * 0.12;
      const s = 1 + burstRef.current * 0.22;
      outerRingRef.current.scale.setScalar(s);
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.y -= dt * (0.42 + burstRef.current * 2.5);
      innerRingRef.current.rotation.z = -0.35 + Math.cos(t * 0.6) * 0.18;
    }

    if (coreGroupRef.current) {
      coreGroupRef.current.rotation.y += dt * (0.65 + burstRef.current * 3.4);
      coreGroupRef.current.rotation.x += dt * 0.35;
      coreGroupRef.current.position.y = 1.62 + Math.sin(t * 1.6) * 0.14;
      const cs = 1 + burstRef.current * 0.35;
      coreGroupRef.current.scale.set(
        mode === 'forgot' ? cs * 0.8 : cs,
        mode === 'forgot' ? cs * 1.35 : mode === 'signUp' ? cs * 1.18 : cs,
        cs
      );
    }
  });

  return (
    <>
      <ambientLight intensity={0.85} color="#E0E7FF" />
      <pointLight position={[3, 4, 4]} intensity={2.4} color={palette.secondary} />
      <pointLight position={[-4, -2, 2]} intensity={2.0} color={palette.primary} />
      <pointLight position={[0, 2, -2]} intensity={1.6} color={palette.accent} />

      <points ref={pointsRef} geometry={liveGeometry}>
        <pointsMaterial size={0.085} color={palette.secondary} transparent opacity={0.92} sizeAttenuation />
      </points>

      <mesh ref={outerRingRef} position={[0, 0.45, -2.7]}>
        <torusGeometry args={[2.45, 0.032, 16, 72]} />
        <meshStandardMaterial
          color={palette.primary}
          emissive={palette.primary}
          emissiveIntensity={1.15}
          metalness={0.75}
          roughness={0.18}
        />
      </mesh>

      <mesh ref={innerRingRef} position={[0, 0.45, -2.45]}>
        <torusGeometry args={[1.68, 0.025, 16, 64]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={1.3}
          metalness={0.85}
          roughness={0.18}
        />
      </mesh>

      {/* Morphing Sacred Core Emblem above Brand Mark */}
      <group ref={coreGroupRef} position={[0, 1.62, -2.0]}>
        <mesh>
          {mode === 'signUp' ? (
            <icosahedronGeometry args={[0.44, 0]} />
          ) : mode === 'forgot' || mode === 'resetPassword' ? (
            <torusKnotGeometry args={[0.28, 0.085, 64, 12]} />
          ) : (
            <octahedronGeometry args={[0.44, 0]} />
          )}
          <meshStandardMaterial
            color={palette.accent}
            emissive={palette.primary}
            emissiveIntensity={1.15}
            metalness={0.45}
            roughness={0.16}
          />
        </mesh>
      </group>
    </>
  );
}

export default function AuthCosmicCanvasWeb({ mode }: { mode: AuthVisualMode }) {
  return (
    <Canvas
      dpr={[1, 1.4]}
      camera={{ position: [0, 0, 5.2], fov: 46 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <MorphingCosmicField mode={mode} />
    </Canvas>
  );
}
