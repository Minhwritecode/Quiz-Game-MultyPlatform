# Three.js Deep Dive & Performance Optimization Guide

This reference documents practical techniques and architectural patterns from `mrdoob/three.js` tailored for cross-platform React Native (Expo) and Web apps.

---

## 1. Scene, Camera, and Coordinate Space
- **Coordinate System**: Three.js uses a right-handed coordinate system (+X points right, +Y points up, +Z points out of the screen toward the viewer).
- **Scale Standard**: 1 Three.js unit = 1 real-world meter. Keeping sizes within `[0.1, 10.0]` preserves numerical stability for floating-point depth buffers.
- **Field of View (FOV)**:
  - Mobile portrait: Prefer `fov` between `38°` and `45°` to prevent optical perspective distortion at screen edges.
  - Desktop widescreen: `45°` to `50°`.

---

## 2. Rendering Pipeline & Shaders
- **Renderer Selection**:
  - Web: WebGL2 by default with automatic fallback.
  - WebGPU (Experimental): Supported via Three.js `WebGPURenderer`.
- **Power & Thermal Throttling**:
  - Always configure `powerPreference: 'low-power'` in mobile environments to preserve device battery and prevent GPU thermal throttling.
  - Clamp pixel ratio: `dpr={[1, Math.min(window.devicePixelRatio || 1, 1.5)]}`.

---

## 3. Materials and Lighting Strategies
- **MeshStandardMaterial vs MeshBasicMaterial**:
  - Use `MeshStandardMaterial` for objects that require realistic lighting (roughness, metalness, normal maps).
  - Use `MeshBasicMaterial` for UI backdrops, glowing auras, or particles to bypass lighting calculations completely.
- **PBR Environment Lighting**:
  - Avoid more than 2 dynamic point lights in a single scene.
  - Rely on an ambient light (`intensity: 1.0 - 1.5`) + 1 directional sun light (`intensity: 1.5 - 2.5`) for clean, stylized mobile visuals.

---

## 4. Animation Systems
- **AnimationMixer**:
  - One `AnimationMixer` per animated root object.
  - Update inside the render loop using real delta time: `mixer.update(delta)`.
  - Avoid large time spikes when resuming from background: clamp delta to `Math.min(delta, 0.1)`.

---

## 5. Asset Management & Zero Memory Leaks
- **glTF / GLB Best Practices**:
  - Always prefer single-file `.glb` binary containers containing embedded textures and vertex data.
  - Keep texture sizes below `1024x1024` (or `512x512` for mobile icons).
  - Use KHR_draco_mesh_compression for geometry and KHR_texture_basisu (KTX2) for textures.
- **Resource Disposal Checklist**:
  1. Geometries: `mesh.geometry.dispose()`
  2. Materials: `mesh.material.dispose()`
  3. Textures: `map.dispose()`, `normalMap.dispose()`, `roughnessMap.dispose()`
  4. Render Targets: `renderTarget.dispose()`
  5. WebGL Context: Clear canvas and unbind WebGL events on component unmount.
