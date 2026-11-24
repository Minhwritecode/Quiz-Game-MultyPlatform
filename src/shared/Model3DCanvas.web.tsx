import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
// @ts-expect-error -- three ships ESM without bundled @types/three in this repo
import * as THREE from 'three';
// @ts-expect-error -- three examples loader is untyped JS
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// @ts-expect-error -- three examples loader is untyped JS
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Character3DAnimation, Model3DType } from './Model3DView';
import { loadModelDataUri } from './modelLoader';

interface Model3DCanvasWebProps {
  model: Model3DType;
  autoRotate: boolean;
  interactive: boolean;
  animationName?: Character3DAnimation | string;
  autoplay: boolean;
  onError: () => void;
}

function dataUriToArrayBuffer(dataUri: string): ArrayBuffer {
  const commaIdx = dataUri.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function disposeThreeScene(root: any) {
  if (!root) return;
  root.traverse?.((child: any) => {
    if (child.geometry) {
      child.geometry.dispose?.();
    }
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          const val = mat[key];
          if (val && typeof val === 'object' && typeof val.dispose === 'function') {
            val.dispose();
          }
        }
        mat.dispose?.();
      }
    }
  });
}

function LoadedGlbStage({
  model,
  autoRotate,
  interactive,
  animationName,
  autoplay,
  dragRotationYRef,
  dragRotationXRef,
  onError,
}: Model3DCanvasWebProps & {
  dragRotationYRef: React.MutableRefObject<number>;
  dragRotationXRef: React.MutableRefObject<number>;
}) {
  const containerRef = useRef<any>(null);
  const mixerRef = useRef<any>(null);
  const actionsRef = useRef<Map<string, any>>(new Map());
  const activeActionRef = useRef<any>(null);
  const [sceneObj, setSceneObj] = useState<any>(null);

  useEffect(() => {
    let active = true;
    let loadedRoot: any = null;
    let dracoLoader: any = null;

    loadModelDataUri(model)
      .then((dataUri) => {
        if (!active || !dataUri) return;
        const buffer = dataUriToArrayBuffer(dataUri);
        const loader = new GLTFLoader();
        if (model === 'questEmblem' || model === 'splashMorph') {
          dracoLoader = new DRACOLoader();
          dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
          loader.setDRACOLoader(dracoLoader);
        }

        loader.parse(
          buffer,
          '',
          (gltf: any) => {
            if (!active) {
              disposeThreeScene(gltf.scene);
              dracoLoader?.dispose?.();
              return;
            }
            const root = gltf.scene;
            // Center & normalize scale so every Blender asset frames cleanly
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const targetScale = (model === 'character' ? 2.25 : 2.65) / maxDim;
            root.scale.setScalar(targetScale);
            root.position.set(
              -center.x * targetScale,
              -center.y * targetScale - (model === 'character' ? 0.05 : 0.1),
              -center.z * targetScale
            );

            // Set up skeletal AnimationMixer if clips are embedded
            actionsRef.current.clear();
            activeActionRef.current = null;
            if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
              const mixer = new THREE.AnimationMixer(root);
              mixerRef.current = mixer;
              for (const clip of gltf.animations) {
                actionsRef.current.set(clip.name, mixer.clipAction(clip));
              }
              if (autoplay) {
                const preferred =
                  (animationName && actionsRef.current.get(animationName)) ||
                  actionsRef.current.get('Idle') ||
                  actionsRef.current.values().next().value;
                if (preferred) {
                  preferred.reset().fadeIn(0.25).play();
                  activeActionRef.current = preferred;
                }
              }
            }

            loadedRoot = root;
            setSceneObj(root);
          },
          () => {
            if (active) onError();
          }
        );
      })
      .catch(() => {
        if (active) onError();
      });

    return () => {
      active = false;
      if (mixerRef.current) {
        mixerRef.current.stopAllAction?.();
        mixerRef.current = null;
      }
      actionsRef.current.clear();
      activeActionRef.current = null;
      disposeThreeScene(loadedRoot);
      dracoLoader?.dispose?.();
      setSceneObj(null);
    };
  }, [model, autoplay, onError]); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth cross-fade between animation clips (Idle, Cast_Spell, Hit_Reaction, Victory_Dance)
  useEffect(() => {
    if (!animationName || !autoplay || actionsRef.current.size === 0) return;
    const next = actionsRef.current.get(animationName);
    if (!next || next === activeActionRef.current) return;
    activeActionRef.current?.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    activeActionRef.current = next;
  }, [animationName, autoplay]);

  useFrame((_, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }
    if (containerRef.current) {
      if (autoRotate && !interactive) {
        containerRef.current.rotation.y += delta * 0.45;
      } else if (autoRotate) {
        dragRotationYRef.current += delta * 0.35;
        containerRef.current.rotation.y += (dragRotationYRef.current - containerRef.current.rotation.y) * 0.12;
        containerRef.current.rotation.x += (dragRotationXRef.current - containerRef.current.rotation.x) * 0.12;
      } else {
        containerRef.current.rotation.y += (dragRotationYRef.current - containerRef.current.rotation.y) * 0.12;
        containerRef.current.rotation.x += (dragRotationXRef.current - containerRef.current.rotation.x) * 0.12;
      }
    }
  });

  if (!sceneObj) return null;

  return (
    <group ref={containerRef}>
      <primitive object={sceneObj} />
    </group>
  );
}

export default function Model3DCanvasWeb(props: Model3DCanvasWebProps) {
  const dragRotationYRef = useRef(0);
  const dragRotationXRef = useRef(0.12);
  const draggingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        cursor: props.interactive ? 'grab' : 'default',
        touchAction: 'pan-y',
      }}
      onPointerDown={(e) => {
        if (!props.interactive) return;
        draggingRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!props.interactive || !draggingRef.current) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        dragRotationYRef.current += dx * 0.012;
        dragRotationXRef.current = Math.max(-0.45, Math.min(0.65, dragRotationXRef.current + dy * 0.008));
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.7, 4.1], fov: 40 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={0.95} color="#E0E7FF" />
        <directionalLight position={[4, 6, 5]} intensity={1.65} color="#FFF7ED" />
        <directionalLight position={[-4, 2, -4]} intensity={1.1} color="#818CF8" />
        <pointLight position={[0, 3, 2]} intensity={0.9} color="#F59E0B" />
        <LoadedGlbStage
          {...props}
          dragRotationYRef={dragRotationYRef}
          dragRotationXRef={dragRotationXRef}
        />
      </Canvas>
    </div>
  );
}
