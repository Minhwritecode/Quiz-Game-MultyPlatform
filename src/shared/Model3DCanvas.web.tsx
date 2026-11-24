import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
// @ts-expect-error -- three ships ESM without bundled @types/three in this repo
import * as THREE from 'three';
// @ts-expect-error -- three examples loader is untyped JS
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// @ts-expect-error -- three examples loader is untyped JS
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Character3DAnimation, Model3DActionEffect, Model3DType } from './Model3DView';
import { loadModelDataUri } from './modelLoader';

interface Model3DCanvasWebProps {
  model: Model3DType;
  autoRotate: boolean;
  interactive: boolean;
  animationName?: Character3DAnimation | string;
  actionEffect?: Model3DActionEffect;
  pulseTrigger?: number;
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
  actionEffect = 'idle',
  pulseTrigger = 0,
  autoplay,
  dragRotationYRef,
  dragRotationXRef,
  tapImpulseRef,
  onError,
}: Model3DCanvasWebProps & {
  dragRotationYRef: React.MutableRefObject<number>;
  dragRotationXRef: React.MutableRefObject<number>;
  tapImpulseRef: React.MutableRefObject<number>;
}) {
  const containerRef = useRef<any>(null);
  const spellLightRef = useRef<any>(null);
  const mixerRef = useRef<any>(null);
  const actionsRef = useRef<Map<string, any>>(new Map());
  const activeActionRef = useRef<any>(null);
  const effectClockRef = useRef(0);
  const [sceneObj, setSceneObj] = useState<any>(null);

  useEffect(() => {
    effectClockRef.current = 1.0;
  }, [actionEffect, pulseTrigger]);

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
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);
            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const targetSize =
              model === 'character'
                ? 2.35
                : model === 'splashMorph' || model === 'questEmblem'
                ? 2.45
                : 2.85;
            const targetScale = targetSize / maxDim;
            root.scale.setScalar(targetScale);
            root.position.set(
              -center.x * targetScale,
              -center.y * targetScale - (model === 'character' ? 0.06 : 0.05),
              -center.z * targetScale
            );

            // Boost emissive intensity slightly so stylized rune/gem/flame colors pop vividly
            root.traverse?.((child: any) => {
              if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                for (const m of mats) {
                  if (m && m.emissive && (m.emissive.r > 0 || m.emissive.g > 0 || m.emissive.b > 0)) {
                    m.emissiveIntensity = Math.max(m.emissiveIntensity ?? 1, 1.35);
                  }
                }
              }
            });

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

  useEffect(() => {
    if (!animationName || !autoplay || actionsRef.current.size === 0) return;
    const next = actionsRef.current.get(animationName);
    if (!next || next === activeActionRef.current) return;
    activeActionRef.current?.fadeOut(0.25);
    next.reset().fadeIn(0.25).play();
    activeActionRef.current = next;
  }, [animationName, autoplay]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.1);
    const t = state.clock.elapsedTime;

    if (mixerRef.current) {
      mixerRef.current.update(delta);
    }

    if (effectClockRef.current > 0) {
      effectClockRef.current = Math.max(0, effectClockRef.current - delta * 1.45);
    }
    if (tapImpulseRef.current > 0) {
      tapImpulseRef.current = Math.max(0, tapImpulseRef.current - delta * 2.2);
    }

    const impulse = Math.max(effectClockRef.current, tapImpulseRef.current);

    // Reactive gameplay spell light
    if (spellLightRef.current) {
      if (actionEffect === 'attack' && impulse > 0.05) {
        spellLightRef.current.color.set('#22D3EE');
        spellLightRef.current.intensity = 1.6 + impulse * 4.5;
      } else if (actionEffect === 'hurt' && impulse > 0.05) {
        spellLightRef.current.color.set('#EF4444');
        spellLightRef.current.intensity = 1.6 + impulse * 4.5;
      } else if (actionEffect === 'victory') {
        spellLightRef.current.color.set('#FBBF24');
        spellLightRef.current.intensity = 2.6 + Math.sin(t * 7) * 0.9;
      } else {
        spellLightRef.current.color.set('#F59E0B');
        spellLightRef.current.intensity = 1.25 + tapImpulseRef.current * 3.0 + Math.sin(t * 2.2) * 0.25;
      }
    }

    if (containerRef.current) {
      // Base rotation + interactive drag + action spin boost
      const spinSpeed =
        actionEffect === 'victory'
          ? 1.5
          : actionEffect === 'attack' && impulse > 0.1
          ? 1.8 * impulse
          : autoRotate
          ? 0.42
          : 0;

      if (spinSpeed > 0) {
        dragRotationYRef.current += delta * spinSpeed;
      }
      if (tapImpulseRef.current > 0.05) {
        dragRotationYRef.current += delta * 2.4 * tapImpulseRef.current;
      }

      containerRef.current.rotation.y += (dragRotationYRef.current - containerRef.current.rotation.y) * 0.14;
      containerRef.current.rotation.x += (dragRotationXRef.current - containerRef.current.rotation.x) * 0.14;

      // Gameplay-driven lively transform feedback (float, attack lunge, hurt shake, victory hop)
      let posY = Math.sin(t * 2.0) * 0.06;
      let posX = 0;
      let posZ = 0;
      let scaleBoost = 1 + tapImpulseRef.current * 0.08;

      if (actionEffect === 'attack' && impulse > 0.02) {
        posZ = Math.sin(impulse * Math.PI) * 0.36;
        posY += Math.sin(impulse * Math.PI) * 0.16;
        scaleBoost += Math.sin(impulse * Math.PI) * 0.1;
      } else if (actionEffect === 'hurt' && impulse > 0.02) {
        posX = Math.sin(t * 48) * 0.14 * impulse;
        posZ = -0.15 * impulse;
      } else if (actionEffect === 'victory') {
        posY += Math.abs(Math.sin(t * 5.2)) * 0.22;
        scaleBoost += 0.06;
      }

      containerRef.current.position.set(posX, posY, posZ);
      containerRef.current.scale.setScalar(scaleBoost);
    }
  });

  if (!sceneObj) return null;

  return (
    <>
      <pointLight ref={spellLightRef} position={[0, 1.8, 2.2]} intensity={1.3} color="#F59E0B" />
      <group ref={containerRef}>
        <primitive object={sceneObj} />
      </group>
    </>
  );
}

