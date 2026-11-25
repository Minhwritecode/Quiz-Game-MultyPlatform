import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
// @ts-expect-error -- three ships ESM without bundled @types/three in this repo
import * as THREE from 'three';

export type AuthVisualMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

const MODE_PALETTES: Record<
  AuthVisualMode,
  { primary: string; secondary: string; accent: string }
> = {
  signIn: { primary: '#6366F1', secondary: '#F59E0B', accent: '#38BDF8' },
  signUp: { primary: '#10B981', secondary: '#FBBF24', accent: '#A78BFA' },
  forgot: { primary: '#06B6D4', secondary: '#EC4899', accent: '#F59E0B' },
  resetPassword: { primary: '#8B5CF6', secondary: '#F59E0B', accent: '#34D399' },
};

const PARTICLE_COUNT = 520;
const HERO_Y = 1.52;

/**
 * 3 distinct, mathematically crisp 3D Sacred Morph Targets positioned in the upper hero stage:
 * - signIn: Concentric Arcane Stargate Portal + Key Axis
 * - signUp: Ascending 5-Point Star Crown + Spiral Rays
 * - forgot / resetPassword: Double-Helix Time Hourglass + Compass Cross
 */
function buildMorphTargets() {
  const signInPos = new Float32Array(PARTICLE_COUNT * 3);
  const signUpPos = new Float32Array(PARTICLE_COUNT * 3);
  const forgotPos = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const u = i / PARTICLE_COUNT;
    const tau = u * Math.PI * 2;

    // 1. SignIn: Dual Stargate Portal Ring + Vertical Key Beam
    if (i < 420) {
      const ringRadius = i % 3 === 0 ? 1.52 : i % 3 === 1 ? 1.05 : 0.62;
      const a = (i / 420) * Math.PI * 2 * 3;
      signInPos[i * 3] = Math.cos(a) * ringRadius;
      signInPos[i * 3 + 1] = HERO_Y + Math.sin(a) * ringRadius * 0.88;
      signInPos[i * 3 + 2] = Math.sin(a * 4) * 0.28 - 1.6;
    } else {
      const k = (i - 420) / 100;
      signInPos[i * 3] = Math.sin(k * Math.PI * 6) * 0.16;
      signInPos[i * 3 + 1] = HERO_Y - 0.9 + k * 1.8;
      signInPos[i * 3 + 2] = -1.45;
    }

    // 2. SignUp: Sharp 5-Point Starburst Crown + Rising Halo
    const petals = 5;
    const starAngle = tau * 2;
    const starWave = Math.pow(0.5 + 0.5 * Math.cos(starAngle * petals), 1.6);
    const starR = 0.58 + starWave * 1.08;
    signUpPos[i * 3] = Math.cos(starAngle) * starR;
    signUpPos[i * 3 + 1] = HERO_Y + Math.sin(starAngle) * starR * 0.9;
    signUpPos[i * 3 + 2] = (starWave - 0.5) * 0.65 - 1.55;

    // 3. Forgot / Reset: Crisp DNA Double-Helix Hourglass
    const strand = i % 2 === 0 ? 1 : -1;
    const hNorm = (u - 0.5) * 2.35;
    const waistR = 0.22 + Math.pow(Math.abs(hNorm), 1.35) * 0.78;
    const helixA = u * Math.PI * 8 + (strand > 0 ? 0 : Math.PI);
    forgotPos[i * 3] = Math.cos(helixA) * waistR;
    forgotPos[i * 3 + 1] = HERO_Y + hNorm * 0.74;
    forgotPos[i * 3 + 2] = Math.sin(helixA) * waistR - 1.55;
  }

  return { signInPos, signUpPos, forgotPos };
}

