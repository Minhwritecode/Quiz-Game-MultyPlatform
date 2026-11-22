"""
Headless Blender 4.2 script to procedurally build, animate, and export the
Papyrus 2026 3D Splash Morph Asset (Ancient Scroll -> Iconic 3D Papyrus "P" Logo)
with real Shape Keys (Morph Targets), true sRGB->Linear PBR + vertex-gradient materials
matching assets/icon.png, and Draco-compressed glTF/GLB export.

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_splash_morph.py

Optional preview renders (3 beats):
  PAPYRUS_RENDER_PREVIEWS_DIR=/tmp/previews /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_splash_morph.py
"""

import base64
import math
import os
import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_GLB = os.path.join(ROOT, "assets", "models", "papyrus_splash_morph.glb")
OUT_TS = os.path.join(ROOT, "src", "shared", "models3d", "splashMorph.ts")
PREVIEW_DIR = os.environ.get("PAPYRUS_RENDER_PREVIEWS_DIR", "").strip()


def to_bl(x, y, z):
    """Map Three.js Y-up (x right, y up, z toward viewer) to Blender Z-up."""
    return Vector((x, -z, y))


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def srgb_to_linear_channel(c):
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_str, alpha=1.0):
    h = hex_str.lstrip("#")
    r = int(h[0:2], 16) / 255.0
    g = int(h[2:4], 16) / 255.0
    b = int(h[4:6], 16) / 255.0
    return (
        srgb_to_linear_channel(r),
        srgb_to_linear_channel(g),
        srgb_to_linear_channel(b),
        alpha,
    )


def mix_rgba(c1, c2, t):
    return (
        lerp(c1[0], c2[0], t),
        lerp(c1[1], c2[1], t),
        lerp(c1[2], c2[2], t),
        lerp(c1[3], c2[3], t),
    )


def catmull_rom(points, t):
    """Evaluate open uniform Catmull-Rom spline at t in [0, 1]."""
    n = len(points)
    if n < 2:
        return points[0].copy()
    scaled = max(0.0, min(1.0, t)) * (n - 1)
    idx = min(int(scaled), n - 2)
    u = scaled - idx
    p0 = points[max(0, idx - 1)]
    p1 = points[idx]
    p2 = points[idx + 1]
    p3 = points[min(n - 1, idx + 2)]
    u2 = u * u
    u3 = u2 * u
    return 0.5 * (
        (2.0 * p1)
        + (-p0 + p2) * u
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u2
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u3
    )


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_pbr_material(
    name,
    base_color,
    metallic=0.1,
    roughness=0.35,
    emission=None,
    emission_strength=0.0,
    coat_weight=0.0,
    use_vertex_color=None,
    emission_from_vcol=False,
):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = coat_weight
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.55
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        if use_vertex_color:
            vcol = nt.nodes.new("ShaderNodeVertexColor")
            vcol.layer_name = use_vertex_color
            nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])
            if emission_from_vcol and "Emission Color" in bsdf.inputs:
                nt.links.new(vcol.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def set_smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True


def create_mesh_with_shape_key(name, basis_verts, morph_verts, faces, vcols=None, material=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in basis_verts], [], faces)
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    set_smooth(obj)

    if vcols is not None:
        col_attr = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="CORNER")
        for poly in mesh.polygons:
            for loop_idx in poly.loop_indices:
                vert_idx = mesh.loops[loop_idx].vertex_index
                col_attr.data[loop_idx].color = vcols[vert_idx]

    if material is not None:
        mesh.materials.append(material)

    obj.shape_key_add(name="Basis", from_mix=False)
    sk = obj.shape_key_add(name="Morph_To_Emblem", from_mix=False)
    for i, mv in enumerate(morph_verts):
        sk.data[i].co = mv
    sk.value = 0.0
    return obj, sk


