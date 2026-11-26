import { writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// GLTFExporter uses FileReader for the binary Blob even when there are no images.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend();
    });
  }
};

const scroll = new THREE.Group();
scroll.name = 'Royal Papyrus Scroll';
const brass = new THREE.MeshStandardMaterial({
  name: 'Antique brass', color: '#c28b43', metalness: 0.52, roughness: 0.3,
  emissive: '#43270e', emissiveIntensity: 0.28,
});
const wood = new THREE.MeshStandardMaterial({
  name: 'Dark walnut', color: '#532a22', roughness: 0.68,
});
const jade = new THREE.MeshStandardMaterial({
  name: 'Green enamel', color: '#226b60', metalness: 0.28, roughness: 0.27,
});
const paper = new THREE.MeshStandardMaterial({
  name: 'Papyrus fibers', vertexColors: true, roughness: 0.92, side: THREE.DoubleSide,
});
const ink = new THREE.MeshStandardMaterial({
  name: 'Sepia ink and gilt', vertexColors: true, roughness: 0.85, side: THREE.DoubleSide,
});

function paperDepth(x, y) {
  return 0.08 + 0.045 * Math.cos(x * 2.8) + 0.18 * Math.pow(Math.abs(y) / 0.68, 5)
    + 0.018 * Math.sin(7 * x + 2 * y);
}

const sheet = new THREE.PlaneGeometry(1.77, 1.36, 16, 14);
const vertices = sheet.getAttribute('position');
const colors = [];
const centerColor = new THREE.Color('#f6db9e');
const edgeColor = new THREE.Color('#be7d41');
for (let i = 0; i < vertices.count; i++) {
  const x = vertices.getX(i);
  const y = vertices.getY(i);
  const edge = Math.pow(Math.max(Math.abs(x) / 0.885, Math.abs(y) / 0.68), 9);
  const grain = 0.95 + 0.055 * Math.sin(41 * x + 5 * y) * Math.cos(37 * y - 3 * x);
  const raggedEdge = x + Math.sign(x) * edge * (0.004 * Math.sin(y * 71) + 0.003 * Math.cos(y * 39));
  vertices.setXYZ(i, raggedEdge, y, paperDepth(x, y));
  centerColor.clone().lerp(edgeColor, edge * 0.68).multiplyScalar(grain).toArray(colors, i * 3);
}
sheet.setAttribute('color', new THREE.Uint8BufferAttribute(colors.map((value) => Math.round(value * 255)), 3, true));
sheet.computeVertexNormals();
scroll.add(new THREE.Mesh(sheet, paper));

const decorations = [];
function drawLine(points, width, color) {
  const positions = [];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const length = Math.hypot(x2 - x1, y2 - y1);
    const dx = (y2 - y1) * width / (2 * length);
    const dy = (x1 - x2) * width / (2 * length);
    for (const [x, y] of [
      [x1 + dx, y1 + dy], [x1 - dx, y1 - dy], [x2 - dx, y2 - dy],
      [x1 + dx, y1 + dy], [x2 - dx, y2 - dy], [x2 + dx, y2 + dy],
    ]) {
      positions.push(x, y, paperDepth(x, y) + 0.006);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const rgb = color.toArray().map((value) => Math.round(value * 255));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(
    Array.from({ length: positions.length / 3 }, () => rgb).flat(), 3, true,
  ));
  geometry.computeVertexNormals();
  decorations.push(geometry);
}

const sepia = new THREE.Color('#65443a');
const gilt = new THREE.Color('#9a5f24');
const teal = new THREE.Color('#27675c');
for (const side of [-1, 1]) {
  const x = side * 0.77;
  drawLine(Array.from({ length: 13 }, (_, i) => [x, -0.49 + i * (0.98 / 12)]), 0.012, gilt);
  for (const y of [-0.49, 0.49]) {
    drawLine([[x, y], [side * 0.62, y], [side * 0.56, y * 0.9]], 0.015, gilt);
  }
  for (let i = 0; i < 7; i++) {
    const y = 0.27 - i * 0.088;
    const inner = 0.36 + (i % 3) * 0.05;
    drawLine([[side * inner, y], [side * 0.54, y], [side * 0.65, y]], 0.013, i === 0 ? teal : sepia);
    drawLine([[side * 0.69, y], [side * 0.72, y]], 0.013, gilt);
  }
}

function orbit(radiusX, radiusY, rotation, color) {
  const points = Array.from({ length: 33 }, (_, i) => {
    const a = i * Math.PI / 16;
    const x = Math.cos(a) * radiusX;
    const y = Math.sin(a) * radiusY;
    return [x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation)];
  });
  drawLine(points, 0.012, color);
}
orbit(0.31, 0.31, 0, gilt);
orbit(0.24, 0.095, Math.PI / 3, teal);
orbit(0.24, 0.095, -Math.PI / 3, teal);
drawLine([[0, 0.12], [0.04, 0.04], [0.12, 0], [0.04, -0.04], [0, -0.12],
  [-0.04, -0.04], [-0.12, 0], [-0.04, 0.04], [0, 0.12]], 0.018, sepia);
const engraving = mergeGeometries(decorations);
for (const decoration of decorations) decoration.dispose();
scroll.add(new THREE.Mesh(engraving, ink));

function roller(y) {
  const pieces = new Map();
  function add(material, x, length, outer, inner = outer, open = true) {
    const geometry = new THREE.CylinderGeometry(outer, inner, length, 12, 1, open);
    geometry.rotateZ(-Math.PI / 2);
    geometry.translate(x, y, 0.21);
    const parts = pieces.get(material) ?? [];
    parts.push(geometry);
    pieces.set(material, parts);
  }
  add(wood, 0, 1.97, 0.083);
  add(paper, 0, 1.75, 0.107);
  for (const sign of [-1, 1]) {
    add(brass, sign * 0.84, 0.045, 0.118);
    add(jade, sign * 0.92, 0.108, 0.1);
    add(brass, sign * 1.01, 0.075, 0.127);
    add(brass, sign * 1.055, 0.04, sign === 1 ? 0.075 : 0.127, sign === 1 ? 0.127 : 0.075, false);
  }
  for (const [material, parts] of pieces) {
    const geometry = mergeGeometries(parts);
    if (material === paper) {
      const count = geometry.getAttribute('position').count;
      const rgb = new THREE.Color('#d1a561').toArray().map((value) => Math.round(value * 255));
      geometry.setAttribute('color', new THREE.Uint8BufferAttribute(
        Array.from({ length: count }, () => rgb).flat(), 3, true,
      ));
    }
    scroll.add(new THREE.Mesh(geometry, material));
    for (const part of parts) part.dispose();
  }
}
roller(-0.67);
roller(0.67);

const seal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.043, 0), brass);
seal.position.set(0, 0, paperDepth(0, 0) + 0.015);
seal.scale.z = 0.45;
scroll.add(seal);

const bytes = await new GLTFExporter().parseAsync(scroll, { binary: true });
await writeFile(new URL('../assets/models/royal_papyrus_scroll.glb', import.meta.url), Buffer.from(bytes));
const data = Buffer.from(bytes).toString('base64');
await writeFile(new URL('../src/shared/models3d/royalScroll.ts', import.meta.url),
  '// Generated by scripts/build-royal-scroll.mjs.\n'
  + `export const GLB_ROYAL_SCROLL_B64 = 'data:model/gltf-binary;base64,${data}';\n`);