export default function Model3DCanvasWeb(props: Model3DCanvasWebProps) {
  const isCharacter = props.model === 'character';
  const isEmblem = props.model === 'questEmblem' || props.model === 'splashMorph';
  const defaultTiltX = isCharacter ? 0.04 : isEmblem ? 0.08 : 0.24;

  const dragRotationYRef = useRef(isCharacter ? 0.15 : 0.45);
  const dragRotationXRef = useRef(defaultTiltX);
  const tapImpulseRef = useRef(0);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  const cameraPos: [number, number, number] = isCharacter
    ? [0, 0.22, 3.25]
    : isEmblem
    ? [0, 0.15, 3.45]
    : [0, 1.15, 3.75];

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
        movedRef.current = false;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (!props.interactive || !draggingRef.current) return;
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) movedRef.current = true;
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        dragRotationYRef.current += dx * 0.013;
        dragRotationXRef.current = Math.max(-0.35, Math.min(0.65, dragRotationXRef.current + dy * 0.008));
      }}
      onPointerUp={() => {
        if (props.interactive && !movedRef.current) {
          // Tap-to-cast burst impulse on the 3D asset!
          tapImpulseRef.current = 1.0;
        }
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: cameraPos, fov: 40 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={1.15} color="#EEF2FF" />
        <hemisphereLight args={['#C7D2FE', '#1E1B4B', 0.95]} />
        <directionalLight position={[4, 6, 5]} intensity={1.85} color="#FFF7ED" />
        <directionalLight position={[-4, 2, -4]} intensity={1.2} color="#818CF8" />
        <LoadedGlbStage
          {...props}
          dragRotationYRef={dragRotationYRef}
          dragRotationXRef={dragRotationXRef}
          tapImpulseRef={tapImpulseRef}
        />
      </Canvas>
    </div>
  );
}
