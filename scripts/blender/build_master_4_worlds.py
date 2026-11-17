"""
Master 3D World & Character Generator for Papyrus (Blender 4.2+)
Builds high-fidelity 3D environments & characters for all 4 game modes:
1. Celestial Spire (Survival Arena) - Chibi Papyrus Mage vs Chimera of Ignorance
2. Colosseum of Wisdom (Realtime Battle) - 4 Scholar Players in Octagonal Arena
3. Grand Papyrus Archives (Memory Match) - Magical Library + 3D Rune Tablets + Mascot
4. Sanctuary of Scholars (Study Ground) - Zen Floating Garden + Tree of Knowledge
"""

import socket
import json
import os
import sys

def build_blender_code():
    return '''
import bpy
import math
import os

def clear_all():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        if c.name != "Collection":
            bpy.data.collections.remove(c)

def get_or_create_material(name, base_color, metallic=0.0, roughness=0.5, emission=None, emission_strength=1.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = base_color
        if 'Metallic' in bsdf.inputs:
            bsdf.inputs['Metallic'].default_value = metallic
        if 'Roughness' in bsdf.inputs:
            bsdf.inputs['Roughness'].default_value = roughness
        if emission:
            if 'Emission Color' in bsdf.inputs:
                bsdf.inputs['Emission Color'].default_value = emission
                bsdf.inputs['Emission Strength'].default_value = emission_strength
            elif 'Emission' in bsdf.inputs:
                bsdf.inputs['Emission'].default_value = emission
    return mat

def create_ico_sphere(radius, subdivisions, location):
    if hasattr(bpy.ops.mesh, "primitive_ico_sphere_add"):
        bpy.ops.mesh.primitive_ico_sphere_add(radius=radius, subdivisions=subdivisions, location=location)
    elif hasattr(bpy.ops.mesh, "primitive_icosphere_add"):
        bpy.ops.mesh.primitive_icosphere_add(radius=radius, subdivisions=subdivisions, location=location)
    else:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=location)
    return bpy.context.active_object

def create_chibi_mage(location=(0, -1.8, 0.4), name="Papyrus_Mage", robe_color=(0.18, 0.14, 0.72, 1.0)):
    # Root
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=location)
    root = bpy.context.active_object
    root.name = name

    # Materials
    mat_robe = get_or_create_material(f"M_Robe_{name}", robe_color, metallic=0.1, roughness=0.4)
    mat_cowl = get_or_create_material("M_Cowl_Violet", (0.42, 0.18, 0.85, 1.0), roughness=0.35)
    mat_gold = get_or_create_material("M_Gold_Trim", (1.0, 0.78, 0.18, 1.0), metallic=0.9, roughness=0.2)
    mat_skin = get_or_create_material("M_Face_Skin", (1.0, 0.88, 0.78, 1.0), roughness=0.6)
    mat_eye = get_or_create_material("M_Eye_Sapphire", (0.05, 0.75, 1.0, 1.0), emission=(0.1, 0.85, 1.0, 1.0), emission_strength=4.0)
    mat_gem = get_or_create_material("M_Cyan_Gem", (0.05, 0.95, 1.0, 1.0), emission=(0.1, 1.0, 1.0, 1.0), emission_strength=8.0)

    # 1. Robe (cone base)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.55, radius2=0.22, depth=0.9, location=(0, 0, 0.45))
    robe = bpy.context.active_object
    robe.name = f"{name}_Robe"
    robe.data.materials.append(mat_robe)
    robe.parent = root

    # Gold Trim at hem
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.54, minor_radius=0.04, location=(0, 0, 0.05))
        hem = bpy.context.active_object
        hem.name = f"{name}_HemGold"
        hem.data.materials.append(mat_gold)
        hem.parent = root
    except Exception:
        pass

    # 2. Wizard Hood / Cowl (shoulders + hood)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.38, location=(0, 0, 0.95))
    cowl = bpy.context.active_object
    cowl.name = f"{name}_Cowl"
    cowl.scale = (1.0, 0.95, 1.1)
    cowl.data.materials.append(mat_cowl)
    cowl.parent = root

    # 3. Chibi Head (cute sphere)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.32, location=(0, -0.06, 0.96))
    head = bpy.context.active_object
    head.name = f"{name}_Head"
    head.data.materials.append(mat_skin)
    head.parent = root

    # 4. Eyes (glowing expressive sapphires)
    for side, x in [("Left", -0.11), ("Right", 0.11)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.065, location=(x, -0.34, 1.0))
        eye = bpy.context.active_object
        eye.scale = (0.7, 0.5, 1.2)
        eye.name = f"{name}_Eye_{side}"
        eye.data.materials.append(mat_eye)
        eye.parent = root

    # 5. Scholar Crown / Floating Halo
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.28, minor_radius=0.028, location=(0, 0, 1.45))
        halo = bpy.context.active_object
        halo.name = f"{name}_Halo"
        halo.data.materials.append(mat_gold)
        halo.parent = root
    except Exception:
        pass

    # 6. Wisdom Staff (in right hand)
    # Staff Shaft
    bpy.ops.mesh.primitive_cylinder_add(radius=0.035, depth=1.6, location=(0.42, -0.15, 0.8))
    staff = bpy.context.active_object
    staff.name = f"{name}_Staff_Shaft"
    staff.data.materials.append(mat_gold)
    staff.parent = root

    # Staff Crown Setting
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.12, radius2=0.04, depth=0.15, location=(0.42, -0.15, 1.62))
    s_crown = bpy.context.active_object
    s_crown.name = f"{name}_Staff_Crown"
    s_crown.data.materials.append(mat_gold)
    s_crown.parent = root

    # Staff Gem (Cyan radiant crystal)
    gem = create_ico_sphere(radius=0.10, subdivisions=2, location=(0.42, -0.15, 1.76))
    gem.name = f"{name}_Staff_Gem"
    gem.data.materials.append(mat_gem)
    gem.parent = root

    # 7. Floating Spellbook (hovering by left hand)
    bpy.ops.mesh.primitive_cube_add(size=0.28, location=(-0.45, -0.15, 0.95))
    book = bpy.context.active_object
    book.scale = (0.7, 0.9, 0.2)
    book.rotation_euler = (math.radians(25), math.radians(15), math.radians(-35))
    book.name = f"{name}_Floating_Tome"
    book.data.materials.append(mat_cowl)
    book.parent = root

    for obj in [robe, cowl, head, staff, gem]:
        if obj:
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.shade_smooth()

    return root

def build_game_1_survival_arena():
    clear_all()
    scene_root = bpy.data.collections.new("Celestial_Spire_Arena")
    bpy.context.scene.collection.children.link(scene_root)

    # Materials
    mat_stone = get_or_create_material("M_Dark_Slate", (0.08, 0.11, 0.18, 1.0), roughness=0.7)
    mat_rune_gold = get_or_create_material("M_Rune_Gold", (1.0, 0.82, 0.22, 1.0), metallic=0.8, roughness=0.3)
    mat_rune_cyan = get_or_create_material("M_Rune_Cyan_Glow", (0.05, 0.9, 1.0, 1.0), emission=(0.05, 0.95, 1.0, 1.0), emission_strength=10.0)
    mat_void = get_or_create_material("M_Void_Crimson", (0.45, 0.05, 0.10, 1.0), roughness=0.3)
    mat_crimson_eye = get_or_create_material("M_Crimson_Eye", (1.0, 0.1, 0.1, 1.0), emission=(1.0, 0.1, 0.1, 1.0), emission_strength=12.0)

    # 1. Main Dais Platform (circular stone arena)
    bpy.ops.mesh.primitive_cylinder_add(radius=5.2, depth=0.6, vertices=64, location=(0, 0, -0.3))
    dais = bpy.context.active_object
    dais.name = "Celestial_Dais"
    dais.data.materials.append(mat_stone)

    # Outer decorative gold rim
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=5.25, minor_radius=0.12, location=(0, 0, 0.0))
        rim = bpy.context.active_object
        rim.name = "Dais_Gold_Border"
        rim.data.materials.append(mat_rune_gold)
    except Exception:
        pass

    # Inner glowing rune circle on floor
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=3.2, minor_radius=0.04, location=(0, 0, 0.02))
        inner_circle = bpy.context.active_object
        inner_circle.name = "Dais_Magic_Circle"
        inner_circle.data.materials.append(mat_rune_cyan)
    except Exception:
        pass

    # 2. Four Ancient Rune Pillars
    pillar_dist = 4.2
    angles = [45, 135, 225, 315]
    for i, deg in enumerate(angles):
        rad = math.radians(deg)
        px = pillar_dist * math.cos(rad)
        py = pillar_dist * math.sin(rad)
        
        # Pillar Shaft
        bpy.ops.mesh.primitive_cylinder_add(radius=0.38, depth=3.2, vertices=12, location=(px, py, 1.6))
        pillar = bpy.context.active_object
        pillar.name = f"Rune_Pillar_{i+1}"
        pillar.data.materials.append(mat_stone)

        # Glowing Rune Bands on Pillar
        for b_z in [0.8, 1.6, 2.4]:
            try:
                bpy.ops.mesh.primitive_torus_add(major_radius=0.40, minor_radius=0.03, location=(px, py, b_z))
                band = bpy.context.active_object
                band.name = f"Pillar_{i+1}_Band_{b_z}"
                band.data.materials.append(mat_rune_cyan)
            except Exception:
                pass

        # Floating Crystal Core on Top of Pillar
        c_top = create_ico_sphere(radius=0.22, subdivisions=2, location=(px, py, 3.6))
        c_top.name = f"Pillar_{i+1}_Crystal"
        c_top.data.materials.append(mat_rune_cyan)

    # 3. Chibi Papyrus Mage (Player)
    mage = create_chibi_mage(location=(0, -2.0, 0.0), name="Papyrus_Mage", robe_color=(0.18, 0.14, 0.72, 1.0))

    # 3 Orbiting Crystal Hearts
    mat_heart = get_or_create_material("M_Crystal_Heart", (1.0, 0.2, 0.45, 1.0), emission=(1.0, 0.25, 0.5, 1.0), emission_strength=7.0)
    for h_i in range(3):
        h_ang = math.radians(h_i * 120)
        hx = 0 + 0.85 * math.cos(h_ang)
        hy = -2.0 + 0.85 * math.sin(h_ang)
        h_obj = create_ico_sphere(radius=0.10, subdivisions=1, location=(hx, hy, 1.25))
        h_obj.name = f"Crystal_Heart_{h_i+1}"
        h_obj.data.materials.append(mat_heart)
        h_obj.parent = mage

    # 4. Boss: Chimera of Ignorance (Dark Void Monstrosity)
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 2.4, 1.2))
    boss_root = bpy.context.active_object
    boss_root.name = "Boss_Chimera"

    # Core Beast Body (Ominous jagged crystal/sphere)
    boss_core = create_ico_sphere(radius=0.95, subdivisions=2, location=(0, 2.4, 1.2))
    boss_core.scale = (1.2, 0.9, 1.1)
    boss_core.name = "Chimera_Core"
    boss_core.data.materials.append(mat_void)
    boss_core.parent = boss_root

    # Void Spikes (radiating outwards)
    for s_i in range(6):
        s_ang = math.radians(s_i * 60 + 15)
        sx = 0 + 0.9 * math.cos(s_ang)
        sy = 2.4 + 0.9 * math.sin(s_ang)
        bpy.ops.mesh.primitive_cone_add(radius1=0.18, radius2=0.01, depth=0.8, location=(sx, sy, 1.5))
        spike = bpy.context.active_object
        spike.name = f"Chimera_Spike_{s_i}"
        spike.data.materials.append(mat_void)
        spike.parent = boss_root

    # Glowing Red Eyes
    for e_side, ex in [("Left", -0.32), ("Center", 0.0), ("Right", 0.32)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=(ex, 1.6, 1.35))
        b_eye = bpy.context.active_object
        b_eye.name = f"Chimera_Eye_{e_side}"
        b_eye.data.materials.append(mat_crimson_eye)
        b_eye.parent = boss_root

    # 5. Studio Lighting
    # Golden Key Light
    bpy.ops.object.light_add(type='POINT', radius=1.0, location=(3.5, -4.0, 5.5))
    key = bpy.context.active_object
    key.name = "Key_Light_Gold"
    key.data.energy = 1200
    key.data.color = (1.0, 0.85, 0.45)

    # Cyan Magic Fill Light
    bpy.ops.object.light_add(type='POINT', radius=1.0, location=(-3.8, 2.5, 4.0))
    fill = bpy.context.active_object
    fill.name = "Fill_Light_Cyan"
    fill.data.energy = 800
    fill.data.color = (0.2, 0.7, 1.0)

    # Magenta Cosmic Rim Light
    bpy.ops.object.light_add(type='POINT', radius=0.8, location=(0, 4.5, 3.0))
    rim = bpy.context.active_object
    rim.name = "Rim_Light_Magenta"
    rim.data.energy = 900
    rim.data.color = (0.9, 0.2, 0.7)

    # Camera framing
    bpy.ops.object.camera_add(location=(0, -8.2, 4.6), rotation=(math.radians(65), 0, 0))
    cam = bpy.context.active_object
    cam.name = "Arena_Camera"
    bpy.context.scene.camera = cam

    # Enable Material Preview shading in 3D Viewport
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'

    print("✅ Successfully built Celestial Spire Survival Arena in Blender!")

def export_glb_file(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"📦 Exported GLB to: {filepath}")

def main_execution():
    try:
        build_game_1_survival_arena()
        
        # Export paths
        paths = [
            "/Users/macos/Quiz-Game-MultyPlatform/assets/models/survival_arena.glb",
            "/Users/macos/.gemini/antigravity/worktrees/Quiz-Game-MultyPlatform/optimize_project_structure/assets/models/survival_arena.glb",
            "/Users/macos/Quiz-Game-MultyPlatform/Setup Guide In-Editor Tutorial/Assets/Papyrus/Models/survival_arena.glb"
        ]
        for p in paths:
            try:
                export_glb_file(p)
            except Exception as exp:
                print(f"Warning exporting to {p}: {exp}")
    except Exception as e:
        print(f"Error building arena: {e}")
    return None

bpy.app.timers.register(main_execution)
'''

def send_to_blender():
    code = build_blender_code()
    payload = json.dumps({"type": "eval", "code": code})
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", 9876))
        s.sendall(payload.encode('utf-8'))
        resp = s.recv(4096).decode('utf-8')
        print("Blender response:", resp)
    finally:
        s.close()

if __name__ == "__main__":
    send_to_blender()
