"""
Master 3D Generator for Worlds 2, 3, 4 (Blender 4.2+)
- World 2: Colosseum of Wisdom (Multiplayer Battle) -> battle_colosseum.glb
- World 3: Grand Papyrus Archives (Memory Match) -> library_archives.glb
- World 4: Sanctuary of Scholars (Solo Study) -> study_sanctuary.glb
"""

import socket
import json

def get_code():
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

def export_glb_file(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format='GLB',
        use_selection=False,
        export_apply=True
    )
    print(f"📦 Exported GLB to: {filepath}")

# ==========================================
# WORLD 2: COLOSSEUM OF WISDOM
# ==========================================
def build_game_2_colosseum():
    clear_all()
    # Materials
    mat_marble = get_or_create_material("M_Marble_Floor", (0.92, 0.94, 0.96, 1.0), roughness=0.35)
    mat_gold_rune = get_or_create_material("M_Gold_Rune", (1.0, 0.82, 0.20, 1.0), metallic=0.9, emission=(1.0, 0.8, 0.2, 1.0), emission_strength=5.0)
    mat_banner_purple = get_or_create_material("M_Colosseum_Banner", (0.35, 0.12, 0.65, 1.0), roughness=0.5)
    mat_stone_wall = get_or_create_material("M_Roman_Stone", (0.65, 0.62, 0.58, 1.0), roughness=0.8)

    # 1. Octagonal Arena Floor
    bpy.ops.mesh.primitive_cylinder_add(radius=6.0, depth=0.5, vertices=8, location=(0, 0, -0.25))
    floor = bpy.context.active_object
    floor.name = "Colosseum_Floor"
    floor.data.materials.append(mat_marble)

    # Magic Circle on Floor
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=4.2, minor_radius=0.08, location=(0, 0, 0.02))
        c1 = bpy.context.active_object
        c1.name = "Magic_Circle_Outer"
        c1.data.materials.append(mat_gold_rune)

        bpy.ops.mesh.primitive_torus_add(major_radius=2.5, minor_radius=0.05, location=(0, 0, 0.02))
        c2 = bpy.context.active_object
        c2.name = "Magic_Circle_Inner"
        c2.data.materials.append(mat_gold_rune)
    except Exception:
        pass

    # 8 Classical Colosseum Pillars & Banners around periphery
    for i in range(8):
        ang = math.radians(i * 45 + 22.5)
        px = 5.6 * math.cos(ang)
        py = 5.6 * math.sin(ang)

        bpy.ops.mesh.primitive_cylinder_add(radius=0.32, depth=3.8, vertices=16, location=(px, py, 1.9))
        pillar = bpy.context.active_object
        pillar.name = f"Colosseum_Pillar_{i+1}"
        pillar.data.materials.append(mat_stone_wall)

        # Banner hanging between pillars
        if i % 2 == 0:
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(px * 0.92, py * 0.92, 2.5))
            banner = bpy.context.active_object
            banner.scale = (0.05, 0.6, 1.2)
            banner.rotation_euler = (0, 0, ang + math.radians(90))
            banner.name = f"Academy_Banner_{i+1}"
            banner.data.materials.append(mat_banner_purple)

    # 2. Four Scholar Competitors (Indigo, Crimson, Emerald, Amber)
    competitor_colors = [
        ("Player_1_Indigo", (0.18, 0.14, 0.72, 1.0), (-1.8, -1.8, 0)),
        ("Player_2_Crimson", (0.85, 0.15, 0.15, 1.0), (1.8, -1.8, 0)),
        ("Player_3_Emerald", (0.12, 0.68, 0.28, 1.0), (-1.8, 1.8, 0)),
        ("Player_4_Amber", (0.95, 0.60, 0.10, 1.0), (1.8, 1.8, 0)),
    ]
    for c_name, c_col, (cx, cy, cz) in competitor_colors:
        # Robe
        bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.45, radius2=0.18, depth=0.8, location=(cx, cy, cz + 0.4))
        p_robe = bpy.context.active_object
        p_robe.name = f"{c_name}_Robe"
        mat_c = get_or_create_material(f"M_{c_name}", c_col, roughness=0.4)
        p_robe.data.materials.append(mat_c)

        # Head
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.28, location=(cx, cy, cz + 0.95))
        p_head = bpy.context.active_object
        p_head.name = f"{c_name}_Head"
        mat_skin = get_or_create_material("M_Face_Skin", (1.0, 0.88, 0.78, 1.0), roughness=0.6)
        p_head.data.materials.append(mat_skin)

        # Small staff
        bpy.ops.mesh.primitive_cylinder_add(radius=0.03, depth=1.3, location=(cx + 0.35, cy, cz + 0.65))
        p_staff = bpy.context.active_object
        p_staff.name = f"{c_name}_Staff"
        p_staff.data.materials.append(mat_gold_rune)

    # 3. Victory Podium in Center
    for step_i, (s_r, s_h, s_z, s_mat_name, s_col) in enumerate([
        (1.2, 0.45, 0.225, "M_Gold_Podium", (1.0, 0.82, 0.18, 1.0)),
        (1.6, 0.30, 0.15, "M_Silver_Podium", (0.85, 0.88, 0.92, 1.0)),
        (2.0, 0.15, 0.075, "M_Bronze_Podium", (0.80, 0.50, 0.25, 1.0))
    ]):
        bpy.ops.mesh.primitive_cylinder_add(radius=s_r, depth=s_h, vertices=8, location=(0, 0, s_z))
        pod = bpy.context.active_object
        pod.name = f"Podium_Step_{step_i+1}"
        m_pod = get_or_create_material(s_mat_name, s_col, metallic=0.7, roughness=0.3)
        pod.data.materials.append(m_pod)

    # Lighting
    bpy.ops.object.light_add(type='SUN', location=(4, -4, 8))
    sun = bpy.context.active_object
    sun.name = "Colosseum_Sun"
    sun.data.energy = 5.0
    sun.data.color = (1.0, 0.95, 0.85)

    print("✅ Built Colosseum of Wisdom")