# ---------------------------------------------------------------------------
# 1. Parchment Scroll Mesh
#    Basis: Rolled Ancient Papyrus Scroll (horizontal 2.1-turn spiral)
#    Morph: Exact Golden Slanted Parchment with Smooth Spiral Curls (assets/icon.png)
# ---------------------------------------------------------------------------
def build_parchment_scroll(mat_parchment):
    nu = 36  # smooth resolution along top curl -> vertical shaft -> bottom curl
    nv = 8   # across strip width

    # Developable uncreased scroll basis frame (ZERO twist singularity!):
    # Constant width axis W angled slightly toward viewer-left so both top & bottom
    # hollow spiral openings face the camera naturally just like assets/icon.png.
    w_axis = Vector((0.86, -0.10, -0.50)).normalized()
    up_axis = Vector((0.15, 0.985, 0.08)).normalized()
    # Orthonormalize (up_axis, front_axis) perpendicular to w_axis
    up_axis = (up_axis - w_axis * up_axis.dot(w_axis)).normalized()
    front_axis = w_axis.cross(up_axis).normalized()

    def eval_basis(u, v):
        turns = 2.05
        theta = u * turns * math.tau + 0.35
        r = 0.14 + 0.145 * u
        x_local = v * 1.56
        y_local = math.sin(theta) * r
        z_local = math.cos(theta) * r
        tilt = math.radians(-11.0)
        x = x_local * math.cos(tilt) - y_local * math.sin(tilt)
        y = x_local * math.sin(tilt) + y_local * math.cos(tilt)
        return Vector((x, y, z_local))

    def eval_morph(u, v):
        # Smooth developable paper profile (y_2d, z_2d) in the (up_axis, front_axis) plane:
        #   u in [0.00, 0.28]: Top spiral curl (1.15 turns rolling forward & inward)
        #   u in [0.28, 0.72]: Illuminated vertical shaft with gentle S-curve + edge notches
        #   u in [0.72, 1.00]: Bottom spiral curl (1.15 turns rolling forward & inward)
        if u < 0.28:
            t = 1.0 - (u / 0.28)  # 0 at shaft top -> 1 at inner spiral tip
            angle = -math.pi * 0.5 + t * 1.18 * math.tau
            rad = lerp(0.21, 0.085, t)
            cy, cz = 0.62, 0.18
            py = cy + math.sin(angle) * rad
            pz = cz + math.cos(angle) * rad
        elif u > 0.72:
            t = (u - 0.72) / 0.28  # 0 at shaft bottom -> 1 at inner spiral tip
            angle = math.pi * 0.5 - t * 1.18 * math.tau
            rad = lerp(0.20, 0.082, t)
            cy, cz = -0.66, 0.18
            py = cy + math.sin(angle) * rad
            pz = cz + math.cos(angle) * rad
        else:
            s = (u - 0.28) / 0.44  # 0 top -> 1 bottom
            py = lerp(0.62 - 0.21, -0.66 + 0.20, s)
            # Connects smoothly at z = cz - rad ≈ -0.02 with gentle front bulge
            pz = -0.03 + math.sin(s * math.pi) * 0.055

        # Subtle antique parchment edge notches matching assets/icon.png
        notch_in = 0.0
        if 0.39 < u < 0.46 and v < -0.20:
            notch_in = 0.085 * (1.0 - abs(u - 0.425) / 0.035) * max(0.0, (-v - 0.20) / 0.30)
        if 0.48 < u < 0.55 and v > 0.20:
            notch_in = -0.085 * (1.0 - abs(u - 0.515) / 0.035) * max(0.0, (v - 0.20) / 0.30)

        strip_width = 0.64
        origin = Vector((-0.24, -0.02, -0.04))
        return origin + up_axis * py + front_axis * pz + w_axis * (v * strip_width + notch_in)

    thickness = 0.034
    eps = 0.004

    def grid_positions(eval_fn, side_sign):
        pts = []
        for iu in range(nu + 1):
            u = iu / nu
            for iv in range(nv + 1):
                v = (iv / nv) - 0.5
                p = eval_fn(u, v)
                pu = eval_fn(min(1.0, u + eps), v) - eval_fn(max(0.0, u - eps), v)
                pv = eval_fn(u, min(0.5, v + eps)) - eval_fn(u, max(-0.5, v - eps))
                n = pu.cross(pv)
                n = n.normalized() if n.length > 1e-6 else Vector((0.0, 0.0, 1.0))
                pts.append(to_bl(*(p + n * (side_sign * thickness * 0.5))))
        return pts

    basis_verts = grid_positions(eval_basis, 1.0) + grid_positions(eval_basis, -1.0)
    morph_verts = grid_positions(eval_morph, 1.0) + grid_positions(eval_morph, -1.0)

    # Rich luminous golden parchment colors converted cleanly sRGB -> linear
    c_cream = hex_to_linear("#FFF6CE")
    c_gold = hex_to_linear("#F6C358")
    c_amber = hex_to_linear("#C67C28")

    vcols = []
    for side in (0, 1):
        for iu in range(nu + 1):
            u = iu / nu
            curl_w = max(1.0 - smoothstep(0.14, 0.32, u), smoothstep(0.68, 0.86, u))
            for iv in range(nv + 1):
                v = (iv / nv) - 0.5
                edge_w = min(1.0, abs(v) * 2.0) ** 1.5
                warmth = min(1.0, max(curl_w * 0.78, edge_w * 0.58) + (0.22 if side == 1 else 0.0))
                col = mix_rgba(c_cream, c_gold, min(1.0, warmth * 1.4)) if warmth < 0.65 else mix_rgba(c_gold, c_amber, (warmth - 0.65) / 0.35)
                vcols.append(col)

    stride = nv + 1
    back_offset = (nu + 1) * (nv + 1)
    faces = []
    for iu in range(nu):
        for iv in range(nv):
            a = iu * stride + iv
            b = a + 1
            c = (iu + 1) * stride + iv + 1
            d = (iu + 1) * stride + iv
            faces.append((a, b, c, d))
            faces.append((back_offset + d, back_offset + c, back_offset + b, back_offset + a))

    for iv in range(nv):
        a, b = iv, iv + 1
        faces.append((a, back_offset + a, back_offset + b, b))
        a2, b2 = nu * stride + iv, nu * stride + iv + 1
        faces.append((a2, b2, back_offset + b2, back_offset + a2))
    for iu in range(nu):
        a, d = iu * stride, (iu + 1) * stride
        faces.append((a, d, back_offset + d, back_offset + a))
        b, c = iu * stride + nv, (iu + 1) * stride + nv
        faces.append((b, back_offset + b, back_offset + c, c))

    return create_mesh_with_shape_key(
        "Papyrus_Parchment_Scroll", basis_verts, morph_verts, faces, vcols=vcols, material=mat_parchment
    )


