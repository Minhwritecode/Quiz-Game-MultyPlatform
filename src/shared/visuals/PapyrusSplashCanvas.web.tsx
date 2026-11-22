import { Canvas, useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { computeSplashMorphState, lerp } from './splashMorphCurve';

type Vec3 = [number, number, number];
type Rgb = [number, number, number];

interface DisposableResource {
  dispose: () => void;
}

interface BufferAttributeLike {
  constructor: new (array: ArrayLike<number>, itemSize: number) => BufferAttributeLike;
}

interface BufferGeometryLike extends DisposableResource {
  attributes?: { position?: BufferAttributeLike };
  morphAttributes?: Record<string, BufferAttributeLike[]>;
  computeVertexNormals?: () => void;
}

interface ThreeObjectLike {
  rotation: { x: number; y: number; z: number };
  position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  scale: { setScalar: (s: number) => void; set: (x: number, y: number, z: number) => void };
  visible: boolean;
  intensity?: number;
  geometry?: BufferGeometryLike;
  material?: DisposableResource | DisposableResource[];
  morphTargetInfluences?: number[];
  updateMorphTargets?: () => void;
  traverse?: (cb: (child: ThreeObjectLike) => void) => void;
}

function vSub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vAddScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
}

function vDot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function vCross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vNorm(a: Vec3): Vec3 {
  const len = Math.hypot(a[0], a[1], a[2]);
  return len > 1e-7 ? [a[0] / len, a[1] / len, a[2] / len] : [0, 0, 1];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinearRgb(hex: string): Rgb {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function catmullRom(points: Vec3[], t: number): Vec3 {
  const n = points.length;
  const scaled = Math.max(0, Math.min(1, t)) * (n - 1);
  const idx = Math.min(Math.floor(scaled), n - 2);
  const u = scaled - idx;
  const fallback: Vec3 = points[0] ?? [0, 0, 0];
  const p0 = points[Math.max(0, idx - 1)] ?? fallback;
  const p1 = points[idx] ?? fallback;
  const p2 = points[idx + 1] ?? fallback;
  const p3 = points[Math.min(n - 1, idx + 2)] ?? fallback;
  const u2 = u * u;
  const u3 = u2 * u;

  return [
    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3),
    0.5 * (2 * p1[2] + (-p0[2] + p2[2]) * u + (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * u2 + (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * u3),
  ];
}

function disposeMaterial(mat: DisposableResource) {
  const record = mat as unknown as Record<string, unknown>;
  Object.keys(record).forEach((key) => {
    const val = record[key];
    if (val && typeof val === 'object' && 'minFilter' in val && 'dispose' in val) {
      (val as DisposableResource).dispose();
    }
  });
  mat.dispose();
}

export function disposeThreeHierarchy(root: ThreeObjectLike) {
  root.traverse?.((child) => {
    child.geometry?.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(disposeMaterial);
      } else {
        disposeMaterial(child.material);
      }
    }
  });
}

interface MorphMeshArrays {
  basis: Float32Array;
  morph: Float32Array;
  colors: Float32Array;
  indices: Uint16Array;
}

/**
 * Parchment Scroll morph buffers (Basis: Rolled Ancient Scroll -> Morph: Slanted Papyrus Logo Scroll).
 * Matches scripts/blender/build_splash_morph.py 1:1.
 */
function buildParchmentMorphArrays(): MorphMeshArrays {
  const nu = 36;
  const nv = 8;
  const tilt = (-11 * Math.PI) / 180;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);

  const wAxis = vNorm([0.86, -0.1, -0.5]);
  const rawUp = vNorm([0.15, 0.985, 0.08]);
  const upAxis = vNorm(vAddScaled(rawUp, wAxis, -vDot(rawUp, wAxis)));
  const frontAxis = vNorm(vCross(wAxis, upAxis));
  const origin: Vec3 = [-0.24, -0.02, -0.04];

  const evalBasis = (u: number, v: number): Vec3 => {
    const theta = u * 2.05 * Math.PI * 2 + 0.35;
    const r = 0.14 + 0.145 * u;
    const xl = v * 1.56;
    const yl = Math.sin(theta) * r;
    const zl = Math.cos(theta) * r;
    return [xl * cosTilt - yl * sinTilt, xl * sinTilt + yl * cosTilt, zl];
  };

  const evalMorph = (u: number, v: number): Vec3 => {
    let py: number;
    let pz: number;
    if (u < 0.28) {
      const t = 1 - u / 0.28;
      const angle = -Math.PI * 0.5 + t * 1.18 * Math.PI * 2;
      const rad = lerp(0.21, 0.085, t);
      py = 0.62 + Math.sin(angle) * rad;
      pz = 0.18 + Math.cos(angle) * rad;
    } else if (u > 0.72) {
      const t = (u - 0.72) / 0.28;
      const angle = Math.PI * 0.5 - t * 1.18 * Math.PI * 2;
      const rad = lerp(0.2, 0.082, t);
      py = -0.66 + Math.sin(angle) * rad;
      pz = 0.18 + Math.cos(angle) * rad;
    } else {
      const s = (u - 0.28) / 0.44;
      py = lerp(0.62 - 0.21, -0.66 + 0.2, s);
      pz = -0.03 + Math.sin(s * Math.PI) * 0.055;
    }

    let notchIn = 0;
    if (u > 0.39 && u < 0.46 && v < -0.2) {
      notchIn = 0.085 * (1 - Math.abs(u - 0.425) / 0.035) * Math.max(0, (-v - 0.2) / 0.3);
    } else if (u > 0.48 && u < 0.55 && v > 0.2) {
      notchIn = -0.085 * (1 - Math.abs(u - 0.515) / 0.035) * Math.max(0, (v - 0.2) / 0.3);
    }

    const p1 = vAddScaled(origin, upAxis, py);
    const p2 = vAddScaled(p1, frontAxis, pz);
    return vAddScaled(p2, wAxis, v * 0.64 + notchIn);
  };

  const halfThick = 0.017;
  const eps = 0.004;
  const perSide = (nu + 1) * (nv + 1);
  const totalVerts = perSide * 2;
  const basis = new Float32Array(totalVerts * 3);
  const morph = new Float32Array(totalVerts * 3);
  const colors = new Float32Array(totalVerts * 3);

  const fillGrid = (evalFn: (u: number, v: number) => Vec3, target: Float32Array, sideIdx: number) => {
    const sign = sideIdx === 0 ? 1 : -1;
    let cursor = sideIdx * perSide * 3;
    for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu;
      for (let iv = 0; iv <= nv; iv++) {
        const v = iv / nv - 0.5;
        const p = evalFn(u, v);
        const pu = vSub(evalFn(Math.min(1, u + eps), v), evalFn(Math.max(0, u - eps), v));
        const pv = vSub(evalFn(u, Math.min(0.5, v + eps)), evalFn(u, Math.max(-0.5, v - eps)));
        const n = vNorm(vCross(pu, pv));
        const shifted = vAddScaled(p, n, sign * halfThick);
        target[cursor++] = shifted[0];
        target[cursor++] = shifted[1];
        target[cursor++] = shifted[2];
      }
    }
  };

  fillGrid(evalBasis, basis, 0);
  fillGrid(evalBasis, basis, 1);
  fillGrid(evalMorph, morph, 0);
  fillGrid(evalMorph, morph, 1);

  const cCream = hexToLinearRgb('#FFF6CE');
  const cGold = hexToLinearRgb('#F6C358');
  const cAmber = hexToLinearRgb('#C67C28');
  let colCursor = 0;
  for (let side = 0; side < 2; side++) {
    for (let iu = 0; iu <= nu; iu++) {
      const u = iu / nu;
      const curlW = Math.max(1 - smoothstep(0.14, 0.32, u), smoothstep(0.68, 0.86, u));
      for (let iv = 0; iv <= nv; iv++) {
        const v = iv / nv - 0.5;
        const edgeW = Math.pow(Math.min(1, Math.abs(v) * 2), 1.5);
        const warmth = Math.min(1, Math.max(curlW * 0.78, edgeW * 0.58) + (side === 1 ? 0.22 : 0));
        const rgb = warmth < 0.65
          ? mixRgb(cCream, cGold, Math.min(1, warmth * 1.4))
          : mixRgb(cGold, cAmber, (warmth - 0.65) / 0.35);
        colors[colCursor++] = rgb[0];
        colors[colCursor++] = rgb[1];
        colors[colCursor++] = rgb[2];
      }
    }
  }

  const stride = nv + 1;
  const idxList: number[] = [];
  const pushQuad = (a: number, b: number, c: number, d: number) => {
    idxList.push(a, b, c, a, c, d);
  };
  for (let iu = 0; iu < nu; iu++) {
    for (let iv = 0; iv < nv; iv++) {
      const a = iu * stride + iv;
      const b = a + 1;
      const c = (iu + 1) * stride + iv + 1;
      const d = (iu + 1) * stride + iv;
      pushQuad(a, b, c, d);
      pushQuad(perSide + d, perSide + c, perSide + b, perSide + a);
    }
  }
  for (let iv = 0; iv < nv; iv++) {
    pushQuad(iv, perSide + iv, perSide + iv + 1, iv + 1);
    const base = nu * stride + iv;
    pushQuad(base, base + 1, perSide + base + 1, perSide + base);
  }
  for (let iu = 0; iu < nu; iu++) {
    const a = iu * stride;
    const d = (iu + 1) * stride;
    pushQuad(a, d, perSide + d, perSide + a);
    pushQuad(a + nv, perSide + a + nv, perSide + d + nv, d + nv);
  }

  return { basis, morph, colors, indices: new Uint16Array(idxList) };
}