# ==========================================
# WORLD 3: GRAND PAPYRUS ARCHIVES
# ==========================================
def build_game_3_library():
    clear_all()
    # Materials
    mat_wood = get_or_create_material("M_Dark_Oak", (0.28, 0.15, 0.08, 1.0), roughness=0.75)
    mat_parchment = get_or_create_material("M_Ancient_Parchment", (0.95, 0.90, 0.78, 1.0), roughness=0.6)
    mat_rune_glow = get_or_create_material("M_Tablet_Cyan_Rune", (0.1, 0.9, 1.0, 1.0), emission=(0.1, 0.95, 1.0, 1.0), emission_strength=8.0)
    mat_candle_flame = get_or_create_material("M_Candle_Flame", (1.0, 0.5, 0.05, 1.0), emission=(1.0, 0.55, 0.1, 1.0), emission_strength=15.0)
    mat_gold_ribbon = get_or_create_material("M_Gold_Ribbon", (1.0, 0.8, 0.2, 1.0), metallic=0.8, roughness=0.25)

    # 1. Library Room Floor
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, -0.2))
    floor = bpy.context.active_object
    floor.scale = (12.0, 10.0, 0.4)
    floor.name = "Library_Parquet_Floor"
    floor.data.materials.append(mat_wood)

    # 2. Giant Towering Bookshelves (North Wall)
    for bx in [-3.5, 0, 3.5]:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, 4.2, 2.5))
        shelf = bpy.context.active_object
        shelf.scale = (3.0, 0.8, 5.0)
        shelf.name = f"Bookshelf_Unit_{bx}"
        shelf.data.materials.append(mat_wood)

        # Colorful book rows inside shelf
        book_colors = [
            (0.7, 0.15, 0.15, 1.0), # Crimson
            (0.15, 0.25, 0.7, 1.0), # Indigo
            (0.15, 0.65, 0.25, 1.0), # Emerald
            (0.75, 0.60, 0.15, 1.0), # Gold
        ]
        for row_i, r_z in enumerate([0.8, 1.8, 2.8, 3.8]):
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(bx, 3.85, r_z))
            books = bpy.context.active_object
            books.scale = (2.6, 0.4, 0.45)
            books.name = f"BookRow_{bx}_{row_i}"
            b_mat = get_or_create_material(f"M_BookColor_{row_i}", book_colors[row_i % 4], roughness=0.5)
            books.data.materials.append(b_mat)

    # 3. 3D Floating Rune Tablets (2x3 Grid in Foreground)
    grid_coords = [
        (-1.6, -0.6, 1.6), (0.0, -0.6, 1.6), (1.6, -0.6, 1.6),
        (-1.6, -1.8, 1.0), (0.0, -1.8, 1.0), (1.6, -1.8, 1.0)
    ]
    for tab_i, (tx, ty, tz) in enumerate(grid_coords):
        # Tablet Slate
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(tx, ty, tz))
        tab = bpy.context.active_object
        tab.scale = (0.9, 0.12, 1.1)
        tab.rotation_euler = (math.radians(-25), 0, 0)
        tab.name = f"Rune_Tablet_{tab_i+1}"
        tab.data.materials.append(mat_parchment)

        # Glowing Rune Inscription on Tablet Face
        c_rune = create_ico_sphere(radius=0.14, subdivisions=1, location=(tx, ty - 0.08, tz))
        c_rune.name = f"Tablet_Rune_Core_{tab_i+1}"
        c_rune.data.materials.append(mat_rune_glow)

    # 4. Papyrus Scroll Mascot Companion ("Bé Cuộn Giấy")
    # Body (Curled Scroll cylinder)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=0.7, vertices=24, location=(-2.6, -1.2, 2.2))
    scroll_mascot = bpy.context.active_object
    scroll_mascot.rotation_euler = (math.radians(20), math.radians(15), math.radians(-30))
    scroll_mascot.name = "Papyrus_Scroll_Mascot"
    scroll_mascot.data.materials.append(mat_parchment)

    # Gold Ribbon Bow around Mascot
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.29, minor_radius=0.04, location=(-2.6, -1.2, 2.2))
        ribbon = bpy.context.active_object
        ribbon.rotation_euler = (math.radians(20), math.radians(15), math.radians(-30))
        ribbon.name = "Mascot_Ribbon"
        ribbon.data.materials.append(mat_gold_ribbon)
    except Exception:
        pass

    # Cute Expressive Eyes on Mascot
    for me_i, me_x in [("Left", -2.7), ("Right", -2.5)]:
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(me_x, -1.45, 2.25))
        m_eye = bpy.context.active_object
        m_eye.name = f"Mascot_Eye_{me_i}"
        m_eye.data.materials.append(mat_rune_glow)

    # 5. Warm Candle Lights
    for c_i, (cx, cy) in enumerate([(-3.8, 1.5), (-1.8, 1.5), (1.8, 1.5), (3.8, 1.5)]):
        # Candle Stand
        bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.6, location=(cx, cy, 1.2))
        c_stand = bpy.context.active_object
        c_stand.name = f"Candle_Stick_{c_i+1}"
        c_stand.data.materials.append(mat_parchment)

        # Flame
        c_flame = create_ico_sphere(radius=0.06, subdivisions=1, location=(cx, cy, 1.55))
        c_flame.name = f"Candle_Flame_{c_i+1}"
        c_flame.data.materials.append(mat_candle_flame)

        # Point Light
        bpy.ops.object.light_add(type='POINT', radius=0.4, location=(cx, cy, 1.7))
        c_light = bpy.context.active_object
        c_light.name = f"Candle_Light_{c_i+1}"
        c_light.data.energy = 150
        c_light.data.color = (1.0, 0.65, 0.2)

    print("✅ Built Grand Papyrus Archives")