# ---------------------------------------------------------------------------
# 2. Cosmic "P" Ribbon Mesh
#    Basis: Royal Indigo-Violet Ceremonial Seal Band coiled around scroll waist
#    Morph: Glossy Sculpted 3D Papyrus "P" Ribbon matching assets/icon.png
# ---------------------------------------------------------------------------
def build_cosmic_p_ribbon(mat_ribbon):
    ns = 56  # segments along ribbon path
    nc = 8   # wide beveled aerodynamic strap profile

    # Wide chamfered strap cross-section (sleek crisp bevel edges that catch rim light!)
    profile = [
        (0.54, 0.13),
        (0.38, 0.25),
        (-0.38, 0.25),
        (-0.54, 0.13),
        (-0.54, -0.13),
        (-0.38, -0.25),
        (0.38, -0.25),
        (0.54, -0.13),
    ]

    # Sculptural 3D centerline mirroring assets/icon.png's iconic sweeping "P"
    p_control = [
        Vector((-0.62, 0.42, -0.18)),   # t=0.00 inner bottom of top-left hood
        Vector((-0.94, 0.64, 0.04)),    # t=0.10 left curved hood around top golden curl
        Vector((-0.76, 0.98, 0.14)),    # t=0.20 top-left shoulder crest
        Vector((-0.14, 1.06, 0.16)),    # t=0.32 soaring top arch
        Vector((0.54, 0.98, 0.20)),     # t=0.44 upper-right brow
        Vector((0.90, 0.66, 0.22)),     # t=0.54 upper-right starburst shoulder
        Vector((0.96, 0.16, 0.18)),     # t=0.64 outer-right bowl of P
        Vector((0.60, -0.18, 0.28)),    # t=0.73 lower-right curve turning inward
        Vector((-0.12, -0.26, 0.34)),   # t=0.82 weaving across FRONT of golden parchment
        Vector((-0.76, -0.54, 0.22)),   # t=0.90 descending left curve
        Vector((-0.72, -1.00, 0.06)),   # t=0.96 bottom teardrop cradle under lower gold curl
        Vector((-0.16, -0.94, -0.14)),  # t=1.00 elegant rear tuck cradling lower stem
    ]

    def sample_frame_along(pts, widths, thicks, twists):
        verts = []
        n = len(pts)
        prev_n = Vector((0.0, 0.0, 1.0))
        for i in range(n):
            p = pts[i]
            if i == 0:
                tang = (pts[1] - pts[0]).normalized()
            elif i == n - 1:
                tang = (pts[-1] - pts[-2]).normalized()
            else:
                tang = (pts[i + 1] - pts[i - 1]).normalized()
            ref = prev_n - tang * prev_n.dot(tang)
            if ref.length < 1e-4:
                alt = Vector((0.0, 1.0, 0.0)) if abs(tang.y) < 0.85 else Vector((1.0, 0.0, 0.0))
                ref = alt - tang * alt.dot(tang)
            ref.normalize()
            prev_n = ref
            binorm = tang.cross(ref).normalized()

            tw = twists[i]
            ct, st = math.cos(tw), math.sin(tw)
            n_dir = ref * ct + binorm * st
            b_dir = -ref * st + binorm * ct

            w = widths[i]
            th = thicks[i]
            for px, py in profile:
                pos = p + b_dir * (px * w) + n_dir * (py * th)
                verts.append(to_bl(*pos))
        return verts

    # Basis: Royal indigo ceremonial seal coiled cleanly around scroll waist
    basis_pts, basis_w, basis_th, basis_tw = [], [], [], []
    tilt = math.radians(-11.0)
    for i in range(ns + 1):
        t = i / ns
        theta = (t - 0.5) * 1.32 * math.tau + 0.12
        r = 0.312
        x_l = (t - 0.5) * 0.26
        y_l = math.sin(theta) * r
        z_l = math.cos(theta) * r
        x = x_l * math.cos(tilt) - y_l * math.sin(tilt)
        y = x_l * math.sin(tilt) + y_l * math.cos(tilt)
        basis_pts.append(Vector((x, y, z_l)))
        taper = 0.74 + 0.26 * math.sin(t * math.pi)
        basis_w.append(0.19 * taper)
        basis_th.append(0.055 * taper)
        basis_tw.append(0.0)

    # Morph: Wide glossy sculptural "P" ribbon
    morph_pts, morph_w, morph_th, morph_tw = [], [], [], []
    for i in range(ns + 1):
        t = i / ns
        morph_pts.append(catmull_rom(p_control, t))
        end_taper = smoothstep(0.0, 0.09, t) * (1.0 - 0.38 * smoothstep(0.88, 1.0, t))
        arch_swell = 1.0 + 0.28 * math.sin(t * math.pi)
        morph_w.append(0.34 * end_taper * arch_swell)
        morph_th.append(0.14 * (0.68 + 0.32 * end_taper))
        morph_tw.append(math.sin(t * math.pi * 2.0) * 0.26 + 0.14)

    basis_verts = sample_frame_along(basis_pts, basis_w, basis_th, basis_tw)
    morph_verts = sample_frame_along(morph_pts, morph_w, morph_th, morph_tw)

    # True sRGB->Linear jewel palette matching assets/icon.png:
    # Royal Indigo (#3B38D4) -> Deep Electric Violet (#6D28D9) -> Vibrant Magenta Rim (#C026D3)
    c_periwinkle = hex_to_linear("#607BFF")
    c_indigo = hex_to_linear("#352DC8")
    c_violet = hex_to_linear("#6D28D9")
    c_magenta = hex_to_linear("#D946EF")

    vcols = []
    for i in range(ns + 1):
        t = i / ns
        body_col = mix_rgba(c_indigo, c_violet, smoothstep(0.08, 0.92, t))
        for j in range(nc):
            if j in (1, 2):
                col = mix_rgba(body_col, c_periwinkle, 0.42)
            elif j in (5, 6):
                col = mix_rgba(c_violet, c_magenta, 0.65 + 0.32 * t)
            else:
                col = body_col
            vcols.append(col)

    faces = []
    for i in range(ns):
        for j in range(nc):
            jn = (j + 1) % nc
            a = i * nc + j
            b = i * nc + jn
            c = (i + 1) * nc + jn
            d = (i + 1) * nc + j
            faces.append((a, b, c, d))

    faces.append(tuple(range(nc - 1, -1, -1)))
    end_base = ns * nc
    faces.append(tuple(range(end_base, end_base + nc)))

    return create_mesh_with_shape_key(
        "Cosmic_P_Ribbon", basis_verts, morph_verts, faces, vcols=vcols, material=mat_ribbon
    )