/**
 * Cosmic Indigo-Violet-Magenta "P" Ribbon morph buffers matching assets/icon.png.
 */
function buildCosmicRibbonMorphArrays(): MorphMeshArrays {
  const ns = 56;
  const nc = 8;
  const profile: Array<[number, number]> = [
    [0.54, 0.13],
    [0.38, 0.25],
    [-0.38, 0.25],
    [-0.54, 0.13],
    [-0.54, -0.13],
    [-0.38, -0.25],
    [0.38, -0.25],
    [0.54, -0.13],
  ];

  const pControl: Vec3[] = [
    [-0.62, 0.42, -0.18],
    [-0.94, 0.64, 0.04],
    [-0.76, 0.98, 0.14],
    [-0.14, 1.06, 0.16],
    [0.54, 0.98, 0.2],
    [0.9, 0.66, 0.22],
    [0.96, 0.16, 0.18],
    [0.6, -0.18, 0.28],
    [-0.12, -0.26, 0.34],
    [-0.76, -0.54, 0.22],
    [-0.72, -1.0, 0.06],
    [-0.16, -0.94, -0.14],
  ];

  const sampleSwept = (pts: Vec3[], widths: number[], thicks: number[], twists: number[]): Float32Array => {
    const out = new Float32Array((ns + 1) * nc * 3);
    let prevN: Vec3 = [0, 0, 1];
    let cursor = 0;

    for (let i = 0; i <= ns; i++) {
      const p = pts[i] ?? [0, 0, 0];
      const prevPt = pts[Math.max(0, i - 1)] ?? p;
      const nextPt = pts[Math.min(ns, i + 1)] ?? p;
      const tang = vNorm(vSub(nextPt, prevPt));

      let ref = vAddScaled(prevN, tang, -vDot(prevN, tang));
      if (Math.hypot(ref[0], ref[1], ref[2]) < 1e-4) {
        const alt: Vec3 = Math.abs(tang[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0];
        ref = vAddScaled(alt, tang, -vDot(alt, tang));
      }
      ref = vNorm(ref);
      prevN = ref;
      const binorm = vNorm(vCross(tang, ref));

      const tw = twists[i] ?? 0;
      const ct = Math.cos(tw);
      const st = Math.sin(tw);
      const nDir: Vec3 = [ref[0] * ct + binorm[0] * st, ref[1] * ct + binorm[1] * st, ref[2] * ct + binorm[2] * st];
      const bDir: Vec3 = [-ref[0] * st + binorm[0] * ct, -ref[1] * st + binorm[1] * ct, -ref[2] * st + binorm[2] * ct];

      const w = widths[i] ?? 0.2;
      const th = thicks[i] ?? 0.1;
      for (let j = 0; j < nc; j++) {
        const [px, py] = profile[j] ?? [0, 0];
        out[cursor++] = p[0] + bDir[0] * px * w + nDir[0] * py * th;
        out[cursor++] = p[1] + bDir[1] * px * w + nDir[1] * py * th;
        out[cursor++] = p[2] + bDir[2] * px * w + nDir[2] * py * th;
      }
    }
    return out;
  };

  const tilt = (-11 * Math.PI) / 180;
  const cosTilt = Math.cos(tilt);
  const sinTilt = Math.sin(tilt);

  const basisPts: Vec3[] = [];
  const basisW: number[] = [];
  const basisTh: number[] = [];
  const basisTw: number[] = [];
  const morphPts: Vec3[] = [];
  const morphW: number[] = [];
  const morphTh: number[] = [];
  const morphTw: number[] = [];

  for (let i = 0; i <= ns; i++) {
    const t = i / ns;
    const theta = (t - 0.5) * 1.32 * Math.PI * 2 + 0.12;
    const r = 0.312;
    const xl = (t - 0.5) * 0.26;
    const yl = Math.sin(theta) * r;
    const zl = Math.cos(theta) * r;
    basisPts.push([xl * cosTilt - yl * sinTilt, xl * sinTilt + yl * cosTilt, zl]);
    const bTaper = 0.74 + 0.26 * Math.sin(t * Math.PI);
    basisW.push(0.19 * bTaper);
    basisTh.push(0.055 * bTaper);
    basisTw.push(0);

    morphPts.push(catmullRom(pControl, t));
    const endTaper = smoothstep(0, 0.09, t) * (1 - 0.38 * smoothstep(0.88, 1, t));
    const archSwell = 1 + 0.28 * Math.sin(t * Math.PI);
    morphW.push(0.34 * endTaper * archSwell);
    morphTh.push(0.14 * (0.68 + 0.32 * endTaper));
    morphTw.push(Math.sin(t * Math.PI * 2) * 0.26 + 0.14);
  }

  const basis = sampleSwept(basisPts, basisW, basisTh, basisTw);
  const morph = sampleSwept(morphPts, morphW, morphTh, morphTw);

  const cPeriwinkle = hexToLinearRgb('#607BFF');
  const cIndigo = hexToLinearRgb('#352DC8');
  const cViolet = hexToLinearRgb('#6D28D9');
  const cMagenta = hexToLinearRgb('#D946EF');
  const colors = new Float32Array((ns + 1) * nc * 3);

  let colCursor = 0;
  for (let i = 0; i <= ns; i++) {
    const t = i / ns;
    const bodyCol = mixRgb(cIndigo, cViolet, smoothstep(0.08, 0.92, t));
    for (let j = 0; j < nc; j++) {
      const rgb = j === 1 || j === 2
        ? mixRgb(bodyCol, cPeriwinkle, 0.42)
        : j === 5 || j === 6
          ? mixRgb(cViolet, cMagenta, 0.65 + 0.32 * t)
          : bodyCol;
      colors[colCursor++] = rgb[0];
      colors[colCursor++] = rgb[1];
      colors[colCursor++] = rgb[2];
    }
  }

  const idxList: number[] = [];
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < nc; j++) {
      const jn = (j + 1) % nc;
      const a = i * nc + j;
      const b = i * nc + jn;
      const c = (i + 1) * nc + jn;
      const d = (i + 1) * nc + j;
      idxList.push(a, b, c, a, c, d);
    }
  }

  return { basis, morph, colors, indices: new Uint16Array(idxList) };
}

