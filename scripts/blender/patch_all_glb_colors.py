"""
Locale-independent GLB Binary PBR + Emissive Color Patcher.
Ensures every material in assets/models/*.glb and src/shared/models3d/*.ts
has vivid, stylized RPG baseColorFactor, metallicFactor, roughnessFactor, and emissiveFactor
even when Blender runs under a non-English locale (where node name != 'Principled BSDF').
"""

import base64
import json
import os
import re
import struct

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
MODELS_DIR = os.path.join(ROOT, "assets", "models")
TS_DIR = os.path.join(ROOT, "src", "shared", "models3d")

# Material Name -> (baseColor RGBA, metallic, roughness, emissive RGB or None)
PALETTE = {
    # Redesigned Archmage Character
    "M_Warm_Skin":        ([1.00, 0.82, 0.70, 1.0], 0.02, 0.48, [0.12, 0.06, 0.04]),
    "M_Coral_Blush":      ([0.98, 0.44, 0.54, 1.0], 0.00, 0.50, [0.45, 0.12, 0.20]),
    "M_Silver_Hair":      ([0.92, 0.95, 1.00, 1.0], 0.18, 0.30, [0.10, 0.14, 0.25]),
    "M_Royal_Indigo":     ([0.22, 0.18, 0.78, 1.0], 0.16, 0.32, [0.05, 0.04, 0.22]),
    "M_Arcane_Violet":    ([0.52, 0.20, 0.92, 1.0], 0.18, 0.30, [0.12, 0.04, 0.28]),
    "M_Ruby_Cape":        ([0.90, 0.14, 0.30, 1.0], 0.14, 0.35, [0.22, 0.02, 0.06]),
    "M_Burnished_Gold":   ([1.00, 0.78, 0.16, 1.0], 0.88, 0.20, [0.28, 0.18, 0.02]),
    "M_Parchment_Ivory":  ([1.00, 0.96, 0.84, 1.0], 0.04, 0.48, [0.12, 0.10, 0.05]),
    "M_Mage_Boots":       ([0.18, 0.12, 0.32, 1.0], 0.22, 0.40, None),
    "M_Dragon_Wood":      ([0.46, 0.22, 0.10, 1.0], 0.10, 0.48, None),
    "M_Sapphire_Iris":    ([0.05, 0.22, 0.62, 1.0], 0.15, 0.14, [0.02, 0.12, 0.38]),
    "M_Cyan_Mana":        ([0.08, 0.94, 1.00, 1.0], 0.12, 0.14, [0.08, 0.92, 1.00]),
    "M_Emerald_Potion":   ([0.08, 0.95, 0.54, 1.0], 0.12, 0.16, [0.06, 0.88, 0.48]),
    "M_Star_Gold_Glow":   ([1.00, 0.86, 0.18, 1.0], 0.45, 0.16, [1.00, 0.80, 0.14]),
    "M_Eye_Sparkle":      ([1.00, 1.00, 1.00, 1.0], 0.00, 0.08, [1.00, 1.00, 1.00]),

    # Obsidian Boss Golem
    "M_Obsidian_Armor":   ([0.15, 0.12, 0.28, 1.0], 0.42, 0.30, [0.04, 0.02, 0.09]),
    "M_Basalt_Rock":      ([0.28, 0.22, 0.42, 1.0], 0.24, 0.42, None),
    "M_Molten_Lava":      ([1.00, 0.34, 0.04, 1.0], 0.10, 0.18, [1.00, 0.32, 0.02]),
    "M_Crimson_Crystal":  ([0.98, 0.10, 0.30, 1.0], 0.25, 0.15, [0.96, 0.08, 0.26]),
    "M_Boss_Gold_Crown":  ([1.00, 0.76, 0.14, 1.0], 0.90, 0.20, [0.25, 0.16, 0.02]),

    # Phoenix Arcane Crossbow
    "M_Phoenix_Gold":     ([1.00, 0.80, 0.16, 1.0], 0.90, 0.18, [0.30, 0.20, 0.02]),
    "M_Sapphire_Body":    ([0.16, 0.38, 0.96, 1.0], 0.30, 0.26, [0.04, 0.12, 0.36]),
    "M_Blazing_Arrow":    ([1.00, 0.38, 0.05, 1.0], 0.12, 0.18, [1.00, 0.36, 0.04]),
    "M_Plasma_String":    ([0.10, 0.96, 1.00, 1.0], 0.10, 0.14, [0.08, 0.92, 1.00]),

    # Royal Papyrus Scroll
    "M_Golden_Parchment": ([1.00, 0.94, 0.76, 1.0], 0.06, 0.40, [0.16, 0.13, 0.06]),
    "M_Royal_Backing":    ([0.42, 0.16, 0.88, 1.0], 0.24, 0.30, [0.10, 0.04, 0.24]),
    "M_Scroll_Gold":      ([1.00, 0.78, 0.14, 1.0], 0.92, 0.18, [0.28, 0.18, 0.02]),
    "M_Glowing_Runes":    ([0.10, 0.94, 1.00, 1.0], 0.10, 0.14, [0.08, 0.90, 1.00]),

    # Alchemy Cauldrons
    "M_Cauldron_Iron":    ([0.18, 0.16, 0.30, 1.0], 0.68, 0.30, [0.03, 0.03, 0.08]),
    "M_Cauldron_Gold":    ([1.00, 0.80, 0.16, 1.0], 0.90, 0.20, [0.24, 0.16, 0.02]),
    "M_Emerald_Elixir":   ([0.08, 0.96, 0.54, 1.0], 0.10, 0.14, [0.06, 0.92, 0.50]),
    "M_Sapphire_Elixir":  ([0.12, 0.70, 1.00, 1.0], 0.10, 0.14, [0.10, 0.68, 1.00]),
    "M_Amber_Elixir":     ([1.00, 0.66, 0.08, 1.0], 0.10, 0.14, [1.00, 0.62, 0.06]),
}