# ==========================================
# WORLD 4: SANCTUARY OF SCHOLARS
# ==========================================
def build_game_4_sanctuary():
    clear_all()
    # Materials
    mat_grass = get_or_create_material("M_Lush_Moss", (0.15, 0.55, 0.22, 1.0), roughness=0.6)
    mat_rock = get_or_create_material("M_Zen_Stone", (0.42, 0.44, 0.46, 1.0), roughness=0.7)
    mat_wood = get_or_create_material("M_Tree_Trunk", (0.35, 0.20, 0.12, 1.0), roughness=0.8)
    mat_crystal_leaves = get_or_create_material("M_Crystal_Foliage", (0.2, 0.95, 0.55, 1.0), emission=(0.25, 1.0, 0.6, 1.0), emission_strength=6.0)
    mat_water = get_or_create_material("M_Ethereal_Water", (0.1, 0.7, 0.95, 1.0), metallic=0.1, roughness=0.1, emission=(0.15, 0.8, 1.0, 1.0), emission_strength=4.0)
    mat_gold_exp = get_or_create_material("M_EXP_Gold", (1.0, 0.85, 0.25, 1.0), emission=(1.0, 0.9, 0.3, 1.0), emission_strength=8.0)

    # 1. Floating Zen Garden Island (Mossy Rock Platform)
    bpy.ops.mesh.primitive_cylinder_add(radius=5.5, depth=1.2, vertices=32, location=(0, 0, -0.6))
    island = bpy.context.active_object
    island.name = "Sanctuary_Floating_Island"
    island.data.materials.append(mat_grass)

    # 2. Sacred Knowledge Tree
    # Trunk
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=3.5, vertices=16, location=(2.2, 1.5, 1.75))
    trunk = bpy.context.active_object
    trunk.name = "Knowledge_Tree_Trunk"
    trunk.data.materials.append(mat_wood)

    # Glowing Crystalline Foliage Clouds
    for leaf_i, (lx, ly, lz, lr) in enumerate([
        (2.2, 1.5, 3.8, 1.3),
        (1.4, 1.0, 3.4, 0.9),
        (3.0, 1.8, 3.3, 0.85),
        (2.1, 2.4, 3.5, 0.8)
    ]):
        f_cloud = create_ico_sphere(radius=lr, subdivisions=2, location=(lx, ly, lz))
        f_cloud.name = f"Knowledge_Foliage_{leaf_i+1}"
        f_cloud.data.materials.append(mat_crystal_leaves)

    # 3. Magic Light Waterfall
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(-3.2, 1.2, 0.8))
    waterfall = bpy.context.active_object
    waterfall.scale = (1.2, 0.3, 2.4)
    waterfall.rotation_euler = (math.radians(15), 0, math.radians(-25))
    waterfall.name = "Light_Waterfall"
    waterfall.data.materials.append(mat_water)

    # 4. Meditating Scholar in Lotus Pose
    # Lotus Stone Dais
    bpy.ops.mesh.primitive_cylinder_add(radius=1.1, depth=0.35, vertices=16, location=(-0.5, -1.0, 0.175))
    lotus_stone = bpy.context.active_object
    lotus_stone.name = "Lotus_Meditation_Stone"
    lotus_stone.data.materials.append(mat_rock)

    # Meditating Body
    mat_scholar = get_or_create_material("M_Zen_Robe", (0.28, 0.18, 0.75, 1.0), roughness=0.4)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.48, radius2=0.2, depth=0.75, location=(-0.5, -1.0, 0.725))
    zen_body = bpy.context.active_object
    zen_body.name = "Zen_Scholar_Body"
    zen_body.data.materials.append(mat_scholar)

    # Head
    mat_skin = get_or_create_material("M_Face_Skin", (1.0, 0.88, 0.78, 1.0), roughness=0.6)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.26, location=(-0.5, -1.0, 1.25))
    zen_head = bpy.context.active_object
    zen_head.name = "Zen_Scholar_Head"
    zen_head.data.materials.append(mat_skin)

    # Floating Ancient Open Tome (in front of scholar)
    bpy.ops.mesh.primitive_cube_add(size=0.4, location=(-0.5, -1.8, 1.15))
    tome = bpy.context.active_object
    tome.scale = (1.2, 0.8, 0.15)
    tome.rotation_euler = (math.radians(-30), 0, 0)
    tome.name = "Floating_Wisdom_Tome"
    tome.data.materials.append(mat_gold_exp)

    # EXP Arc Halo above Scholar
    try:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.035, location=(-0.5, -1.0, 1.7))
        exp_ring = bpy.context.active_object
        exp_ring.name = "EXP_LevelUp_Halo"
        exp_ring.data.materials.append(mat_gold_exp)
    except Exception:
        pass

    # Serene Ambient Lighting
    bpy.ops.object.light_add(type='SUN', location=(-3, -3, 6))
    zen_sun = bpy.context.active_object
    zen_sun.name = "Zen_Sun"
    zen_sun.data.energy = 4.0
    zen_sun.data.color = (0.85, 0.98, 0.95)

    print("✅ Built Sanctuary of Scholars")