function buildStarburstArrays(): { positions: Float32Array; indices: Uint16Array } {
  const pos: number[] = [];
  const idx: number[] = [];

  const addSpike = (dx: number, dy: number, dz: number, length: number, halfW: number) => {
    const base = pos.length / 3;
    const d = vNorm([dx, dy, dz]);
    const up: Vec3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    const u = vNorm(vCross(d, up));
    const v = vNorm(vCross(d, u));
    const uScaled: Vec3 = [u[0] * halfW, u[1] * halfW, u[2] * halfW];
    const vScaled: Vec3 = [v[0] * halfW * 0.65, v[1] * halfW * 0.65, v[2] * halfW * 0.65];
    const tip: Vec3 = [d[0] * length, d[1] * length, d[2] * length];
    const back: Vec3 = [-d[0] * length * 0.14, -d[1] * length * 0.14, -d[2] * length * 0.14];

    const pts: Vec3[] = [
      tip,
      uScaled,
      vScaled,
      [-uScaled[0], -uScaled[1], -uScaled[2]],
      [-vScaled[0], -vScaled[1], -vScaled[2]],
      back,
    ];
    pts.forEach((p) => pos.push(p[0], p[1], p[2]));
    for (let k = 0; k < 4; k++) {
      const kn = (k + 1) % 4;
      idx.push(base, base + 1 + k, base + 1 + kn);
      idx.push(base + 5, base + 1 + kn, base + 1 + k);
    }
  };

  addSpike(0, 1, 0, 0.64, 0.032);
  addSpike(0, -1, 0, 0.56, 0.03);
  addSpike(1, 0, 0, 0.6, 0.032);
  addSpike(-1, 0, 0, 0.48, 0.028);
  const diag = Math.SQRT1_2;
  addSpike(diag, diag, 0.08, 0.34, 0.02);
  addSpike(-diag, diag, 0.08, 0.34, 0.02);
  addSpike(diag, -diag, 0.08, 0.34, 0.02);
  addSpike(-diag, -diag, 0.08, 0.34, 0.02);

  return { positions: new Float32Array(pos), indices: new Uint16Array(idx) };
}

