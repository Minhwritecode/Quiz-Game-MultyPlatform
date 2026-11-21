"""
Headless Blender 4.2 script to procedurally generate and animate the
Papyrus Quest Arena Emblem (crystalline core + dual golden astrolabe rings + orbiting runes).

Run with:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P scripts/blender/build_quest_arena_emblem.py
"""
import base64
import math
import os
import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT_GLB = os.path.join(ROOT, "assets", "models", "papyrus_quest_emblem.glb")
OUT_TS = os.path.join(ROOT, "src", "shared", "models3d", "questEmblem.ts")


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, base_color, metallic=0.1, roughness=0.35, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
            bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def set_smooth(obj):
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True


def build_emblem():
    reset_scene()
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = 120
    scene.render.fps = 30

    mat_crystal = make_material(
        "Arcane_Crystal",
        (0.31, 0.27, 0.90, 1.0),
        metallic=0.25,
        roughness=0.15,
        emission=(0.38, 0.40, 0.95, 1.0),
        emission_strength=1.4,
    )
    mat_gold = make_material(
        "Astrolabe_Gold",
        (0.96, 0.65, 0.12, 1.0),
        metallic=0.88,
        roughness=0.22,
        emission=(0.98, 0.75, 0.20, 1.0),
        emission_strength=0.2,
    )
    mat_cyan = make_material(
        "Rune_Cyan",
        (0.06, 0.78, 0.88, 1.0),
        metallic=0.35,
        roughness=0.2,
        emission=(0.13, 0.83, 0.93, 1.0),
        emission_strength=1.8,
    )

    # 1. Central Faceted Crystal Core (Octahedron)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.58, location=(0, 0, 0))
    core = bpy.context.active_object
    core.name = "Quest_Crystal_Core"
    core.scale = (0.85, 0.85, 1.25)
    core.data.materials.append(mat_crystal)

    # Animate core rotation + floating bob
    for frame, z_off, rot_z in [(1, 0.0, 0.0), (60, 0.14, math.pi), (120, 0.0, math.tau)]:
        core.location.z = z_off
        core.rotation_euler = (0.15, 0.0, rot_z)
        core.keyframe_insert(data_path="location", frame=frame)
        core.keyframe_insert(data_path="rotation_euler", frame=frame)

    # 2. Outer Golden Astrolabe Ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=1.18,
        minor_radius=0.055,
        major_segments=32,
        minor_segments=10,
        location=(0, 0, 0),
    )
    ring_outer = bpy.context.active_object
    ring_outer.name = "Astrolabe_Ring_Outer"
    set_smooth(ring_outer)
    ring_outer.data.materials.append(mat_gold)

    for frame, rot_z in [(1, 0.0), (120, math.tau)]:
        ring_outer.rotation_euler = (math.radians(58), math.radians(18), rot_z)
        ring_outer.keyframe_insert(data_path="rotation_euler", frame=frame)

    # 3. Inner Counter-Rotating Ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.90,
        minor_radius=0.04,
        major_segments=28,
        minor_segments=8,
        location=(0, 0, 0),
    )
    ring_inner = bpy.context.active_object
    ring_inner.name = "Astrolabe_Ring_Inner"
    set_smooth(ring_inner)
    ring_inner.data.materials.append(mat_cyan)

    for frame, rot_z in [(1, 0.0), (120, -math.tau)]:
        ring_inner.rotation_euler = (math.radians(-48), math.radians(-24), rot_z)
        ring_inner.keyframe_insert(data_path="rotation_euler", frame=frame)

    # 4. Orbiting Knowledge Runes (4 small diamond prisms parented to an empty pivot)
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    pivot = bpy.context.active_object
    pivot.name = "Rune_Orbit_Pivot"

    for i in range(4):
        angle = i * (math.pi / 2)
        rx = math.cos(angle) * 1.42
        ry = math.sin(angle) * 1.42
        rz = 0.25 if i % 2 == 0 else -0.25
        bpy.ops.mesh.primitive_cube_add(size=0.18, location=(rx, ry, rz))
        rune = bpy.context.active_object
        rune.name = f"Rune_Prism_{i + 1}"
        rune.rotation_euler = (math.radians(45), math.radians(45), angle)
        rune.data.materials.append(mat_gold if i % 2 == 0 else mat_cyan)
        rune.parent = pivot

    for frame, rot_z in [(1, 0.0), (120, math.tau)]:
        pivot.rotation_euler = (math.radians(14), 0.0, rot_z)
        pivot.keyframe_insert(data_path="rotation_euler", frame=frame)

    # Linear interpolation for seamless 360-degree loop
    for obj in [core, ring_outer, ring_inner, pivot]:
        if obj.animation_data and obj.animation_data.action:
            for fcurve in obj.animation_data.action.fcurves:
                for kp in fcurve.keyframe_points:
                    kp.interpolation = "LINEAR"

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_animations=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
    )

    with open(OUT_GLB, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")

    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)
    with open(OUT_TS, "w", encoding="utf-8") as f:
        f.write(
            "// Auto-generated by scripts/blender/build_quest_arena_emblem.py (Blender 4.2 + Draco)\n"
            f'export const GLB_QUEST_EMBLEM_B64 = "data:model/gltf-binary;base64,{b64}";\n'
        )
    print(f"Exported {OUT_GLB} ({os.path.getsize(OUT_GLB)} bytes) -> {OUT_TS}")


if __name__ == "__main__":
    build_emblem()
