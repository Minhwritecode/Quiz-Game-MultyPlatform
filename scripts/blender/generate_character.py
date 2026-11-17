"""
Blender script to procedurally create and export the 3D "Papyrus Scholar" character.
Run inside Blender:
  blender --background --python scripts/blender/generate_character.py
"""

import bpy
import math
import os

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # Ensure a collection exists
    if not bpy.data.collections:
        col = bpy.data.collections.new("PapyrusScene")
        bpy.context.scene.collection.children.link(col)

def create_materials():
    # 1. Indigo Scroll Body Material
    mat_body = bpy.data.materials.new(name="M_Scroll_Body")
    mat_body.use_nodes = True
    nodes = mat_body.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.23, 0.15, 0.85, 1.0) # #4F46E5 Indigo
        bsdf.inputs['Roughness'].default_value = 0.35
        bsdf.inputs['Metallic'].default_value = 0.15

    # 2. Warm Ivory Inner Parchment
    mat_inner = bpy.data.materials.new(name="M_Scroll_Inner")
    mat_inner.use_nodes = True
    bsdf_inner = mat_inner.node_tree.nodes.get("Principled BSDF")
    if bsdf_inner:
        bsdf_inner.inputs['Base Color'].default_value = (0.98, 0.96, 0.89, 1.0) # Warm Ivory
        bsdf_inner.inputs['Roughness'].default_value = 0.6

    # 3. Radiant Gold Core (Emission)
    mat_gold = bpy.data.materials.new(name="M_Gold_Spark")
    mat_gold.use_nodes = True
    bsdf_gold = mat_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf_gold:
        bsdf_gold.inputs['Base Color'].default_value = (1.0, 0.78, 0.14, 1.0) # #FBBF24
        # Add emission if supported
        if 'Emission Color' in bsdf_gold.inputs:
            bsdf_gold.inputs['Emission Color'].default_value = (1.0, 0.8, 0.2, 1.0)
            bsdf_gold.inputs['Emission Strength'].default_value = 5.0

    return mat_body, mat_inner, mat_gold

def build_character(mat_body, mat_inner, mat_gold):
    # Main curved scroll body (Cylinder with curve taper / twist)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=2.2, vertices=32, location=(0, 0, 1.1))
    scroll_stem = bpy.context.active_object
    scroll_stem.name = "Papyrus_Stem"
    scroll_stem.data.materials.append(mat_body)

    # Top curl of the "P"
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.65,
        minor_radius=0.22,
        major_segments=36,
        minor_segments=16,
        location=(0.4, 0, 1.7),
        rotation=(math.radians(90), 0, 0)
    )
    curl = bpy.context.active_object
    curl.name = "Papyrus_Curl"
    curl.data.materials.append(mat_inner)

    # Sparkling Core of Wisdom (Golden Floating Diamond / IcoSphere)
    bpy.ops.mesh.primitive_icosphere_add(subdivisions=2, radius=0.28, location=(0.7, 0, 2.3))
    spark = bpy.context.active_object
    spark.name = "Papyrus_Spark_Core"
    spark.data.materials.append(mat_gold)

    # Celestial Orbit Ring
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.48,
        minor_radius=0.03,
        location=(0.7, 0, 2.3),
        rotation=(math.radians(45), math.radians(30), 0)
    )
    ring = bpy.context.active_object
    ring.name = "Papyrus_Orbit_Ring"
    ring.data.materials.append(mat_gold)

    # Smooth shading
    for obj in [scroll_stem, curl, spark, ring]:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()

def setup_lighting_and_camera():
    # Key light
    bpy.ops.object.light_add(type='POINT', radius=0.5, location=(2.5, -3.0, 3.5))
    key_light = bpy.context.active_object
    key_light.data.energy = 500
    key_light.data.color = (0.7, 0.8, 1.0) # Cool blue-white

    # Rim light
    bpy.ops.object.light_add(type='POINT', radius=0.5, location=(-2.0, 3.0, 2.5))
    rim_light = bpy.context.active_object
    rim_light.data.energy = 350
    rim_light.data.color = (0.8, 0.4, 1.0) # Violet rim

    # Camera
    bpy.ops.object.camera_add(location=(0, -4.5, 1.8), rotation=(math.radians(80), 0, 0))
    camera = bpy.context.active_object
    bpy.context.scene.camera = camera

def export_assets():
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../assets/models"))
    os.makedirs(out_dir, exist_ok=True)

    glb_path = os.path.join(out_dir, "papyrus_character.glb")
    blend_path = os.path.join(out_dir, "papyrus_character.blend")

    # Save Blend file
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved Blender file: {blend_path}")

    # Export GLB
    bpy.ops.export_scene.gltf(filepath=glb_path, export_format='GLB')
    print(f"Exported GLTF/GLB: {glb_path}")

if __name__ == "__main__":
    reset_scene()
    m_body, m_inner, m_gold = create_materials()
    build_character(m_body, m_inner, m_gold)
    setup_lighting_and_camera()
    export_assets()
