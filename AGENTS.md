# Papyrus Agent Guidelines & Operational Memory

This document is loaded into the agent's context across all turns and sessions within this project.

---

## 1. Core Operating Philosophy
- **Additive Development Only**: Always ADD, optimize, or refine features. NEVER delete, remove, or break existing modes, state management, routes, or functional code.
- **Commit Messages**: Write concise, feature-based git commit messages (e.g. `feat: ...`, `perf: ...`, `fix: ...`). Never mention external source repositories.
- **Quality Gates**:
  1. `npm run typecheck` must pass with 0 errors.
  2. `npx eslint src --quiet` must pass with 0 warnings/errors.
  3. `npm test` must pass 100% of test suites.

---

## 2. 3D Graphics & Three.js Pipeline (`mrdoob/three.js`)
When authoring or modifying 3D scenes, models, shaders, or canvas elements:
- **Canvas Setup**:
  - Always clamp device pixel ratio on mobile: `dpr={[1, 1.5]}`.
  - Set `gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}` to prevent GPU thermal throttling.
  - Wrap 3D elements inside `<Model3DErrorBoundary>` and provide a clean 2D fallback component.
- **Strict Memory Disposal**:
  - Prevent WebGL context leaks on mobile: traverse objects and call `.dispose()` on all geometries, materials, and textures when unmounted.
- **Animation System**:
  - Use `AnimationMixer` with delta-clamped time increments (`Math.min(delta, 0.1)`).
  - Cross-fade between clips (`Idle`, `Cast_Spell`, `Hit_Reaction`, `Victory_Dance`) using `fadeIn(0.25)` / `fadeOut(0.25)`.

---

## 3. Blender 3D Asset Creation (`ahujasid/mcp-for-blender`)
When generating or modifying 3D meshes, props, or characters:
- **Blender Execution**:
  - Local Blender binary path: `/Applications/Blender.app/Contents/MacOS/Blender`.
  - Automation mode: Run headless background scripts (`Blender -b -P <script.py>`) or connect via `mcp-for-blender` (`uvx mcp-for-blender`).
- **Modeling & Optimization Rules**:
  - Target low-poly budgets: Props (200-1,000 tris), Characters (3,000-8,000 tris).
  - Use `BEVEL` and `DECIMATE` modifiers for stylized game edges and lightweight vertex counts.
  - Export format: Draco-compressed `.glb` with Y-up orientation, applied modifiers, and embedded PBR textures.
- **Skill Reference**: See details in `.agents/skills/threejs-blender-pipeline/SKILL.md`.

---

## 4. Mobile & Web Responsive Standards
- **Mobile First (320px – 390px Viewports)**:
  - Zero horizontal overflow: every text element inside flex containers must have `flexShrink: 1` or `numberOfLines`.
  - Button rows: always add `flexWrap: 'wrap'` and flexible `minWidth` so actions stack cleanly rather than clipping edges.
  - Safe Areas: apply `useSafeAreaInsets()` for modals and floating nav bars to prevent notch / home indicator overlaps.
- **Scroll Hierarchy**:
  - When a screen contains a `<FlatList>` or inner `<ScrollView>`, the root `<Screen>` component MUST specify `scroll={false}` to prevent React Native nested virtualized list warnings.
- **Desktop Web (Width >= 768px)**:
  - Center forms and cards with clean `maxWidth` constraints (480px for join PINs, 680px for battle/host rooms, 760px for editors, 960px for landing pages).
  - Convert single-column mobile lists into responsive multi-column flex grids.
