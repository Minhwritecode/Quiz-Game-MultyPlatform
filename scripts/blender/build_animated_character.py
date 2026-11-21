"""
PAPYRUS - 3D RIGGED & ANIMATED SCHOLAR MAGE GENERATOR
Blender 4.x automated generator with Armature & 4 Keyframed Action Clips:
1. Idle (60 frames loopable breathing & hovering gem)
2. Cast_Spell (40 frames staff draw-back & strike)
3. Hit_Reaction (30 frames impact recoil & stumble)
4. Victory_Dance (72 frames jump, 360 spin & triumphant pose)

Exports directly to: assets/models/papyrus_character_animated.glb
"""

import bpy
import math
import os
import sys

def build_rigged_character(output_glb_path=None):
    # 1. Reset Scene
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

    # Clean existing data
    for act in list(bpy.data.actions):
        bpy.data.actions.remove(act)
    for mesh in list(bpy.data.meshes):
        bpy.data.meshes.remove(mesh)
    for arm in list(bpy.data.armatures):
        bpy.data.armatures.remove(arm)

    # 2. Setup High-Quality Stylized PBR Materials
    def get_or_create_material(name, base_color, metallic=0.0, roughness=0.4, emission=None, emission_strength=1.0):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = base_color
            bsdf.inputs['Metallic'].default_value = metallic
            bsdf.inputs['Roughness'].default_value = roughness
            if emission:
                # Blender 4+ support
                if 'Emission Color' in bsdf.inputs:
                    bsdf.inputs['Emission Color'].default_value = emission
                    bsdf.inputs['Emission Strength'].default_value = emission_strength
                elif 'Emission' in bsdf.inputs:
                    bsdf.inputs['Emission'].default_value = emission
        return mat

    mat_indigo = get_or_create_material("M_Robe_Indigo", (0.16, 0.12, 0.65, 1.0), metallic=0.1, roughness=0.35)
    mat_ivory = get_or_create_material("M_Scroll_Ivory", (0.97, 0.94, 0.85, 1.0), roughness=0.55)
    mat_gold = get_or_create_material("M_Ornate_Gold", (1.0, 0.80, 0.20, 1.0), metallic=0.9, roughness=0.2)
    mat_wood = get_or_create_material("M_Staff_Wood", (0.28, 0.15, 0.08, 1.0), roughness=0.6)
    mat_stone = get_or_create_material("M_Dais_Stone", (0.15, 0.18, 0.25, 1.0), roughness=0.7)
    mat_cyan_glow = get_or_create_material(
        "M_Cyan_Glow",
        (0.1, 0.85, 1.0, 1.0),
        emission=(0.1, 0.9, 1.0, 1.0),
        emission_strength=6.0
    )
    mat_gold_glow = get_or_create_material(
        "M_Gold_Glow",
        (1.0, 0.85, 0.2, 1.0),
        emission=(1.0, 0.85, 0.2, 1.0),
        emission_strength=7.0
    )

    # 3. Create Armature
    arm_data = bpy.data.armatures.new("Armature_Mage")
    arm_obj = bpy.data.objects.new("Armature_Mage", arm_data)
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')

    # Define bones
    b_root = arm_data.edit_bones.new('root')
    b_root.head = (0, 0, 0)
    b_root.tail = (0, 0, 0.3)

    b_spine = arm_data.edit_bones.new('spine')
    b_spine.head = (0, 0, 0.3)
    b_spine.tail = (0, 0, 1.1)
    b_spine.parent = b_root

    b_head = arm_data.edit_bones.new('head')
    b_head.head = (0, 0, 1.1)
    b_head.tail = (0, 0, 1.7)
    b_head.parent = b_spine

    b_arm_l = arm_data.edit_bones.new('arm_l')
    b_arm_l.head = (-0.35, 0, 1.0)
    b_arm_l.tail = (-0.65, 0.05, 0.6)
    b_arm_l.parent = b_spine

    b_arm_r = arm_data.edit_bones.new('arm_r')
    b_arm_r.head = (0.35, 0, 1.0)
    b_arm_r.tail = (0.65, 0.1, 0.65)
    b_arm_r.parent = b_spine

    b_staff = arm_data.edit_bones.new('staff')
    b_staff.head = (0.65, 0.1, 0.65)
    b_staff.tail = (0.65, 0.1, 2.1)
    b_staff.parent = b_arm_r

    b_gem = arm_data.edit_bones.new('gem')
    b_gem.head = (0.65, 0.1, 2.05)
    b_gem.tail = (0.65, 0.1, 2.25)
    b_gem.parent = b_staff

    bpy.ops.object.mode_set(mode='OBJECT')

    # Helper function to attach object to bone
    def attach_to_bone(obj, bone_name):
        obj.parent = arm_obj
        obj.parent_type = 'BONE'
        obj.parent_bone = bone_name

    # 4. BUILD CHARACTER GEOMETRY

    # A. Floating Stone Dais (Parented to Root)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=1.1, depth=0.15, location=(0, 0, 0.075))
    dais = bpy.context.active_object
    dais.name = "Dais_Base"
    dais.data.materials.append(mat_stone)
    attach_to_bone(dais, 'root')

    # Dais Rune Ring (Glow)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.95, minor_radius=0.03, location=(0, 0, 0.16))
    dais_ring = bpy.context.active_object
    dais_ring.name = "Dais_Rune_Ring"
    dais_ring.data.materials.append(mat_cyan_glow)
    attach_to_bone(dais_ring, 'root')

    # B. Robe & Torso (Parented to Spine)
    # Lower Robe Skirt (Cone)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.55, radius2=0.28, depth=0.7, location=(0, 0, 0.65))
    robe_skirt = bpy.context.active_object
    robe_skirt.name = "Robe_Skirt"
    robe_skirt.data.materials.append(mat_indigo)
    attach_to_bone(robe_skirt, 'spine')

    # Gold Trim at Bottom of Robe
    bpy.ops.mesh.primitive_torus_add(major_radius=0.54, minor_radius=0.03, location=(0, 0, 0.32))
    robe_hem = bpy.context.active_object
    robe_hem.name = "Robe_Gold_Hem"
    robe_hem.data.materials.append(mat_gold)
    attach_to_bone(robe_hem, 'spine')

    # Upper Torso / Vestment
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.28, depth=0.45, location=(0, 0, 0.95))
    torso = bpy.context.active_object
    torso.name = "Robe_Torso"
    torso.data.materials.append(mat_indigo)
    attach_to_bone(torso, 'spine')

    # Gold Sash / Belt
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.31, depth=0.08, location=(0, 0, 0.78))
    belt = bpy.context.active_object
    belt.name = "Gold_Belt"
    belt.data.materials.append(mat_gold)
    attach_to_bone(belt, 'spine')

    # Ancient Papyrus Scroll Hung on Belt
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.06, depth=0.35, location=(-0.28, -0.15, 0.72), rotation=(0.2, 0.4, 0))
    scroll = bpy.context.active_object
    scroll.name = "Belt_Scroll"
    scroll.data.materials.append(mat_ivory)
    attach_to_bone(scroll, 'spine')

    # Gold Buckle on Scroll
    bpy.ops.mesh.primitive_torus_add(major_radius=0.07, minor_radius=0.015, location=(-0.28, -0.15, 0.72), rotation=(0.2, 0.4, 0))
    scroll_buckle = bpy.context.active_object
    scroll_buckle.name = "Belt_Scroll_Buckle"
    scroll_buckle.data.materials.append(mat_gold)
    attach_to_bone(scroll_buckle, 'spine')

    # C. Head & Wizard Hat (Parented to Head bone)
    # Head sphere
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=16, radius=0.26, location=(0, 0, 1.25))
    head = bpy.context.active_object
    head.name = "Scholar_Head"
    head.data.materials.append(mat_ivory)
    attach_to_bone(head, 'head')

    # Glowing Cyan Eyes / Visor Slits
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, -0.22, 1.25), scale=(0.14, 0.04, 0.04))
    eyes = bpy.context.active_object
    eyes.name = "Glowing_Eyes"
    eyes.data.materials.append(mat_cyan_glow)
    attach_to_bone(eyes, 'head')

    # Hat Brim (Flat disk)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.55, depth=0.03, location=(0, -0.02, 1.38), rotation=(math.radians(8), 0, 0))
    hat_brim = bpy.context.active_object
    hat_brim.name = "Hat_Brim"
    hat_brim.data.materials.append(mat_indigo)
    attach_to_bone(hat_brim, 'head')

    # Hat Gold Band
    bpy.ops.mesh.primitive_torus_add(major_radius=0.28, minor_radius=0.025, location=(0, -0.02, 1.41), rotation=(math.radians(8), 0, 0))
    hat_band = bpy.context.active_object
    hat_band.name = "Hat_Gold_Band"
    hat_band.data.materials.append(mat_gold)
    attach_to_bone(hat_band, 'head')

    # Hat Cone (Curved wizard cone)
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.27, radius2=0.02, depth=0.55, location=(0, 0.04, 1.68), rotation=(math.radians(-14), 0, 0))
    hat_cone = bpy.context.active_object
    hat_cone.name = "Hat_Cone"
    hat_cone.data.materials.append(mat_indigo)
    attach_to_bone(hat_cone, 'head')

    # D. Left Arm (Parented to Arm_L)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.1, depth=0.45, location=(-0.5, 0.02, 0.8), rotation=(0.2, math.radians(-35), 0))
    arm_l_mesh = bpy.context.active_object
    arm_l_mesh.name = "Robe_Sleeve_L"
    arm_l_mesh.data.materials.append(mat_indigo)
    attach_to_bone(arm_l_mesh, 'arm_l')

    # Gold cuff left
    bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.02, location=(-0.62, 0.04, 0.64), rotation=(0.2, math.radians(-35), 0))
    cuff_l = bpy.context.active_object
    cuff_l.name = "Gold_Cuff_L"
    cuff_l.data.materials.append(mat_gold)
    attach_to_bone(cuff_l, 'arm_l')

    # E. Right Arm (Parented to Arm_R)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.1, depth=0.45, location=(0.5, 0.05, 0.82), rotation=(-0.2, math.radians(35), 0))
    arm_r_mesh = bpy.context.active_object
    arm_r_mesh.name = "Robe_Sleeve_R"
    arm_r_mesh.data.materials.append(mat_indigo)
    attach_to_bone(arm_r_mesh, 'arm_r')

    # Gold cuff right
    bpy.ops.mesh.primitive_torus_add(major_radius=0.11, minor_radius=0.02, location=(0.63, 0.08, 0.68), rotation=(-0.2, math.radians(35), 0))
    cuff_r = bpy.context.active_object
    cuff_r.name = "Gold_Cuff_R"
    cuff_r.data.materials.append(mat_gold)
    attach_to_bone(cuff_r, 'arm_r')

    # F. Wisdom Staff (Parented to Staff bone)
    # Wooden shaft
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.035, depth=1.6, location=(0.65, 0.1, 1.35))
    staff_shaft = bpy.context.active_object
    staff_shaft.name = "Staff_Shaft"
    staff_shaft.data.materials.append(mat_wood)
    attach_to_bone(staff_shaft, 'staff')

    # Gold Rings around shaft
    for z_pos in [0.75, 1.2, 1.7]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.045, minor_radius=0.012, location=(0.65, 0.1, z_pos))
        staff_ring = bpy.context.active_object
        staff_ring.name = f"Staff_Ring_{z_pos}"
        staff_ring.data.materials.append(mat_gold)
        attach_to_bone(staff_ring, 'staff')

    # Staff Crown: Golden Crescent / Torus ring top
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.035, location=(0.65, 0.1, 2.12), rotation=(math.radians(90), 0, 0))
    staff_crown = bpy.context.active_object
    staff_crown.name = "Staff_Crown"
    staff_crown.data.materials.append(mat_gold)
    attach_to_bone(staff_crown, 'staff')

    # G. Mythic Levitating Gem (Parented to Gem bone)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.09, location=(0.65, 0.1, 2.12))
    staff_gem = bpy.context.active_object
    staff_gem.name = "Staff_Magic_Gem"
    staff_gem.data.materials.append(mat_cyan_glow)
    attach_to_bone(staff_gem, 'gem')

    # Orbit Ring around Gem (Gold)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.12, minor_radius=0.01, location=(0.65, 0.1, 2.12), rotation=(math.radians(45), math.radians(30), 0))
    gem_orbit = bpy.context.active_object
    gem_orbit.name = "Gem_Orbit_Ring"
    gem_orbit.data.materials.append(mat_gold_glow)
    attach_to_bone(gem_orbit, 'gem')

    # 5. KEYFRAME 4 ANIMATION ACTIONS
    arm_obj.animation_data_create()

    # Bone accessors
    pose_root = arm_obj.pose.bones['root']
    pose_spine = arm_obj.pose.bones['spine']
    pose_head = arm_obj.pose.bones['head']
    pose_arm_l = arm_obj.pose.bones['arm_l']
    pose_arm_r = arm_obj.pose.bones['arm_r']
    pose_staff = arm_obj.pose.bones['staff']
    pose_gem = arm_obj.pose.bones['gem']

    for b in arm_obj.pose.bones:
        b.rotation_mode = 'XYZ'

    def reset_pose():
        for b in arm_obj.pose.bones:
            b.location = (0, 0, 0)
            b.rotation_euler = (0, 0, 0)
            b.scale = (1, 1, 1)

    # --- ACTION 1: Idle (60 frames loopable) ---
    reset_pose()
    act_idle = bpy.data.actions.new(name="Idle")
    arm_obj.animation_data.action = act_idle

    # Frame 0
    pose_spine.location = (0, 0, 0)
    pose_spine.rotation_euler = (0, 0, 0)
    pose_head.rotation_euler = (0, 0, 0)
    pose_gem.location = (0, 0, 0)
    pose_gem.rotation_euler = (0, 0, 0)
    pose_staff.rotation_euler = (0, 0, 0)

    for b in [pose_spine, pose_head, pose_gem, pose_staff]:
        b.keyframe_insert(data_path="location", frame=0)
        b.keyframe_insert(data_path="rotation_euler", frame=0)

    # Frame 30 (breathe in, gem hover & rotate)
    pose_spine.location = (0, 0, 0.04)
    pose_spine.rotation_euler = (math.radians(3), 0, 0)
    pose_head.rotation_euler = (math.radians(-4), 0, 0)
    pose_gem.location = (0, 0, 0.06)
    pose_gem.rotation_euler = (0, 0, math.radians(180))
    pose_staff.rotation_euler = (0, math.radians(2), math.radians(2))

    for b in [pose_spine, pose_head, pose_gem, pose_staff]:
        b.keyframe_insert(data_path="location", frame=30)
        b.keyframe_insert(data_path="rotation_euler", frame=30)

    # Frame 60 (smooth return to Frame 0)
    pose_spine.location = (0, 0, 0)
    pose_spine.rotation_euler = (0, 0, 0)
    pose_head.rotation_euler = (0, 0, 0)
    pose_gem.location = (0, 0, 0)
    pose_gem.rotation_euler = (0, 0, math.radians(360))
    pose_staff.rotation_euler = (0, 0, 0)

    for b in [pose_spine, pose_head, pose_gem, pose_staff]:
        b.keyframe_insert(data_path="location", frame=60)
        b.keyframe_insert(data_path="rotation_euler", frame=60)

    # Push Idle to NLA
    track_idle = arm_obj.animation_data.nla_tracks.new()
    track_idle.name = "Idle"
    track_idle.strips.new("Idle", 0, act_idle)

    # --- ACTION 2: Cast_Spell (40 frames) ---
    reset_pose()
    act_spell = bpy.data.actions.new(name="Cast_Spell")
    arm_obj.animation_data.action = act_spell

    # Frame 0: Neutral
    for b in [pose_root, pose_spine, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=0)
        b.keyframe_insert(data_path="rotation_euler", frame=0)

    # Frame 12: Draw back & gather spell power
    pose_spine.rotation_euler = (math.radians(-15), 0, math.radians(10))
    pose_arm_r.rotation_euler = (math.radians(-30), math.radians(15), 0)
    pose_staff.rotation_euler = (math.radians(-25), 0, math.radians(-10))
    pose_gem.location = (0, 0, 0.12)
    pose_gem.rotation_euler = (0, 0, math.radians(270))

    for b in [pose_spine, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=12)
        b.keyframe_insert(data_path="rotation_euler", frame=12)

    # Frame 22: SPELL STRIKE! Forward thrust & beam cast
    pose_spine.rotation_euler = (math.radians(22), 0, math.radians(-12))
    pose_arm_r.rotation_euler = (math.radians(50), 0, math.radians(-10))
    pose_staff.rotation_euler = (math.radians(45), 0, math.radians(5))
    pose_gem.location = (0, 0.15, 0.05)
    pose_gem.rotation_euler = (0, 0, math.radians(540))

    for b in [pose_spine, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=22)
        b.keyframe_insert(data_path="rotation_euler", frame=22)

    # Frame 40: Return to neutral
    reset_pose()
    for b in [pose_root, pose_spine, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=40)
        b.keyframe_insert(data_path="rotation_euler", frame=40)

    track_spell = arm_obj.animation_data.nla_tracks.new()
    track_spell.name = "Cast_Spell"
    track_spell.strips.new("Cast_Spell", 0, act_spell)

    # --- ACTION 3: Hit_Reaction (30 frames) ---
    reset_pose()
    act_hit = bpy.data.actions.new(name="Hit_Reaction")
    arm_obj.animation_data.action = act_hit

    # Frame 0: Neutral
    for b in [pose_root, pose_spine, pose_head, pose_arm_l, pose_arm_r, pose_staff]:
        b.keyframe_insert(data_path="location", frame=0)
        b.keyframe_insert(data_path="rotation_euler", frame=0)

    # Frame 8: Knockback impact!
    pose_root.location = (0, 0.18, 0)
    pose_spine.rotation_euler = (math.radians(-28), math.radians(-10), 0)
    pose_head.rotation_euler = (math.radians(-20), 0, 0)
    pose_arm_l.rotation_euler = (math.radians(-20), 0, math.radians(-30))
    pose_arm_r.rotation_euler = (math.radians(-25), 0, math.radians(30))
    pose_staff.rotation_euler = (math.radians(-30), 0, math.radians(20))

    for b in [pose_root, pose_spine, pose_head, pose_arm_l, pose_arm_r, pose_staff]:
        b.keyframe_insert(data_path="location", frame=8)
        b.keyframe_insert(data_path="rotation_euler", frame=8)

    # Frame 18: Dazed slump
    pose_root.location = (0, 0.08, -0.05)
    pose_spine.rotation_euler = (math.radians(12), 0, 0)
    pose_head.rotation_euler = (math.radians(15), 0, 0)

    for b in [pose_root, pose_spine, pose_head, pose_arm_l, pose_arm_r, pose_staff]:
        b.keyframe_insert(data_path="location", frame=18)
        b.keyframe_insert(data_path="rotation_euler", frame=18)

    # Frame 30: Recover stance
    reset_pose()
    for b in [pose_root, pose_spine, pose_head, pose_arm_l, pose_arm_r, pose_staff]:
        b.keyframe_insert(data_path="location", frame=30)
        b.keyframe_insert(data_path="rotation_euler", frame=30)

    track_hit = arm_obj.animation_data.nla_tracks.new()
    track_hit.name = "Hit_Reaction"
    track_hit.strips.new("Hit_Reaction", 0, act_hit)

    # --- ACTION 4: Victory_Dance (72 frames) ---
    reset_pose()
    act_victory = bpy.data.actions.new(name="Victory_Dance")
    arm_obj.animation_data.action = act_victory

    # Frame 0: Neutral
    for b in [pose_root, pose_spine, pose_arm_l, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=0)
        b.keyframe_insert(data_path="rotation_euler", frame=0)

    # Frame 18: Leap up!
    pose_root.location = (0, 0, 0.45)
    pose_spine.rotation_euler = (math.radians(-10), 0, 0)
    pose_arm_r.rotation_euler = (math.radians(70), 0, math.radians(10))
    pose_staff.rotation_euler = (math.radians(35), 0, 0)
    pose_gem.location = (0, 0, 0.2)

    for b in [pose_root, pose_spine, pose_arm_l, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=18)
        b.keyframe_insert(data_path="rotation_euler", frame=18)

    # Frame 36: Mid-air 360 spin (root yaw)
    pose_root.location = (0, 0, 0.5)
    pose_root.rotation_euler = (0, 0, math.radians(180))

    for b in [pose_root, pose_spine, pose_arm_l, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=36)
        b.keyframe_insert(data_path="rotation_euler", frame=36)

    # Frame 54: Land on ground & celebrate
    pose_root.location = (0, 0, 0)
    pose_root.rotation_euler = (0, 0, math.radians(360))
    pose_spine.rotation_euler = (math.radians(5), 0, 0)
    pose_arm_r.rotation_euler = (math.radians(85), 0, 0)
    pose_staff.rotation_euler = (math.radians(45), 0, 0)
    pose_gem.location = (0, 0, 0.1)

    for b in [pose_root, pose_spine, pose_arm_l, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=54)
        b.keyframe_insert(data_path="rotation_euler", frame=54)

    # Frame 72: Triumphant mage stance
    reset_pose()
    pose_arm_r.rotation_euler = (math.radians(40), 0, 0)
    pose_gem.rotation_euler = (0, 0, math.radians(360))

    for b in [pose_root, pose_spine, pose_arm_l, pose_arm_r, pose_staff, pose_gem]:
        b.keyframe_insert(data_path="location", frame=72)
        b.keyframe_insert(data_path="rotation_euler", frame=72)

    track_victory = arm_obj.animation_data.nla_tracks.new()
    track_victory.name = "Victory_Dance"
    track_victory.strips.new("Victory_Dance", 0, act_victory)

    # Unbind active action so NLA tracks control export
    arm_obj.animation_data.action = None

    # 6. EXPORT TO GLB
    if output_glb_path:
        os.makedirs(os.path.dirname(output_glb_path), exist_ok=True)
        bpy.ops.export_scene.gltf(
            filepath=output_glb_path,
            export_format='GLB',
            export_animations=True,
            export_animation_mode='NLA_TRACKS',
            export_draco_mesh_compression_enable=False,
            export_apply=True
        )
        print(f"✨ [Papyrus] Successfully exported animated character to: {output_glb_path}")

    return arm_obj

if __name__ == "__main__":
    # Path inside repo
    target_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../../assets/models/papyrus_character_animated.glb")
    )
    if len(sys.argv) > 1 and sys.argv[-1].endswith(".glb"):
        target_path = os.path.abspath(sys.argv[-1])

    build_rigged_character(target_path)
