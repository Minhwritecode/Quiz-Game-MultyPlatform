import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';

function StudyStack() {
  const group = useRef<any>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.12;
    group.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.18) * 0.035 - 0.08;
  });

  return <group ref={group} position={[0.18, 0, 0]} rotation={[-0.08, -0.3, -0.04]}>
    <mesh position={[0, -0.12, 0]} rotation={[0, 0, -0.1]} castShadow>
      <boxGeometry args={[2.45, 0.16, 1.55]} /><meshStandardMaterial color="#E7E4FF" roughness={0.78} />
    </mesh>
    <mesh position={[0, 0, 0]} rotation={[0, 0, -0.1]} castShadow>
      <boxGeometry args={[2.32, 0.12, 1.48]} /><meshStandardMaterial color="#FFFFFF" roughness={0.7} />
    </mesh>
    <mesh position={[0, 0.12, 0]} rotation={[0, 0, -0.1]} castShadow>
      <boxGeometry args={[2.28, 0.08, 1.45]} /><meshStandardMaterial color="#FFFDF8" roughness={0.78} />
    </mesh>
    <mesh position={[-0.26, 0.18, 0.02]} rotation={[0, 0, -0.1]}>
      <boxGeometry args={[1.28, 0.015, 0.035]} /><meshStandardMaterial color="#6366F1" roughness={0.6} />
    </mesh>
    <mesh position={[-0.36, 0.18, -0.25]} rotation={[0, 0, -0.1]}>
      <boxGeometry args={[1.08, 0.015, 0.035]} /><meshStandardMaterial color="#CBD5E1" roughness={0.8} />
    </mesh>
    <mesh position={[-0.44, 0.18, -0.52]} rotation={[0, 0, -0.1]}>
      <boxGeometry args={[0.88, 0.015, 0.035]} /><meshStandardMaterial color="#CBD5E1" roughness={0.8} />
    </mesh>
    <mesh position={[0.56, 0.23, 0.14]} rotation={[0.12, 0.08, -0.07]} castShadow>
      <boxGeometry args={[0.56, 0.11, 0.56]} /><meshStandardMaterial color="#F59E0B" roughness={0.45} />
    </mesh>
    <mesh position={[0.56, 0.3, 0.14]} rotation={[0.12, 0.08, -0.07]}>
      <boxGeometry args={[0.2, 0.015, 0.2]} /><meshStandardMaterial color="#FFF7ED" roughness={0.4} />
    </mesh>
  </group>;
}

export default function PapyrusCanvas() {
  return <Canvas frameloop="always" dpr={[1, 1.25]} camera={{ position: [0, 0.1, 5.1], fov: 38 }} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}>
    <ambientLight intensity={1.5} />
    <directionalLight position={[3, 4, 5]} intensity={2.2} />
    <pointLight position={[-3, 1, 2]} intensity={0.9} color="#A5B4FC" />
    <StudyStack />
  </Canvas>;
}