def fallback_color_by_name(name: str):
    low = name.lower()
    if "gold" in low or "amber" in low or "brass" in low:
        return ([1.0, 0.78, 0.16, 1.0], 0.88, 0.20, [0.24, 0.16, 0.02])
    if "cyan" in low or "rune" in low or "mana" in low or "crystal" in low:
        return ([0.10, 0.92, 1.00, 1.0], 0.15, 0.16, [0.08, 0.88, 1.00])
    if "parchment" in low or "scroll" in low or "paper" in low or "ivory" in low:
        return ([1.0, 0.94, 0.78, 1.0], 0.05, 0.42, [0.14, 0.11, 0.05])
    if "violet" in low or "indigo" in low or "royal" in low or "magic" in low:
        return ([0.40, 0.20, 0.88, 1.0], 0.22, 0.30, [0.10, 0.05, 0.25])
    if "fire" in low or "lava" in low or "ruby" in low or "crimson" in low:
        return ([0.96, 0.24, 0.20, 1.0], 0.15, 0.24, [0.85, 0.18, 0.08])
    if "emerald" in low or "leaf" in low or "jade" in low:
        return ([0.10, 0.88, 0.52, 1.0], 0.12, 0.28, [0.05, 0.45, 0.24])
    return None


def patch_glb_bytes(raw: bytes) -> tuple[bytes, int]:
    magic, version, total_len = struct.unpack_from("<III", raw, 0)
    if magic != 0x46546C67:
        return raw, 0
    json_len, json_type = struct.unpack_from("<II", raw, 12)
    json_bytes = raw[20 : 20 + json_len]
    rest = raw[20 + json_len :]
    doc = json.loads(json_bytes.decode("utf-8"))

    patched = 0
    for mat in doc.get("materials", []):
        mname = mat.get("name", "")
        spec = PALETTE.get(mname) or fallback_color_by_name(mname)
        if not spec:
            continue
        base_col, metallic, roughness, emissive = spec
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        pbr["baseColorFactor"] = base_col
        pbr["metallicFactor"] = metallic
        pbr["roughnessFactor"] = roughness
        if emissive:
            mat["emissiveFactor"] = emissive
        patched += 1

    if patched == 0:
        return raw, 0

    new_json = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    pad = (4 - (len(new_json) % 4)) % 4
    new_json_padded = new_json + (b" " * pad)
    new_total = 12 + 8 + len(new_json_padded) + len(rest)
    out = struct.pack("<III", magic, version, new_total) + struct.pack("<II", len(new_json_padded), json_type) + new_json_padded + rest
    return out, patched


def main():
    for fname in sorted(os.listdir(MODELS_DIR)):
        if not fname.endswith(".glb"):
            continue
        fpath = os.path.join(MODELS_DIR, fname)
        with open(fpath, "rb") as f:
            raw = f.read()
        updated, count = patch_glb_bytes(raw)
        if count > 0:
            with open(fpath, "wb") as f:
                f.write(updated)
            print(f"Patched {count} materials in assets/models/{fname}")

    b64_re = re.compile(r"(data:model/gltf-binary;base64,)([A-Za-z0-9+/=]+)")
    for fname in sorted(os.listdir(TS_DIR)):
        if not fname.endswith(".ts"):
            continue
        fpath = os.path.join(TS_DIR, fname)
        with open(fpath, "r", encoding="utf-8") as f:
            text = f.read()
        m = b64_re.search(text)
        if not m:
            continue
        raw = base64.b64decode(m.group(2))
        updated, count = patch_glb_bytes(raw)
        if count > 0:
            new_b64 = base64.b64encode(updated).decode("ascii")
            new_text = text[: m.start(2)] + new_b64 + text[m.end(2) :]
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(new_text)
            print(f"Patched {count} materials in src/shared/models3d/{fname}")


if __name__ == "__main__":
    main()
