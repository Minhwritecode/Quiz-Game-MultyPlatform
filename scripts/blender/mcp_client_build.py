"""
MCP Client to trigger scene build in running Blender instance via Main Thread Timer.
"""

import socket
import json

code = """
import bpy
import math

def do_build():
    try:
        # 1. Clear default objects
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.delete(use_global=False)

        # 2. Materials
        # Indigo Body
        mat_body = bpy.data.materials.get("M_Scroll_Body") or bpy.data.materials.new(name="M_Scroll_Body")
        mat_body.use_nodes = True
        bsdf = mat_body.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs['Base Color'].default_value = (0.25, 0.18, 0.88, 1.0)
            bsdf.inputs['Roughness'].default_value = 0.25
            bsdf.inputs['Metallic'].default_value = 0.2

        # Warm Ivory Inner
        mat_inner = bpy.data.materials.get("M_Scroll_Inner") or bpy.data.materials.new(name="M_Scroll_Inner")
        mat_inner.use_nodes = True
        bsdf_inner = mat_inner.node_tree.nodes.get("Principled BSDF")
        if bsdf_inner:
            bsdf_inner.inputs['Base Color'].default_value = (0.98, 0.96, 0.88, 1.0)
            bsdf_inner.inputs['Roughness'].default_value = 0.5

        # Glowing Gold Spark
        mat_gold = bpy.data.materials.get("M_Gold_Spark") or bpy.data.materials.new(name="M_Gold_Spark")
        mat_gold.use_nodes = True
        bsdf_gold = mat_gold.node_tree.nodes.get("Principled BSDF")
        if bsdf_gold:
            bsdf_gold.inputs['Base Color'].default_value = (1.0, 0.78, 0.12, 1.0)
            if 'Emission Color' in bsdf_gold.inputs:
                bsdf_gold.inputs['Emission Color'].default_value = (1.0, 0.8, 0.15, 1.0)
                bsdf_gold.inputs['Emission Strength'].default_value = 6.0

        # 3. Geometry
        # Stem
        bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=2.4, vertices=32, location=(-0.35, 0, 1.2))
        stem = bpy.context.active_object
        stem.name = "Papyrus_Stem"
        stem.data.materials.append(mat_body)

        # Curl
        try:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.18, major_segments=48, minor_segments=24, location=(0.15, 0, 1.8), rotation=(math.radians(90), 0, 0))
            curl = bpy.context.active_object
            curl.name = "Papyrus_Curl"
            curl.data.materials.append(mat_inner)
        except Exception:
            pass

        # Spark Core
        if hasattr(bpy.ops.mesh, "primitive_ico_sphere_add"):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.25, location=(0.6, 0, 2.5))
        elif hasattr(bpy.ops.mesh, "primitive_icosphere_add"):
            bpy.ops.mesh.primitive_icosphere_add(subdivisions=2, radius=0.25, location=(0.6, 0, 2.5))
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.25, location=(0.6, 0, 2.5))
        spark = bpy.context.active_object
        spark.name = "Papyrus_Spark_Core"
        spark.data.materials.append(mat_gold)

        # Orbit Ring
        try:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.45, minor_radius=0.03, location=(0.6, 0, 2.5), rotation=(math.radians(55), math.radians(35), 0))
            ring = bpy.context.active_object
            ring.name = "Papyrus_Orbit_Ring"
            ring.data.materials.append(mat_gold)
        except Exception:
            pass

        # Smooth Shading
        for obj in [stem, spark]:
            if obj:
                bpy.context.view_layer.objects.active = obj
                bpy.ops.object.shade_smooth()

        # Lighting
        bpy.ops.object.light_add(type='POINT', radius=0.8, location=(3.0, -3.5, 4.0))
        key = bpy.context.active_object
        key.name = "Key_Light"
        key.data.energy = 800
        key.data.color = (0.75, 0.85, 1.0)

        bpy.ops.object.light_add(type='POINT', radius=0.6, location=(-2.8, 3.0, 3.2))
        rim = bpy.context.active_object
        rim.name = "Rim_Light"
        rim.data.energy = 600
        rim.data.color = (0.78, 0.35, 1.0)

        # Camera
        bpy.ops.object.camera_add(location=(0, -5.0, 1.8), rotation=(math.radians(82), 0, 0))
        cam = bpy.context.active_object
        cam.name = "Papyrus_Camera"
        bpy.context.scene.camera = cam

        # Set Material Preview in viewport
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                for space in area.spaces:
                    if space.type == 'VIEW_3D':
                        space.shading.type = 'MATERIAL'

        print("🎉 [MCP] Successfully built Papyrus 3D scene in main thread!")
    except Exception as ex:
        print("[MCP Error]", ex)
    return None

bpy.app.timers.register(do_build)
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
