"""
PAPYRUS - BLENDER FULL SCENE BUILDER & MCP BRIDGE
Run this script inside Blender (Scripting workspace -> Run Script)
"""

import bpy
import math
import os
import socket
import threading
import json

def clear_existing_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def create_stylized_character():
    # 1. MATERIALS
    # Indigo Body
    mat_body = bpy.data.materials.get("M_Scroll_Body") or bpy.data.materials.new(name="M_Scroll_Body")
    mat_body.use_nodes = True
    nodes = mat_body.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (0.25, 0.18, 0.88, 1.0) # Vibrant Indigo
        bsdf.inputs['Roughness'].default_value = 0.25
        bsdf.inputs['Metallic'].default_value = 0.2

    # Warm Ivory Inner
    mat_inner = bpy.data.materials.get("M_Scroll_Inner") or bpy.data.materials.new(name="M_Scroll_Inner")
    mat_inner.use_nodes = True
    bsdf_inner = mat_inner.node_tree.nodes.get("Principled BSDF")
    if bsdf_inner:
        bsdf_inner.inputs['Base Color'].default_value = (0.98, 0.96, 0.88, 1.0) # Warm Ivory
        bsdf_inner.inputs['Roughness'].default_value = 0.5

    # Glowing Gold Spark Core
    mat_gold = bpy.data.materials.get("M_Gold_Spark") or bpy.data.materials.new(name="M_Gold_Spark")
    mat_gold.use_nodes = True
    bsdf_gold = mat_gold.node_tree.nodes.get("Principled BSDF")
    if bsdf_gold:
        bsdf_gold.inputs['Base Color'].default_value = (1.0, 0.78, 0.12, 1.0)
        # Emission for Blender 4+ and 3.x
        if 'Emission Color' in bsdf_gold.inputs:
            bsdf_gold.inputs['Emission Color'].default_value = (1.0, 0.8, 0.15, 1.0)
            bsdf_gold.inputs['Emission Strength'].default_value = 6.0
        elif 'Emission' in bsdf_gold.inputs:
            bsdf_gold.inputs['Emission'].default_value = (1.0, 0.8, 0.15, 1.0)

    # 2. MESH GEOMETRY
    # Vertical Scroll Stem
    bpy.ops.mesh.primitive_cylinder_add(radius=0.35, depth=2.4, vertices=32, location=(-0.35, 0, 1.2))
    stem = bpy.context.active_object
    stem.name = "Papyrus_Stem"
    stem.data.materials.append(mat_body)

    # Curved "P" Loop
    bpy.ops.mesh.primitive_torus_add(
        major_radius=0.6,
        minor_radius=0.18,
        major_segments=48,
        minor_segments=24,
        location=(0.15, 0, 1.8),
        rotation=(math.radians(90), 0, 0)
    )
    curl = bpy.context.active_object
    curl.name = "Papyrus_Curl"
    curl.data.materials.append(mat_inner)

    # Floating Spark of Knowledge (Diamond core - Blender 4.2+ uses primitive_ico_sphere_add)
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
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.45,
            minor_radius=0.03,
            location=(0.6, 0, 2.5),
            rotation=(math.radians(55), math.radians(35), 0)
        )
    except Exception:
        bpy.ops.mesh.primitive_circle_add(radius=0.45, location=(0.6, 0, 2.5), rotation=(math.radians(55), math.radians(35), 0))
    ring = bpy.context.active_object
    ring.name = "Papyrus_Orbit_Ring"
    ring.data.materials.append(mat_gold)

    # Shade smooth all parts
    for obj in [stem, curl, spark, ring]:
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.shade_smooth()

    # Join or group under an empty
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = "Papyrus_Character"
    for obj in [stem, curl, spark, ring]:
        obj.parent = root

    return root

def setup_studio_lighting():
    # Key Light (Cool blue-white)
    bpy.ops.object.light_add(type='POINT', radius=0.8, location=(3.0, -3.5, 4.0))
    key = bpy.context.active_object
    key.name = "Key_Light"
    key.data.energy = 800
    key.data.color = (0.75, 0.85, 1.0)

    # Rim Light (Violet glow from behind)
    bpy.ops.object.light_add(type='POINT', radius=0.6, location=(-2.8, 3.0, 3.2))
    rim = bpy.context.active_object
    rim.name = "Rim_Light"
    rim.data.energy = 600
    rim.data.color = (0.78, 0.35, 1.0) # Violet

    # Fill Light (Golden warm)
    bpy.ops.object.light_add(type='POINT', radius=0.5, location=(1.5, 2.0, 2.8))
    fill = bpy.context.active_object
    fill.name = "Fill_Light"
    fill.data.energy = 300
    fill.data.color = (1.0, 0.8, 0.4)

    # Camera
    bpy.ops.object.camera_add(location=(0, -5.0, 1.8), rotation=(math.radians(82), 0, 0))
    cam = bpy.context.active_object
    cam.name = "Papyrus_Camera"
    bpy.context.scene.camera = cam

def focus_and_enable_material_preview(target_obj):
    # Switch Viewport to Material Preview mode
    for area in bpy.context.screen.areas:
        if area.type == 'VIEW_3D':
            for space in area.spaces:
                if space.type == 'VIEW_3D':
                    space.shading.type = 'MATERIAL'
                    # Select character to center view
                    bpy.ops.object.select_all(action='DESELECT')
                    target_obj.select_set(True)
                    bpy.context.view_layer.objects.active = target_obj
                    for region in area.regions:
                        if region.type == 'WINDOW':
                            override = {'area': area, 'region': region, 'active_object': target_obj}
                            try:
                                bpy.ops.view3d.view_selected(override)
                            except Exception:
                                pass

# --- Lightweight MCP Server for Live Blender Session ---
SERVER_PORT = 9876
_server_thread = None
_running = True

def handle_client(conn):
    try:
        data = conn.recv(4096).decode('utf-8')
        if data:
            req = json.loads(data)
            cmd_type = req.get("type", "")
            if cmd_type == "ping":
                resp = {"status": "ok", "message": "Blender MCP server connected!"}
            elif cmd_type == "eval":
                code = req.get("code", "")
                exec(code, {"bpy": bpy, "math": math})
                resp = {"status": "ok", "message": "Code executed"}
            else:
                resp = {"status": "unknown_command"}
            conn.sendall(json.dumps(resp).encode('utf-8'))
    except Exception as e:
        conn.sendall(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
    finally:
        conn.close()

def run_server():
    global _running
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(("127.0.0.1", SERVER_PORT))
    sock.listen(5)
    sock.settimeout(1.0)
    print(f"📡 Blender MCP Live Listener started on 127.0.0.1:{SERVER_PORT}")
    while _running:
        try:
            conn, _ = sock.accept()
            threading.Thread(target=handle_client, args=(conn,), daemon=True).start()
        except socket.timeout:
            continue
        except Exception:
            break
    sock.close()

def start_mcp_listener():
    global _server_thread
    if _server_thread is None or not _server_thread.is_alive():
        _server_thread = threading.Thread(target=run_server, daemon=True)
        _server_thread.start()

# --- EXECUTE ---
clear_existing_scene()
char_root = create_stylized_character()
setup_studio_lighting()
focus_and_enable_material_preview(char_root)
start_mcp_listener()
print("🎉 Đã tạo xong nhân vật 3D Papyrus hoàn chỉnh với màu sắc & ánh sáng!")
