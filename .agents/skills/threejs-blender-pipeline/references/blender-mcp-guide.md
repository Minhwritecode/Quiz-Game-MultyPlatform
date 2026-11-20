# Blender MCP & Headless Python Automation Guide

This reference details the integration and methodologies of [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender) alongside headless Blender Python scripting (`bpy`) on macOS / Linux.

---

## 1. Architecture of `mcp-for-blender`

`mcp-for-blender` connects LLM agents directly into Blender's runtime using the Model Context Protocol:
1. **Blender Addon Server**: An embedded Python WebSocket/RPC server running inside Blender.
2. **MCP Client Wrapper**: A CLI/Node/Python process implementing the MCP protocol, exposing tools such as:
   - `execute_blender_code`: Executes arbitrary Python code directly inside the live Blender viewport.
   - `get_scene_info`: Retrieves active objects, materials, lights, and vertex counts.
   - `export_model`: Triggers glTF/FBX export directly from the live scene.

### Installation & Setup (macOS)
```bash
# Direct one-step installer
curl -LsSf https://www.mcp-for-blender.com/install.sh | sh

# Or via uv / uvx
uvx mcp-for-blender setup
```

---

## 2. Headless Blender Automation (No GUI Required)

Blender can also be executed completely headlessly in background mode (`-b` flag) via terminal or agent commands without requiring a display:
```bash
/Applications/Blender.app/Contents/MacOS/Blender -b --python script.py -- output.glb
```

### Complete Automation Template
```python
import bpy
import sys

def build_game_asset(output_path):
    # 1. Reset Scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # 2. Create Base Mesh
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
    pedestal = bpy.context.active_object
    pedestal.name = "Battle_Pedestal"

    # 3. Add Bevel Modifier
    bevel = pedestal.modifiers.new(name="Bevel", type='BEVEL')
    bevel.width = 0.05
    bevel.segments = 3

    # 4. Create Stylized Material
    mat = bpy.data.materials.new(name="Pedestal_Mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.23, 0.27, 0.95, 1.0) # Papyrus Indigo
        bsdf.inputs["Roughness"].default_value = 0.4

    pedestal.data.materials.append(mat)

    # 5. Export Optimized GLB
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_materials='EXPORT',
        export_draco_mesh_compression_enable=True
    )
    print(f"[BlenderPipeline] Successfully generated: {output_path}")

if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["asset.glb"]
    build_game_asset(args[0])
```

---

## 3. Best Practices for Mobile Game Assets in Papyrus
1. **Polygon Budget**:
   - Small props / cards: 200 – 1,000 triangles.
   - Character avatars: 3,000 – 8,000 triangles.
   - Interactive arenas: 5,000 – 15,000 triangles.
2. **Decimate Modifier**:
   - Always run a `DECIMATE` modifier before export if poly counts exceed budgets.
3. **Materials & Atlas**:
   - Prefer single-material atlases or procedural vertex colors over multiple high-resolution image maps.