function SacredMorphStage({ mode }: { mode: AuthVisualMode }) {
  const pal = MODE_PALETTES[mode];
  const pointsRef = useRef<any>(null);
  const outerGyroRef = useRef<any>(null);
  const innerGyroRef = useRef<any>(null);
  const coreMeshRef = useRef<any>(null);
  const wireShellRef = useRef<any>(null);
  const impulseRef = useRef(1.0);

  const targets = useMemo(() => buildMorphTargets(), []);
  const liveGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(targets.signInPos), 3));
    return g;
  }, [targets]);

  const primaryCol = useMemo(() => new THREE.Color(pal.primary), [pal.primary]);
  const secondaryCol = useMemo(() => new THREE.Color(pal.secondary), [pal.secondary]);

  useEffect(() => {
    impulseRef.current = 1.0;
  }, [mode]);

  useEffect(() => {
    return () => {
      liveGeo.dispose();
    };
  }, [liveGeo]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.08);
    const t = state.clock.elapsedTime;

    if (impulseRef.current > 0) {
      impulseRef.current = Math.max(0, impulseRef.current - dt * 1.45);
    }

    const goal =
      mode === 'signUp'
        ? targets.signUpPos
        : mode === 'forgot' || mode === 'resetPassword'
        ? targets.forgotPos
        : targets.signInPos;

    const posAttr = liveGeo.getAttribute('position');
    if (posAttr) {
      const arr = posAttr.array as Float32Array;
      const rate = Math.min(1, dt * 5.8);
      const waveAmp = impulseRef.current * 0.26;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const ix = i * 3;
        const swirlA = t * 4.2 + i * 0.13;
        const gx = goal[ix]! + Math.cos(swirlA) * waveAmp;
        const gy = goal[ix + 1]! + Math.sin(swirlA) * waveAmp;
        const gz = goal[ix + 2]! + Math.sin(swirlA * 0.7) * waveAmp;
        arr[ix] = arr[ix]! + (gx - arr[ix]!) * rate;
        arr[ix + 1] = arr[ix + 1]! + (gy - arr[ix + 1]!) * rate;
        arr[ix + 2] = arr[ix + 2]! + (gz - arr[ix + 2]!) * rate;
      }
      posAttr.needsUpdate = true;
    }

    if (pointsRef.current) {
      pointsRef.current.rotation.z = Math.sin(t * 0.28) * 0.09;
      pointsRef.current.rotation.y = Math.sin(t * 0.36) * 0.22;
    }

    if (outerGyroRef.current) {
      outerGyroRef.current.rotation.z += dt * (0.34 + impulseRef.current * 2.6);
      outerGyroRef.current.rotation.x =
        (mode === 'signUp' ? 0.65 : mode === 'forgot' ? 1.25 : 0.32) + Math.sin(t * 0.6) * 0.14;
      outerGyroRef.current.scale.setScalar(1 + impulseRef.current * 0.18);
    }

    if (innerGyroRef.current) {
      innerGyroRef.current.rotation.y -= dt * (0.52 + impulseRef.current * 2.8);
      innerGyroRef.current.rotation.x = -0.45 + Math.cos(t * 0.7) * 0.2;
      innerGyroRef.current.scale.setScalar(1 + impulseRef.current * 0.14);
    }

    if (coreMeshRef.current) {
      coreMeshRef.current.rotation.y += dt * (0.85 + impulseRef.current * 3.8);
      coreMeshRef.current.rotation.x += dt * 0.42;
      coreMeshRef.current.position.y = HERO_Y + Math.sin(t * 1.9) * 0.07;
      const pulse = 1 + Math.sin(t * 2.6) * 0.05 + impulseRef.current * 0.28;
      coreMeshRef.current.scale.setScalar(pulse);
    }

    if (wireShellRef.current) {
      wireShellRef.current.rotation.y -= dt * (0.45 + impulseRef.current * 1.9);
      wireShellRef.current.rotation.z += dt * 0.25;
      wireShellRef.current.position.y = HERO_Y + Math.sin(t * 1.9) * 0.07;
    }
  });

  return (
    <>
      <ambientLight intensity={0.95} color="#E0E7FF" />
      <pointLight position={[3, 4, 4]} intensity={2.8} color={secondaryCol} />
      <pointLight position={[-3.5, 1, 3]} intensity={2.4} color={primaryCol} />

      <points ref={pointsRef} geometry={liveGeo}>
        <pointsMaterial
          size={0.058}
          color={pal.secondary}
          transparent
          opacity={0.95}
          sizeAttenuation
        />
      </points>

      {/* Outer Sacred Gyroscope Ring */}
      <mesh ref={outerGyroRef} position={[0, HERO_Y, -1.65]}>
        <torusGeometry args={[1.38, 0.022, 16, 84]} />
        <meshStandardMaterial
          color={pal.primary}
          emissive={pal.primary}
          emissiveIntensity={1.35}
          metalness={0.8}
          roughness={0.15}
        />
      </mesh>

      {/* Inner Golden Gyroscope Ring */}
      <mesh ref={innerGyroRef} position={[0, HERO_Y, -1.55]}>
        <torusGeometry args={[0.92, 0.018, 16, 72]} />
        <meshStandardMaterial
          color={pal.secondary}
          emissive={pal.secondary}
          emissiveIntensity={1.45}
          metalness={0.85}
          roughness={0.15}
        />
      </mesh>

      {/* Luminous Wireframe Geodesic Shell */}
      <mesh ref={wireShellRef} position={[0, HERO_Y, -1.5]}>
        <icosahedronGeometry args={[0.64, 1]} />
        <meshBasicMaterial color={pal.accent} wireframe transparent opacity={0.32} />
      </mesh>

      {/* Mode-Specific Morphing Sacred Core */}
      <mesh ref={coreMeshRef} position={[0, HERO_Y, -1.5]}>
        {mode === 'signUp' ? (
          <icosahedronGeometry args={[0.38, 0]} />
        ) : mode === 'forgot' || mode === 'resetPassword' ? (
          <torusKnotGeometry args={[0.24, 0.075, 72, 12]} />
        ) : (
          <octahedronGeometry args={[0.4, 0]} />
        )}
        <meshStandardMaterial
          color={pal.accent}
          emissive={pal.primary}
          emissiveIntensity={1.25}
          metalness={0.55}
          roughness={0.14}
        />
      </mesh>
    </>
  );
}

export default function AuthCosmicCanvasWeb({ mode }: { mode: AuthVisualMode }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.35, 4.8], fov: 46 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <SacredMorphStage mode={mode} />
    </Canvas>
  );
}
