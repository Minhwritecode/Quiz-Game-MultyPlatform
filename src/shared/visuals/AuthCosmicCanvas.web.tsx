import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
// @ts-expect-error -- three ships ESM without bundled @types/three in this repo
import * as THREE from 'three';

export type AuthVisualMode = 'signIn' | 'signUp' | 'forgot' | 'resetPassword';

const MODE_COLORS: Record<AuthVisualMode, { primary: string; secondary: string; accent: string }> = {
  signIn: { primary: '#6366F1', secondary: '#F59E0B', accent: '#38BDF8' },
  signUp: { primary: '#10B981', secondary: '#FBBF24', accent: '#818CF8' },
  forgot: { primary: '#06B6D4', secondary: '#A78BFA', accent: '#F59E0B' },
  resetPassword: { primary: '#8B5CF6', secondary: '#F59E0B', accent: '#34D399' },
};

function CosmicField({ mode }: { mode: AuthVisualMode }) {
  const palette = MODE_COLORS[mode];
  const outerRingRef = useRef<any>(null);
  const innerRingRef = useRef<any>(null);
  const crystalRef = useRef<any>(null);
  const starsRef = useRef<any>(null);

  const starGeometry = useMemo(() => {
    const count = 130;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.6 + (i % 13) * 0.42;
      const theta = i * 2.3999632; // golden angle distribution
      const y = ((i % 19) - 9) * 0.45;
      positions[i * 3] = Math.cos(theta) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * r - 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => {
    return () => {
      starGeometry.dispose();
    };
  }, [starGeometry]);

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;
    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += dt * 0.22;
      outerRingRef.current.rotation.x = 0.55 + Math.sin(t * 0.4) * 0.14;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.y -= dt * 0.36;
      innerRingRef.current.rotation.z = -0.35 + Math.cos(t * 0.5) * 0.16;
    }
    if (crystalRef.current) {
      crystalRef.current.rotation.y += dt * 0.55;
      crystalRef.current.rotation.x += dt * 0.25;
      crystalRef.current.position.y = 1.45 + Math.sin(t * 1.4) * 0.18;
    }
    if (starsRef.current) {
      starsRef.current.rotation.y += dt * 0.06;
    }
  });

  return (
    <>
      <ambientLight intensity={0.75} color="#E0E7FF" />
      <pointLight position={[3, 4, 4]} intensity={2.2} color={palette.secondary} />
      <pointLight position={[-4, -2, 2]} intensity={1.8} color={palette.primary} />
      <pointLight position={[0, 2, -2]} intensity={1.4} color={palette.accent} />

      <points ref={starsRef} geometry={starGeometry}>
        <pointsMaterial size={0.075} color="#E0E7FF" transparent opacity={0.82} sizeAttenuation />
      </points>

      <mesh ref={outerRingRef} position={[0, 0.5, -2.8]}>
        <torusGeometry args={[2.55, 0.032, 16, 72]} />
        <meshStandardMaterial
          color={palette.primary}
          emissive={palette.primary}
          emissiveIntensity={0.95}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>

      <mesh ref={innerRingRef} position={[0, 0.5, -2.5]}>
        <torusGeometry args={[1.75, 0.025, 16, 64]} />
        <meshStandardMaterial
          color={palette.secondary}
          emissive={palette.secondary}
          emissiveIntensity={1.1}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>

      <mesh ref={crystalRef} position={[0, 1.45, -2.1]}>
        <octahedronGeometry args={[0.42, 0]} />
        <meshStandardMaterial
          color={palette.accent}
          emissive={palette.primary}
          emissiveIntensity={0.85}
          metalness={0.4}
          roughness={0.18}
        />
      </mesh>
    </>
  );
}

export default function AuthCosmicCanvasWeb({ mode }: { mode: AuthVisualMode }) {
  return (
    <Canvas
      dpr={[1, 1.35]}
      camera={{ position: [0, 0, 5.2], fov: 46 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%', background: 'transparent' }}
    >
      <CosmicField mode={mode} />
    </Canvas>
  );
}
