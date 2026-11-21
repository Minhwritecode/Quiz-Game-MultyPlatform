import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';

interface DisposableResource {
  dispose: () => void;
}

interface ThreeObjectLike {
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number };
  scale: { set: (x: number, y: number, z: number) => void };
  isMesh?: boolean;
  isPoints?: boolean;
  geometry?: DisposableResource;
  material?: DisposableResource | DisposableResource[];
  traverse?: (cb: (child: ThreeObjectLike) => void) => void;
}

function disposeMaterial(mat: DisposableResource) {
  const record = mat as unknown as Record<string, unknown>;
  Object.keys(record).forEach((prop) => {
    const value = record[prop];
    if (value && typeof value === 'object' && 'minFilter' in value && 'dispose' in value) {
      (value as DisposableResource).dispose();
    }
  });
  mat.dispose();
}

function disposeThreeHierarchy(obj: ThreeObjectLike) {
  obj.traverse?.((child) => {
    if (child.isMesh || child.isPoints) {
      child.geometry?.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(disposeMaterial);
        } else {
          disposeMaterial(child.material);
        }
      }
    }
  });
}

function ArcaneQuestEmblem() {
  const rootRef = useRef<ThreeObjectLike | null>(null);
  const coreRef = useRef<ThreeObjectLike | null>(null);
  const outerRingRef = useRef<ThreeObjectLike | null>(null);
  const innerRingRef = useRef<ThreeObjectLike | null>(null);
  const runesRef = useRef<ThreeObjectLike | null>(null);
  const starsRef = useRef<ThreeObjectLike | null>(null);

  // Orbiting stardust particle coordinates (BufferAttribute via R3F JSX)
  const starPositions = useMemo(() => {
    const count = 42;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const radius = 1.65 + (i % 5) * 0.22;
      const y = ((i % 7) - 3) * 0.32;
      positions[i * 3] = Math.cos(theta) * radius;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(theta) * radius;
    }
    return positions;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    return () => {
      if (root) disposeThreeHierarchy(root);
    };
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const clampedDelta = Math.min(delta, 0.05);

    if (rootRef.current) {
      const targetX = state.pointer.y * 0.22;
      const targetY = state.pointer.x * 0.35;
      rootRef.current.rotation.x += (targetX - rootRef.current.rotation.x) * clampedDelta * 3;
      rootRef.current.rotation.y += (targetY - rootRef.current.rotation.y) * clampedDelta * 3;
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += clampedDelta * 0.65;
      coreRef.current.rotation.x = Math.sin(t * 1.1) * 0.14;
      coreRef.current.position.y = Math.sin(t * 1.8) * 0.12;
      const pulse = 1 + Math.sin(t * 2.4) * 0.04;
      coreRef.current.scale.set(0.85 * pulse, 1.2 * pulse, 0.85 * pulse);
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z += clampedDelta * 0.45;
      outerRingRef.current.rotation.x = 1.0 + Math.sin(t * 0.7) * 0.12;
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.z -= clampedDelta * 0.7;
      innerRingRef.current.rotation.y += clampedDelta * 0.25;
    }

    if (runesRef.current) {
      runesRef.current.rotation.y += clampedDelta * 0.52;
      runesRef.current.rotation.z = Math.sin(t * 0.9) * 0.12;
    }

    if (starsRef.current) {
      starsRef.current.rotation.y -= clampedDelta * 0.16;
    }
  });

  const runePositions: Array<[number, number, number]> = [
    [1.48, 0.22, 0],
    [-1.48, -0.22, 0],
    [0, 0.26, 1.48],
    [0, -0.26, -1.48],
  ];

  return (
    <group ref={rootRef as never}>
      {/* Central Arcane Crystal */}
      <mesh ref={coreRef as never} castShadow>
        <octahedronGeometry args={[0.62, 0]} />
        <meshStandardMaterial
          color="#6366F1"
          emissive="#4F46E5"
          emissiveIntensity={0.65}
          metalness={0.35}
          roughness={0.18}
        />
      </mesh>

      {/* Outer Golden Astrolabe Ring */}
      <mesh ref={outerRingRef as never} rotation={[1.0, 0.3, 0]}>
        <torusGeometry args={[1.18, 0.055, 12, 48]} />
        <meshStandardMaterial
          color="#F59E0B"
          emissive="#D97706"
          emissiveIntensity={0.3}
          metalness={0.85}
          roughness={0.22}
        />
      </mesh>

      {/* Inner Cyan Arcane Ring */}
      <mesh ref={innerRingRef as never} rotation={[-0.85, -0.45, 0]}>
        <torusGeometry args={[0.9, 0.036, 10, 40]} />
        <meshStandardMaterial
          color="#22D3EE"
          emissive="#06B6D4"
          emissiveIntensity={0.7}
          metalness={0.45}
          roughness={0.2}
        />
      </mesh>

      {/* 4 Orbiting Knowledge Rune Cubes */}
      <group ref={runesRef as never}>
        {runePositions.map((pos, idx) => (
          <mesh key={idx} position={pos} rotation={[0.78, 0.78, idx * 0.7]}>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial
              color={idx % 2 === 0 ? '#FBBF24' : '#38BDF8'}
              emissive={idx % 2 === 0 ? '#D97706' : '#0284C7'}
              emissiveIntensity={0.55}
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
        ))}
      </group>

      {/* Ambient Stardust Field */}
      <points ref={starsRef as never}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[starPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial color="#E0E7FF" size={0.06} sizeAttenuation transparent opacity={0.85} />
      </points>
    </group>
  );
}

export default function QuestArenaCanvas() {
  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.15, 4.4], fov: 40 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[3, 4, 5]} intensity={2.1} color="#FFFFFF" />
      <pointLight position={[-3, 1.5, 2.5]} intensity={1.6} color="#818CF8" />
      <pointLight position={[2.5, -2, 2]} intensity={1.1} color="#FBBF24" />
      <ArcaneQuestEmblem />
    </Canvas>
  );
}
