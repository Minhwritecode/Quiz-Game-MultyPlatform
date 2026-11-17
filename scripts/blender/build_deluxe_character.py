"""
Deluxe 3D Papyrus Scholar & Battle Dais Generator for Blender 4.2+
Builds a high-quality stylized game character inspired by KayKit & Quaternius.
"""

import socket
import json

code = """
import bpy
import math

def build_deluxe_scene():
    # 1. Clear existing objects
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # 2. Advanced PBR Materials
    # Mat 1: Royal Indigo Parchment Body
    mat_indigo = bpy.data.materials.new(name="M_Royal_Indigo")
    mat_indigo.use_nodes = True
    bsdf_indigo = mat_indigo.node_tree.nodes.get("Principled BSDF")
    if bsdf_indigo:
        bsdf_indigo.inputs['Base Color'].default_value = (0.16, 0.12, 0.65, 1.0) # #3730A3
        bsdf_indigo.inputs['Roughness'].default_value = 0.35
        bsdf_indigo.inputs['Metallic'].default_value = 0.1

    # Mat 2: Warm Ancient Ivory Inner Paper
    mat_ivory = bpy.data.materials.new(name="M_Ancient_Ivory")
    mat_ivory.use_nodes = True
    bsdf_ivory = mat_ivory.node_tree.nodes.get("Principled BSDF")
    if bsdf_ivory:
        bsdf_ivory.inputs['Base Color'].default_value = (0.98, 0.95, 0.88, 1.0)
        bsdf_ivory.inputs['Roughness'].default_value = 0.55

    # Mat 3: Burnished Ornate Gold Metal
    mat_gold = bpy.data.materials.new(name="M_Ornate_Gold")
    mat_gold.use_nodes = True
    bsdf_gold = mat_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf_gold:
        bsdf_gold.inputs['Base Color'].default_value = (1.0, 0.82, 0.22, 1.0)
        bsdf_gold.inputs['Metallic'].default_value = 0.9
        bsdf_gold.inputs['Roughness'].default_value = 0.2

    # Mat 4: Glowing Emissive Cyan Eyes & Magic
    mat_glow_cyan = bpy.data.materials.new(name="M_Glow_Cyan")
    mat_glow_cyan.use_nodes = True
    bsdf_cyan = mat_glow_cyan.node_tree.nodes.get("Principled BSDF")
    if bsdf_cyan:
        bsdf_cyan.inputs['Base Color'].default_value = (0.1, 0.9, 1.0, 1.0)
        if 'Emission Color' in bsdf_cyan.inputs:
            bsdf_cyan.inputs['Emission Color'].default_value = (0.05, 0.85, 1.0, 1.0)
            bsdf_cyan.inputs['Emission Strength'].default_value = 8.0

    # Mat 5: Radiant Gold Core (Emission)
    mat_glow_gold = bpy.data.materials.new(name="M_Glow_Gold")
    mat_glow_gold.use_nodes = True
    bsdf_gold_glow = mat_glow_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf_gold_glow:
        bsdf_gold_glow.inputs['Base Color'].default_value = (1.0, 0.85, 0.2, 1.0)
        if 'Emission Color' in bsdf_gold_glow.inputs:
            bsdf_gold_glow.inputs['Emission Color'].default_value = (1.0, 0.8, 0.15, 1.0)
            bsdf_gold_glow.inputs['Emission Strength'].default_value = 10.0

    # Mat 6: Stone Dais / Marble Pedestal
    mat_stone = bpy.data.materials.new(name="M_Dais_Stone")
    mat_stone.use_nodes = True
    bsdf_stone = mat_stone.node_tree.nodes.get("Principled BSDF")
    if bsdf_stone:
        bsdf_stone.inputs['Base Color'].default_value = (0.18, 0.22, 0.32, 1.0)
        bsdf_stone.inputs['Roughness'].default_value = 0.4

    # 3. MESH CONSTRUCTION
    # A. Battle Dais / Podium
    bpy.ops.mesh.primitive_cylinder_add(radius=2.2, depth=0.3, vertices=48, location=(0, 0, 0.15))
    dais_base = bpy.context.active_object
    dais_base.name = "Dais_Base"
    dais_base.data.materials.append(mat_stone)

    bpy.ops.mesh.primitive_torus_add(major_radius=2.15, minor_radius=0.08, location=(0, 0, 0.3))
    dais_ring = bpy.context.active_object
    dais_ring.name = "Dais_Gold_Trim"
    dais_ring.data.materials.append(mat_gold)

    # B. Character Main Scroll Body (Graceful tapered curve)
    # Lower Scroll Roll (Rolled-up bottom)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=1.6, vertices=32, location=(0, 0, 0.55), rotation=(0, math.radians(90), 0))
    bottom_roll = bpy.context.active_object
    bottom_roll.name = "Scroll_Bottom_Roll"
    bottom_roll.data.materials.append(mat_indigo)

    # Gold Caps for Bottom Roll
    for x_pos in [-0.85, 0.85]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(x_pos, 0, 0.55))
        cap = bpy.context.active_object
        cap.name = f"Spindle_Cap_Bottom_{x_pos}"
        cap.data.materials.append(mat_gold)

    # Vertical Flowing Stem (Body)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=2.0, vertices=36, location=(-0.35, 0, 1.5))
    stem = bpy.context.active_object
    stem.name = "Papyrus_Stem"
    stem.data.materials.append(mat_indigo)

    # Golden Filigree Trim on Stem Edge
    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=0.1, vertices=36, location=(-0.35, 0, 2.4))
    stem_collar = bpy.context.active_object
    stem_collar.name = "Stem_Collar"
    stem_collar.data.materials.append(mat_gold)

    # Top "P" Loop Ribbon (Curved arch forming the P loop)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.65, minor_radius=0.22, major_segments=48, minor_segments=24, location=(0.18, 0, 2.1), rotation=(math.radians(90), 0, 0))
    loop = bpy.context.active_object
    loop.name = "Papyrus_Loop"
    loop.data.materials.append(mat_ivory)

    # Cute Expressive Glowing Character Eyes (Face on the scroll stem)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(-0.15, -0.38, 1.7), rotation=(0, 0, 0))
    eye_l = bpy.context.active_object
    eye_l.scale = (1.0, 0.4, 1.4)
    eye_l.name = "Eye_Left"
    eye_l.data.materials.append(mat_glow_cyan)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(-0.52, -0.38, 1.7), rotation=(0, 0, 0))
    eye_r = bpy.context.active_object
    eye_r.scale = (1.0, 0.4, 1.4)
    eye_r.name = "Eye_Right"
    eye_r.data.materials.append(mat_glow_cyan)

    # Floating Wizard Scholar Halo / Crown of Stars
    bpy.ops.mesh.primitive_torus_add(major_radius=0.55, minor_radius=0.04, location=(-0.35, 0, 2.85), rotation=(math.radians(15), math.radians(10), 0))
    crown_ring = bpy.context.active_object
    crown_ring.name = "Scholar_Halo_Ring"
    crown_ring.data.materials.append(mat_gold)

    # 3 Floating Star Jewels on Crown
    for angle in [0, 120, 240]:
        rad = math.radians(angle)
        sx = -0.35 + math.cos(rad) * 0.55
        sy = math.sin(rad) * 0.55
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.08, location=(sx, sy, 2.85))
        gem = bpy.context.active_object
        gem.name = f"Crown_Gem_{angle}"
        gem.data.materials.append(mat_glow_gold)

    # Core Spark of Knowledge (Floating Diamond Orb at loop focus)
    if hasattr(bpy.ops.mesh, "primitive_ico_sphere_add"):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.28, location=(0.7, 0, 2.9))
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(0.7, 0, 2.9))
    spark_orb = bpy.context.active_object
    spark_orb.name = "Spark_Of_Wisdom"
    spark_orb.data.materials.append(mat_glow_gold)

    # Orbit Rings around Spark
    bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.025, location=(0.7, 0, 2.9), rotation=(math.radians(55), math.radians(40), 0))
    orbit_1 = bpy.context.active_object
    orbit_1.name = "Orbit_Ring_1"
    orbit_1.data.materials.append(mat_gold)

    bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.02, location=(0.7, 0, 2.9), rotation=(math.radians(-45), math.radians(60), 0))
    orbit_2 = bpy.context.active_object
    orbit_2.name = "Orbit_Ring_2"
    orbit_2.data.materials.append(mat_glow_cyan)

    # Smooth Shading on all objects
    for obj in bpy.data.objects:
        if obj.type == 'MESH':
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.shade_smooth()

    # 4. STUDIO CINEMATIC LIGHTING
    # Key Light (Brilliant Cool White)
    bpy.ops.object.light_add(type='POINT', radius=1.0, location=(3.5, -4.0, 5.0))
    key = bpy.context.active_object
    key.name = "Studio_KeyLight"
    key.data.energy = 1200
    key.data.color = (0.85, 0.92, 1.0)

    # Rim Light (Vibrant Violet Neon)
    bpy.ops.object.light_add(type='POINT', radius=0.8, location=(-3.5, 3.5, 4.0))
    rim = bpy.context.active_object
    rim.name = "Studio_RimLight"
    rim.data.energy = 950
    rim.data.color = (0.75, 0.25, 1.0)

    # Fill Light (Warm Golden Glow)
    bpy.ops.object.light_add(type='POINT', radius=0.6, location=(2.0, 3.0, 3.0))
    fill = bpy.context.active_object
    fill.name = "Studio_FillLight"
    fill.data.energy = 450
    fill.data.color = (1.0, 0.8, 0.4)

    # Core Spark Point Light
    bpy.ops.object.light_add(type='POINT', radius=0.4, location=(0.7, 0, 2.9))
    spark_light = bpy.context.active_object
    spark_light.name = "Spark_PointLight"
    spark_light.data.energy = 250
    spark_light.data.color = (1.0, 0.85, 0.2)

    # 5. CAMERA SETUP
    bpy.ops.object.camera_add(location=(0, -6.5, 2.6), rotation=(math.radians(78), 0, 0))
    cam = bpy.context.active_object
    cam.name = "Studio_Camera"
    bpy.context.scene.camera = cam

    # 6. FORCE VIEWPORT TO MATERIAL PREVIEW & FRAME CHARACTER
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    # Turn on bloom / cavity if available
                    space.shading.color_type = 'MATERIAL'

    print("🌟 [Papyrus] Deluxe Character & Arena Dais built successfully!")
    return None

bpy.app.timers.register(build_deluxe_scene)
"""

def send_build():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect(("127.0.0.1", 9876))
    payload = json.dumps({"type": "eval", "code": code})
    s.sendall(payload.encode('utf-8'))
    res = s.recv(4096).decode('utf-8')
    s.close()
    print("Blender response:", res)

if __name__ == "__main__":
    send_build()