# ---------------------------------------------------------------------------
# 3. Liquid Gold Scroll Roller Finials
# ---------------------------------------------------------------------------
def build_gold_finials(mat_gold):
    tilt = math.radians(-11.0)
    finials = []
    for side, name in [(-1.0, "Gold_Roller_Left"), (1.0, "Gold_Roller_Right")]:
        rings = [
            (0.055, 0.76),
            (0.145, 0.80),
            (0.162, 0.85),
            (0.095, 0.91),
            (0.132, 0.98),
            (0.075, 1.06),
            (0.012, 1.11),
        ]
        segs = 12
        verts = []
        faces = []
        for r, ax in rings:
            for k in range(segs):
                ang = (k / segs) * math.tau
                x_l = side * ax
                y_l = math.sin(ang) * r
                z_l = math.cos(ang) * r
                x = x_l * math.cos(tilt) - y_l * math.sin(tilt)
                y = x_l * math.sin(tilt) + y_l * math.cos(tilt)
                verts.append(to_bl(x, y, z_l))
        for ri in range(len(rings) - 1):
            for k in range(segs):
                kn = (k + 1) % segs
                a = ri * segs + k
                b = ri * segs + kn
                c = (ri + 1) * segs + kn
                d = (ri + 1) * segs + k
                faces.append((a, b, c, d) if side > 0 else (a, d, c, b))
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata([tuple(v) for v in verts], [], faces)
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        set_smooth(obj)
        mesh.materials.append(mat_gold)
        finials.append(obj)
    return finials


