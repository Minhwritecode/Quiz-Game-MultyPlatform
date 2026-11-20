---
name: threejs-blender-pipeline
description: >-
  Automate 3D asset generation, procedural modeling, animation, and glTF/GLB optimization
  using Blender (including mcp-for-blender and headless bpy scripting), and render high-performance
  Three.js (and @react-three/fiber) scenes into Papyrus with zero memory leaks and mobile responsiveness.
---

# Three.js & Blender 3D Pipeline Guide

This skill encapsulates core techniques, architectures, and automated workflows distilled from
[mrdoob/three.js](https://github.com/mrdoob/three.js) and
[ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) tailored for the Papyrus cross-platform game.

---

## 1. Core Architecture Overview

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     Blender 3D & MCP Pipeline   │       │   Three.js & R3F Runtime Engine │
│  (ahujasid/mcp-for-blender)     │       │        (mrdoob/three.js)        │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ • Procedural `bpy` modeling     │       │ • React Three Fiber (<Canvas>)  │
│ • Subdivision, Bevel, Decimate  │ ───►  │ • PBR Shaders & Dynamic Lights  │
│ • Armature rigging & animations │  GLB  │ • AnimationMixer (Idle/Attack)  │
│ • Draco-compressed glTF export  │       │ • Deep Dispose & Memory Guard   │
└─────────────────────────────────┘       └─────────────────────────────────┘
```

---

## 2. Three.js Runtime & Rendering Patterns (`mrdoob/three.js`)

### 2.1 Scene Setup & Mobile Optimization
When rendering Three.js scenes on mobile and web (e.g., in React Native `@react-three/fiber` or `expo-gl`):
1. **Device Pixel Ratio (DPR)**: Clamp DPR to `[1, 1.5]` or `[1, 2]` to prevent GPU overheating on high-density mobile screens:
   ```tsx
   <Canvas dpr={[1, Math.min(window.devicePixelRatio || 1, 1.5)]} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}>
   ```
2. **Frameloop Management**:
   - For static/turn-based scenes, use `frameloop="demand"` and trigger renders only on state changes.
   - For animated scenes, use `frameloop="always"` with delta-based increments in `useFrame((state, delta) => ...)`.
3. **Lighting & Shadows**:
   - Keep shadow map resolution low on mobile (`shadowMap.size.width = 512`).
   - Prefer soft ambient illumination + 1 directional sun light + 1 subtle colored point light.

### 2.2 Strict Memory Disposal (Prevent WebGL Context Loss)
Every Three.js object allocated in memory must be explicitly disposed of when unmounted:
```ts
export function disposeThreeHierarchy(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(mesh.material);
        }
      }
    }
  });
}

function disposeMaterial(mat: THREE.Material) {
  Object.keys(mat).forEach((prop) => {
    const value = (mat as any)[prop];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      (value as THREE.Texture).dispose();
    }
  });
  mat.dispose();
}
```

### 2.3 Animation Handling
Manage multi-clip animations (e.g. `Idle`, `Cast_Spell`, `Hit_Reaction`, `Victory_Dance`) cleanly:
- Cache actions in a dictionary `actions[name]`.
- Cross-fade smoothly between clips:
  ```ts
  const prevAction = actions[currentAnim];
  const nextAction = actions[newAnim];
  if (prevAction && nextAction && prevAction !== nextAction) {
    nextAction.reset().fadeIn(0.25).play();
    prevAction.fadeOut(0.25);
  }
  ```

---

## 3. Blender Automation Pipeline (`mcp-for-blender`)

### 3.1 Overview
`ahujasid/mcp-for-blender` bridges LLMs to Blender via the Model Context Protocol (MCP) and Blender's Python API (`bpy`).
- It enables interactive procedural generation, modifier adjustments, material setups, and glTF/GLB export.
- Can be operated interactively via the MCP server or headlessly via `/Applications/Blender.app/Contents/MacOS/Blender -b -P <script.py>`.

### 3.2 Key Blender Python (`bpy`) Automation Patterns

#### 1. Clean Scene Initialization
```python
import bpy

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for collection in bpy.data.collections:
        bpy.data.collections.remove(collection)
```

#### 2. Procedural Mesh Generation & Modifiers
```python
import bpy

def create_stylized_scroll():
    # Cylinder body
    bpy.ops.mesh.primitive_cylinder_add(radius=0.15, depth=1.8, vertices=16, location=(0, 0, 0))
    scroll = bpy.context.active_object
    scroll.name = "Ancient_Scroll"

    # Bevel modifier for rounded game look
    bevel = scroll.modifiers.new(name="Bevel", type='BEVEL')
    bevel.width = 0.02
    bevel.segments = 2

    # Smooth shading
    for poly in scroll.data.polygons:
        poly.use_smooth = True
```

#### 3. Stylized PBR Material Creation
```python
def create_gold_material(name="Gold_PBR"):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.96, 0.62, 0.04, 1.0) # Amber gold
        bsdf.inputs["Metallic"].default_value = 0.85
        bsdf.inputs["Roughness"].default_value = 0.28
    return mat
```

#### 4. Automated Game-Ready glTF/GLB Export
```python
def export_optimized_glb(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,
        export_apply=True,              # Apply all modifiers
        export_yup=True,                # Three.js Y-up convention
        export_animations=True,
        export_current_frame=False,
        export_skins=True,
        export_morph=True,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=True, # Draco compression for fast loading
        export_draco_mesh_compression_level=7,
    )
```

---

## 4. References & Documentation

- [Three.js Deep Dive & Performance Patterns](./references/threejs-guide.md)
- [Blender MCP & Headless Scripting Manual](./references/blender-mcp-guide.md)