function buildFinialArrays(side: 1 | -1): { positions: Float32Array; indices: Uint16Array } {
  const rings: Array<[number, number]> = [
    [0.055, 0.76],
    [0.145, 0.8],
    [0.162, 0.85],
    [0.095, 0.91],
    [0.132, 0.98],
    [0.075, 1.06],
    [0.012, 1.11],
  ];
  const segs = 12;
  const pos: number[] = [];
  const idx: number[] = [];

  for (const [r, ax] of rings) {
    for (let k = 0; k < segs; k++) {
      const ang = (k / segs) * Math.PI * 2;
      pos.push(side * ax, Math.sin(ang) * r, Math.cos(ang) * r);
    }
  }
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let k = 0; k < segs; k++) {
      const kn = (k + 1) % segs;
      const a = ri * segs + k;
      const b = ri * segs + kn;
      const c = (ri + 1) * segs + kn;
      const d = (ri + 1) * segs + k;
      if (side > 0) idx.push(a, b, c, a, c, d);
      else idx.push(a, d, c, a, c, b);
    }
  }

  return { positions: new Float32Array(pos), indices: new Uint16Array(idx) };
}

function attachMorphTarget(mesh: ThreeObjectLike | null, morphData: Float32Array) {
  const geo = mesh?.geometry;
  const posAttr = geo?.attributes?.position;
  if (!mesh || !geo || !posAttr) return;
  const AttrCtor = posAttr.constructor;
  geo.morphAttributes = geo.morphAttributes ?? {};
  geo.morphAttributes.position = [new AttrCtor(morphData, 3)];
  geo.computeVertexNormals?.();
  mesh.updateMorphTargets?.();
}