def sequential_export():
    try:
        # Build & Export World 2
        build_game_2_colosseum()
        export_glb_file("/Users/macos/.gemini/antigravity/worktrees/Quiz-Game-MultyPlatform/optimize_project_structure/assets/models/battle_colosseum.glb")
        export_glb_file("/Users/macos/Quiz-Game-MultyPlatform/assets/models/battle_colosseum.glb")

        # Build & Export World 3
        build_game_3_library()
        export_glb_file("/Users/macos/.gemini/antigravity/worktrees/Quiz-Game-MultyPlatform/optimize_project_structure/assets/models/library_archives.glb")
        export_glb_file("/Users/macos/Quiz-Game-MultyPlatform/assets/models/library_archives.glb")

        # Build & Export World 4
        build_game_4_sanctuary()
        export_glb_file("/Users/macos/.gemini/antigravity/worktrees/Quiz-Game-MultyPlatform/optimize_project_structure/assets/models/study_sanctuary.glb")
        export_glb_file("/Users/macos/Quiz-Game-MultyPlatform/assets/models/study_sanctuary.glb")

        print("🎉 ALL 4 3D WORLDS BUILT & EXPORTED TO GLB!")
    except Exception as ex:
        print(f"Error in worlds export: {ex}")
    return None

bpy.app.timers.register(sequential_export)
'''

def send():
    code = get_code()
    payload = json.dumps({"type": "eval", "code": code})
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(("127.0.0.1", 9876))
        s.sendall(payload.encode('utf-8'))
        resp = s.recv(4096).decode('utf-8')
        print("Response:", resp)
    finally:
        s.close()

if __name__ == "__main__":
    send()