# ---------------------------------------------------------------------------
# 4. Crisp 8-Ray Golden-White Starburst Flare (Upper-Right Shoulder of "P")
# ---------------------------------------------------------------------------
def build_starburst_flare(mat_star):
    verts = []
    faces = []

    def add_spike(dx, dy, dz, length, half_w):
        base = len(verts)
        d = Vector((dx, dy, dz)).normalized()
        up = Vector((0.0, 0.0, 1.0)) if abs(d.z) < 0.9 else Vector((1.0, 0.0, 0.0))
        u = d.cross(up).normalized() * half_w
        v = d.cross(u).normalized() * (half_w * 0.65)
        pts = [d * length, u, v, -u, -v, -d * (length * 0.14)]
        for p in pts:
            verts.append(to_bl(*p))
        for k in range(4):
            kn = (k + 1) % 4
            faces.append((base + 0, base + 1 + k, base + 1 + kn))
            faces.append((base + 5, base + 1 + kn, base + 1 + k))

    # Symmetrical razor-crisp cardinal + diagonal lens flare rays matching assets/icon.png
    add_spike(0, 1, 0, 0.64, 0.032)
    add_spike(0, -1, 0, 0.56, 0.030)
    add_spike(1, 0, 0, 0.60, 0.032)
    add_spike(-1, 0, 0, 0.48, 0.028)
    diag = math.sqrt(0.5)
    for sx, sy in [(diag, diag), (-diag, diag), (diag, -diag), (-diag, -diag)]:
        add_spike(sx, sy, 0.08, 0.34, 0.020)

    mesh = bpy.data.meshes.new("Starburst_Flare")
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new("Starburst_Flare", mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = to_bl(0.76, 0.78, 0.30)
    mesh.materials.append(mat_star)
    return obj


# ---------------------------------------------------------------------------
# 5. Dual AI Neural Orbital Rings + Crisp 4-Point Cosmic Stardust Diamonds
# ---------------------------------------------------------------------------
def build_diamond_star(name, location, radius, mat):
    """Lightweight 8-triangle 4-point star diamond."""
    r = radius
    verts = [
        to_bl(0, r * 1.45, 0),
        to_bl(0, -r * 1.45, 0),
        to_bl(r * 0.85, 0, 0),
        to_bl(0, 0, r * 0.85),
        to_bl(-r * 0.85, 0, 0),
        to_bl(0, 0, -r * 0.85),
    ]
    faces = [
        (0, 2, 3), (0, 3, 4), (0, 4, 5), (0, 5, 2),
        (1, 3, 2), (1, 4, 3), (1, 5, 4), (1, 2, 5),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([tuple(v) for v in verts], [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    mesh.materials.append(mat)
    return obj


def build_neural_rings_and_stardust(mat_violet_ring, mat_gold_ring, mat_lavender_star, mat_gold_star):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.48,
        minor_radius=0.015,
        major_segments=36,
        minor_segments=6,
        location=(0, 0, 0),
    )
    ring_outer = bpy.context.active_object
    ring_outer.name = "AI_Neural_Ring_Outer"
    set_smooth(ring_outer)
    ring_outer.data.materials.append(mat_violet_ring)

    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.24,
        minor_radius=0.012,
        major_segments=32,
        minor_segments=6,
        location=(0, 0, 0),
    )
    ring_inner = bpy.context.active_object
    ring_inner.name = "AI_Neural_Ring_Inner"
    set_smooth(ring_inner)
    ring_inner.data.materials.append(mat_gold_ring)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    star_pivot = bpy.context.active_object
    star_pivot.name = "Cosmic_Stardust_Pivot"

    coords = [
        (-1.26, 0.58, 0.16, 0.044),
        (-1.08, -0.22, 0.22, 0.052),
        (-0.92, 0.16, -0.20, 0.032),
        (-1.32, -0.58, 0.05, 0.036),
        (1.24, 0.34, 0.14, 0.044),
        (1.30, -0.28, -0.10, 0.046),
        (0.84, -0.78, 0.22, 0.054),
        (0.46, -0.96, 0.16, 0.040),
        (-0.22, 1.32, -0.08, 0.036),
        (0.32, 1.28, 0.14, 0.044),
        (-0.98, 1.06, -0.14, 0.034),
        (1.12, -0.82, 0.12, 0.036),
        (-0.35, -1.32, -0.14, 0.038),
        (1.42, 0.04, -0.20, 0.034),
    ]
    for idx, (x, y, z, sz) in enumerate(coords):
        s_obj = build_diamond_star(
            f"Stardust_{idx + 1}",
            to_bl(x, y, z),
            sz,
            mat_gold_star if idx % 3 == 0 else mat_lavender_star,
        )
        s_obj.parent = star_pivot

    return ring_outer, ring_inner, star_pivot


# ---------------------------------------------------------------------------
# 6. Keyframe the 3-Beat PowerPoint Morph Timeline (Frames 1..90 @ 30fps)
# ---------------------------------------------------------------------------
def animate_powerpoint_morph(root_pivot, parchment_sk, ribbon_sk, finials, starburst, ring_outer, ring_inner, star_pivot):
    for sk in (parchment_sk, ribbon_sk):
        for frame, val in [(1, 0.0), (22, 0.04), (60, 1.0), (90, 1.0)]:
            sk.value = val
            sk.keyframe_insert(data_path="value", frame=frame)

    for frame, loc_z, rot_z, sc in [
        (1, -0.16, -0.24, 0.84),
        (22, 0.0, 0.08, 0.96),
        (60, 0.04, math.tau, 1.0),
        (75, 0.09, math.tau + 0.05, 1.02),
        (90, 0.04, math.tau, 1.0),
    ]:
        root_pivot.location = (0.0, 0.0, loc_z)
        root_pivot.rotation_euler = (0.0, 0.0, rot_z)
        root_pivot.scale = (sc, sc, sc)
        root_pivot.keyframe_insert(data_path="location", frame=frame)
        root_pivot.keyframe_insert(data_path="rotation_euler", frame=frame)
        root_pivot.keyframe_insert(data_path="scale", frame=frame)

    for fin in finials:
        for frame, sc in [(1, 1.0), (22, 1.0), (40, 0.001), (90, 0.001)]:
            fin.scale = (sc, sc, sc)
            fin.keyframe_insert(data_path="scale", frame=frame)

    for frame, sc, rot_y in [
        (1, 0.001, 0.0),
        (42, 0.001, 0.0),
        (60, 1.12, 0.0),
        (75, 0.96, 0.10),
        (90, 1.04, 0.0),
    ]:
        starburst.scale = (sc, sc, sc)
        starburst.rotation_euler = (0.0, rot_y, 0.0)
        starburst.keyframe_insert(data_path="scale", frame=frame)
        starburst.keyframe_insert(data_path="rotation_euler", frame=frame)

    for frame, sc, rx, ry, rz in [
        (1, 0.16, math.radians(64), math.radians(22), 0.0),
        (24, 0.34, math.radians(64), math.radians(22), 0.5),
        (60, 1.0, math.radians(66), math.radians(24), math.pi * 1.4),
        (90, 1.03, math.radians(68), math.radians(20), math.tau),
    ]:
        ring_outer.scale = (sc, sc, sc)
        ring_outer.rotation_euler = (rx, ry, rz)
        ring_outer.keyframe_insert(data_path="scale", frame=frame)
        ring_outer.keyframe_insert(data_path="rotation_euler", frame=frame)

    for frame, sc, rx, ry, rz in [
        (1, 0.12, math.radians(-56), math.radians(-26), 0.0),
        (24, 0.32, math.radians(-56), math.radians(-26), -0.4),
        (60, 1.0, math.radians(-58), math.radians(-24), -math.pi * 1.5),
        (90, 1.02, math.radians(-54), math.radians(-20), -math.tau),
    ]:
        ring_inner.scale = (sc, sc, sc)
        ring_inner.rotation_euler = (rx, ry, rz)
        ring_inner.keyframe_insert(data_path="scale", frame=frame)
        ring_inner.keyframe_insert(data_path="rotation_euler", frame=frame)

    for frame, sc, rz in [(1, 0.3, 0.0), (24, 0.65, 0.3), (60, 1.0, 1.2), (90, 1.0, 1.75)]:
        star_pivot.scale = (sc, sc, sc)
        star_pivot.rotation_euler = (0.0, 0.0, rz)
        star_pivot.keyframe_insert(data_path="scale", frame=frame)
        star_pivot.keyframe_insert(data_path="rotation_euler", frame=frame)

    for datablock in list(bpy.data.objects) + list(bpy.data.shape_keys):
        ad = getattr(datablock, "animation_data", None)
        if ad and ad.action:
            for fcurve in ad.action.fcurves:
                for kp in fcurve.keyframe_points:
                    kp.interpolation = "BEZIER"
                    kp.handle_left_type = "AUTO_CLAMPED"
                    kp.handle_right_type = "AUTO_CLAMPED"


# ---------------------------------------------------------------------------
# 7. Verification Renders (3 Beats)
# ---------------------------------------------------------------------------
def render_verification_previews(preview_dir):
    os.makedirs(preview_dir, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 36
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 640
    scene.render.resolution_y = 640
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("PapyrusCosmicWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = hex_to_linear("#060A24")
        bg.inputs["Strength"].default_value = 0.75

    cam_data = bpy.data.cameras.new("PreviewCam")
    cam_data.lens = 50
    cam_obj = bpy.data.objects.new("PreviewCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -4.65, 0.04)
    cam_obj.rotation_euler = (math.radians(90.0), 0.0, 0.0)
    scene.camera = cam_obj

    lights = [
        ("Key_Warm", "AREA", (2.2, -3.5, 2.4), (math.radians(54), 0.0, math.radians(32)), (1.0, 0.90, 0.70), 130.0, 1.9),
        ("Rim_Indigo", "AREA", (-2.8, 2.0, 2.2), (math.radians(118), 0.0, math.radians(-50)), (0.30, 0.22, 1.0), 260.0, 2.4),
        ("Fill_Magenta", "POINT", (1.6, -1.8, -2.0), (0, 0, 0), (0.85, 0.16, 0.94), 140.0, 1.0),
        ("Flare_Gold", "POINT", (0.9, -1.5, 1.0), (0, 0, 0), (1.0, 0.78, 0.25), 75.0, 0.4),
    ]
    for lname, ltype, loc, rot, col, energy, size in lights:
        ld = bpy.data.lights.new(lname, type=ltype)
        ld.color = col
        ld.energy = energy
        if ltype == "AREA":
            ld.size = size
        elif ltype == "POINT":
            ld.shadow_soft_size = size
        lo = bpy.data.objects.new(lname, ld)
        bpy.context.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = rot

    for frame, fname in [(10, "beat1_scroll.png"), (42, "beat2_morph_mid.png"), (72, "beat3_papyrus_logo.png")]:
        scene.frame_set(frame)
        scene.render.filepath = os.path.join(preview_dir, fname)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered preview frame {frame} -> {scene.render.filepath}")


def count_total_triangles():
    total = 0
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            for poly in obj.data.polygons:
                total += max(1, len(poly.vertices) - 2)
    return total


def build_splash_morph():
    reset_scene()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 90
    scene.render.fps = 30

    mat_parchment = make_pbr_material(
        "Papyrus_Champagne_Parchment",
        hex_to_linear("#F6C358"),
        metallic=0.08,
        roughness=0.44,
        emission=hex_to_linear("#FFDF85"),
        emission_strength=0.42,
        use_vertex_color="Color",
        emission_from_vcol=True,
    )
    mat_ribbon = make_pbr_material(
        "Cosmic_Indigo_Violet_Ribbon",
        hex_to_linear("#4F46E5"),
        metallic=0.38,
        roughness=0.22,
        emission=hex_to_linear("#6D4AFF"),
        emission_strength=0.45,
        coat_weight=0.38,
        use_vertex_color="Color",
        emission_from_vcol=True,
    )
    mat_gold = make_pbr_material(
        "Liquid_Gold_Finial",
        hex_to_linear("#F5B82E"),
        metallic=0.90,
        roughness=0.20,
        emission=hex_to_linear("#F59E0B"),
        emission_strength=0.24,
    )
    mat_star = make_pbr_material(
        "Golden_White_Starburst",
        hex_to_linear("#FFFBEB"),
        metallic=0.0,
        roughness=0.08,
        emission=hex_to_linear("#FDE68A"),
        emission_strength=5.5,
    )
    mat_violet_ring = make_pbr_material(
        "AI_Neural_Ring_Violet",
        hex_to_linear("#7C3AED"),
        metallic=0.45,
        roughness=0.18,
        emission=hex_to_linear("#8B5CF6"),
        emission_strength=1.9,
    )
    mat_gold_ring = make_pbr_material(
        "AI_Neural_Ring_Gold",
        hex_to_linear("#F59E0B"),
        metallic=0.88,
        roughness=0.18,
        emission=hex_to_linear("#FBBF24"),
        emission_strength=1.2,
    )
    mat_lavender_star = make_pbr_material(
        "Cosmic_Stardust_Lavender",
        hex_to_linear("#C4B5FD"),
        metallic=0.1,
        roughness=0.15,
        emission=hex_to_linear("#A78BFA"),
        emission_strength=2.4,
    )
    mat_gold_star = make_pbr_material(
        "Cosmic_Stardust_Gold",
        hex_to_linear("#FDE68A"),
        metallic=0.15,
        roughness=0.15,
        emission=hex_to_linear("#FBBF24"),
        emission_strength=2.6,
    )

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root_pivot = bpy.context.active_object
    root_pivot.name = "Papyrus_Splash_Root"

    parchment_obj, parchment_sk = build_parchment_scroll(mat_parchment)
    ribbon_obj, ribbon_sk = build_cosmic_p_ribbon(mat_ribbon)
    finials = build_gold_finials(mat_gold)
    starburst = build_starburst_flare(mat_star)
    ring_outer, ring_inner, star_pivot = build_neural_rings_and_stardust(
        mat_violet_ring, mat_gold_ring, mat_lavender_star, mat_gold_star
    )

    for child in [parchment_obj, ribbon_obj, *finials, starburst]:
        child.parent = root_pivot

    animate_powerpoint_morph(
        root_pivot, parchment_sk, ribbon_sk, finials, starburst, ring_outer, ring_inner, star_pivot
    )

    tris = count_total_triangles()
    print(f"Built Papyrus 3D Splash Morph scene: {tris} triangles")

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=False,
        export_morph=True,
        export_morph_normal=True,
        export_yup=True,
        export_animations=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
    )

    size_bytes = os.path.getsize(OUT_GLB)
    with open(OUT_GLB, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(
            "// Auto-generated by scripts/blender/build_splash_morph.py (Blender 4.2 + Shape Keys + Draco)\n"
            f'export const GLB_SPLASH_MORPH_B64 = "data:model/gltf-binary;base64,{b64}";\n'
        )
    print(f"Exported {OUT_GLB} ({size_bytes} bytes, {tris} tris) -> {OUT_TS}")

    if PREVIEW_DIR:
        render_verification_previews(PREVIEW_DIR)


if __name__ == "__main__":
    build_splash_morph()