const STARDUST_COORDS: Array<[number, number, number, number, boolean]> = [
  [-1.26, 0.58, 0.16, 0.044, true],
  [-1.08, -0.22, 0.22, 0.052, false],
  [-0.92, 0.16, -0.2, 0.032, false],
  [-1.32, -0.58, 0.05, 0.036, true],
  [1.24, 0.34, 0.14, 0.044, false],
  [1.3, -0.28, -0.1, 0.046, false],
  [0.84, -0.78, 0.22, 0.054, true],
  [0.46, -0.96, 0.16, 0.04, false],
  [-0.22, 1.32, -0.08, 0.036, false],
  [0.32, 1.28, 0.14, 0.044, true],
  [-0.98, 1.06, -0.14, 0.034, false],
  [1.12, -0.82, 0.12, 0.036, false],
  [-0.35, -1.32, -0.14, 0.038, true],
  [1.42, 0.04, -0.2, 0.034, false],
];

function PapyrusSplashScene() {
  const elapsedRef = useRef(0);
  const rootRef = useRef<ThreeObjectLike | null>(null);
  const emblemRef = useRef<ThreeObjectLike | null>(null);
  const parchmentRef = useRef<ThreeObjectLike | null>(null);
  const ribbonRef = useRef<ThreeObjectLike | null>(null);
  const finialsRef = useRef<ThreeObjectLike | null>(null);
  const leftFinialRef = useRef<ThreeObjectLike | null>(null);
  const rightFinialRef = useRef<ThreeObjectLike | null>(null);
  const starburstRef = useRef<ThreeObjectLike | null>(null);
  const outerRingRef = useRef<ThreeObjectLike | null>(null);
  const innerRingRef = useRef<ThreeObjectLike | null>(null);
  const starsRef = useRef<ThreeObjectLike | null>(null);
  const sweepLightRef = useRef<ThreeObjectLike | null>(null);

  const parchmentData = useMemo(() => buildParchmentMorphArrays(), []);
  const ribbonData = useMemo(() => buildCosmicRibbonMorphArrays(), []);
  const starburstData = useMemo(() => buildStarburstArrays(), []);
  const leftFinialData = useMemo(() => buildFinialArrays(-1), []);
  const rightFinialData = useMemo(() => buildFinialArrays(1), []);

  useEffect(() => {
    attachMorphTarget(parchmentRef.current, parchmentData.morph);
    attachMorphTarget(ribbonRef.current, ribbonData.morph);
    leftFinialRef.current?.geometry?.computeVertexNormals?.();
    rightFinialRef.current?.geometry?.computeVertexNormals?.();
    starburstRef.current?.geometry?.computeVertexNormals?.();

    const root = rootRef.current;
    return () => {
      if (root) disposeThreeHierarchy(root);
    };
  }, [parchmentData.morph, ribbonData.morph]);

  useFrame((state, delta) => {
    const clampedDelta = Math.min(delta, 0.1);
    elapsedRef.current += clampedDelta;
    const frame = computeSplashMorphState(elapsedRef.current);

    state.camera.position.z = frame.cameraZ;
    state.camera.lookAt(0, 0.02, 0);

    // Real GPU Shape-Key Morph Target influences (0 = Ancient Scroll -> 1 = Papyrus "P" Logo)
    if (parchmentRef.current?.morphTargetInfluences) {
      parchmentRef.current.morphTargetInfluences[0] = frame.morphInfluence;
    }
    if (ribbonRef.current?.morphTargetInfluences) {
      ribbonRef.current.morphTargetInfluences[0] = frame.morphInfluence;
    }

    if (emblemRef.current) {
      emblemRef.current.rotation.y = frame.spinY;
      emblemRef.current.position.y = frame.floatY;
      emblemRef.current.scale.setScalar(frame.emblemScale);
    }

    if (finialsRef.current) {
      finialsRef.current.scale.setScalar(frame.finialScale);
      finialsRef.current.visible = frame.finialScale > 0.01;
    }

    if (starburstRef.current) {
      starburstRef.current.scale.setScalar(frame.starburstScale);
      starburstRef.current.rotation.z = Math.sin(elapsedRef.current * 2.2) * 0.12;
      starburstRef.current.visible = frame.starburstScale > 0.01;
    }

    if (outerRingRef.current) {
      outerRingRef.current.scale.setScalar(frame.ringsScale);
      outerRingRef.current.rotation.z = elapsedRef.current * 0.72;
    }

    if (innerRingRef.current) {
      innerRingRef.current.scale.setScalar(frame.ringsScale);
      innerRingRef.current.rotation.z = -elapsedRef.current * 0.94;
    }

    if (starsRef.current) {
      starsRef.current.scale.setScalar(0.35 + 0.65 * frame.ringsScale);
      starsRef.current.rotation.y = elapsedRef.current * 0.34;
    }

    if (sweepLightRef.current) {
      const r = 3.2;
      sweepLightRef.current.position.set(
        Math.cos(frame.rimSweepAngle) * r,
        1.15 + Math.sin(frame.rimSweepAngle * 0.5) * 0.8,
        Math.sin(frame.rimSweepAngle) * 1.4 + 2.2,
      );
      sweepLightRef.current.intensity = 2.6 + frame.morphInfluence * 1.8;
    }
  });

  const scrollTiltZ = (-11 * Math.PI) / 180;

  return (
    <group ref={rootRef as never}>
      <ambientLight intensity={0.85} color="#C7D2FE" />
      <directionalLight position={[2.6, 3.2, 4.4]} intensity={2.1} color="#FFF3D6" />
      <pointLight ref={sweepLightRef as never} position={[2.2, 1.4, 2.8]} intensity={3.2} color="#FDE68A" />
      <pointLight position={[-3.0, 2.0, -1.6]} intensity={3.6} color="#6D4AFF" />
      <pointLight position={[1.8, -2.2, 2.0]} intensity={2.4} color="#D946EF" />

      <group ref={emblemRef as never}>
        {/* 1. Morphing Champagne Parchment Scroll */}
        <mesh ref={parchmentRef as never}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[parchmentData.basis, 3]} />
            <bufferAttribute attach="attributes-color" args={[parchmentData.colors, 3]} />
            <bufferAttribute attach="index" args={[parchmentData.indices, 1]} />
          </bufferGeometry>
          <meshStandardMaterial
            vertexColors
            metalness={0.08}
            roughness={0.44}
            emissive="#F6C358"
            emissiveIntensity={0.28}
          />
        </mesh>

        {/* 2. Morphing Cosmic Indigo-Violet-Magenta "P" Ribbon */}
        <mesh ref={ribbonRef as never}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[ribbonData.basis, 3]} />
            <bufferAttribute attach="attributes-color" args={[ribbonData.colors, 3]} />
            <bufferAttribute attach="index" args={[ribbonData.indices, 1]} />
          </bufferGeometry>
          <meshStandardMaterial
            vertexColors
            metalness={0.38}
            roughness={0.2}
            emissive="#6D4AFF"
            emissiveIntensity={0.42}
          />
        </mesh>

        {/* 3. Liquid Gold Turned Roller Finials */}
        <group ref={finialsRef as never} rotation={[0, 0, scrollTiltZ]}>
          <mesh ref={leftFinialRef as never}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[leftFinialData.positions, 3]} />
              <bufferAttribute attach="index" args={[leftFinialData.indices, 1]} />
            </bufferGeometry>
            <meshStandardMaterial
              color="#F5B82E"
              metalness={0.9}
              roughness={0.18}
              emissive="#D97706"
              emissiveIntensity={0.18}
            />
          </mesh>
          <mesh ref={rightFinialRef as never}>
            <bufferGeometry>
              <bufferAttribute attach="attributes-position" args={[rightFinialData.positions, 3]} />
              <bufferAttribute attach="index" args={[rightFinialData.indices, 1]} />
            </bufferGeometry>
            <meshStandardMaterial
              color="#F5B82E"
              metalness={0.9}
              roughness={0.18}
              emissive="#D97706"
              emissiveIntensity={0.18}
            />
          </mesh>
        </group>

        {/* 4. Signature Golden-White 8-Ray Starburst Flare */}
        <mesh ref={starburstRef as never} position={[0.76, 0.78, 0.3]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[starburstData.positions, 3]} />
            <bufferAttribute attach="index" args={[starburstData.indices, 1]} />
          </bufferGeometry>
          <meshBasicMaterial color="#FFFBEB" toneMapped={false} />
        </mesh>
      </group>

      {/* 5. Dual AI Neural Orbital Rings */}
      <mesh ref={outerRingRef as never} rotation={[1.12, 0.38, 0]}>
        <torusGeometry args={[1.48, 0.015, 8, 44]} />
        <meshStandardMaterial
          color="#7C3AED"
          emissive="#8B5CF6"
          emissiveIntensity={1.25}
          metalness={0.48}
          roughness={0.18}
        />
      </mesh>
      <mesh ref={innerRingRef as never} rotation={[-0.98, -0.42, 0]}>
        <torusGeometry args={[1.24, 0.012, 8, 40]} />
        <meshStandardMaterial
          color="#F59E0B"
          emissive="#FBBF24"
          emissiveIntensity={0.85}
          metalness={0.88}
          roughness={0.18}
        />
      </mesh>

      {/* 6. Floating 4-Point Cosmic Stardust Diamonds */}
      <group ref={starsRef as never}>
        {STARDUST_COORDS.map(([x, y, z, sz, isGold], idx) => (
          <mesh key={idx} position={[x, y, z]} scale={[sz * 0.75, sz * 1.35, sz * 0.75]}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={isGold ? '#FDE68A' : '#C4B5FD'}
              emissive={isGold ? '#FBBF24' : '#A78BFA'}
              emissiveIntensity={1.4}
              roughness={0.15}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default function PapyrusSplashCanvas() {
  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.02, 5.45], fov: 36 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
      style={{ width: '100%', height: '100%' }}
    >
      <PapyrusSplashScene />
    </Canvas>
  );
}
