"""Headless Blender builder rendering 48 px/m 3D cel-shaded held weapons, shield, torch, and lantern."""

import json
import math
import os
import sys
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import studio_core  # noqa: E402

PX_PER_METER = 48.0


def parse_out_dir(argv):
    args = argv[argv.index("--") + 1 :] if "--" in argv else []
    for i in range(0, len(args) - 1, 2):
        if args[i] == "--out":
            return args[i + 1]
    raise ValueError("Missing --out")


def reset_gear_studio(cell_w, cell_h):
    """Configure crisp flat front-ortho 48 px/m EEVEE studio for rotatable held gear sprites."""
    studio_core.clear_scene()
    scene = bpy.context.scene
    studio_core.configure_color_and_render(scene, cell_w)
    scene.render.resolution_x = cell_w
    scene.render.resolution_y = cell_h
    studio_core.setup_world_black(scene)

    cam_data = bpy.data.cameras.new("GearCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = max(cell_w, cell_h) / PX_PER_METER
    cam_data.sensor_fit = "AUTO"
    cam_data.clip_start = 0.1
    cam_data.clip_end = 50.0
    cam_obj = bpy.data.objects.new("GearCam", cam_data)
    scene.collection.objects.link(cam_obj)
    cam_obj.location = (0.0, -10.0, 0.0)
    studio_core.look_at(cam_obj, (0.0, 0.0, 0.0))
    scene.camera = cam_obj

    sun_data = bpy.data.lights.new("GearSun", type="SUN")
    sun_data.energy = 2.6
    sun_data.use_shadow = False
    sun_obj = bpy.data.objects.new("GearSun", sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.location = (-3.5, -4.5, 5.5)
    studio_core.look_at(sun_obj, (0.0, 0.0, 0.0))

    studio_core.make_depth_override_material(near_dist=9.2, far_dist=10.8)


def make_gear_mats():
    return {
        "wood_dk": studio_core.make_toon_material("Gear_WoodDk", "#4a2a12", "#6b3f1d", "#8d582e", 0.25, 0.68),
        "wood_lt": studio_core.make_toon_material("Gear_WoodLt", "#6b4120", "#9c6234", "#c2844e", 0.25, 0.68),
        "steel": studio_core.make_toon_material("Gear_Steel", "#475569", "#8594a8", "#d1dbe8", 0.22, 0.58),
        "steel_dk": studio_core.make_toon_material("Gear_SteelDk", "#252f3d", "#4b586b", "#778599", 0.25, 0.64),
        "gold": studio_core.make_toon_material("Gear_Gold", "#92400e", "#d97706", "#fbbf24", 0.22, 0.62),
        "cord": studio_core.make_toon_material("Gear_Cord", "#94a3b8", "#e2e8f0", "#ffffff", 0.25, 0.70),
        "flame_out": studio_core.make_toon_material("Gear_FlameOut", "#c2410c", "#f97316", "#fb923c", 0.15, 0.55),
        "flame_in": studio_core.make_toon_material("Gear_FlameIn", "#f59e0b", "#fde047", "#fef9c3", 0.10, 0.50),
        "flint": studio_core.make_toon_material("Gear_Flint", "#1e293b", "#334155", "#64748b", 0.24, 0.62),
    }


def add_box(name, size_xyz, center, mat, bevel=0.008, rot_deg=(0.0, 0.0, 0.0), flat=True):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*size_xyz, 1.0)), verts=bm.verts)
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = not flat
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_capsule(name, p0, p1, r0, r1, mat, segs=10, flat=False):
    h, t = Vector(p0), Vector(p1)
    span = t - h
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r0, radius2=r1, depth=max(0.01, span.length))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = not flat
    bpy.context.scene.collection.objects.link(obj)
    return obj


def add_ellipsoid(name, rad_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=12, rings=8):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*rad_xyz, 1.0)), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = True
    bpy.context.scene.collection.objects.link(obj)
    return obj


def render_pair(out_dir, tag):
    scene = bpy.context.scene
    vl = scene.view_layers[0]
    vl.material_override = None
    scene.render.filepath = os.path.join(out_dir, f"{tag}.png")
    bpy.ops.render.render(write_still=True)
    vl.material_override = bpy.data.materials["StudioDepthMat"]
    scene.render.filepath = os.path.join(out_dir, f"{tag}_depth.png")
    bpy.ops.render.render(write_still=True)
    vl.material_override = None


def build_sword(out_dir):
    reset_gear_studio(56, 28)
    m = make_gear_mats()
    # Grip sits around x = -0.22 (anchorX ~ 0.31 before autocrop, refined by manifest)
    add_ellipsoid("Pommel", (0.045, 0.045, 0.045), (-0.34, 0.0, 0.0), m["gold"], segs=10, rings=8)
    add_capsule("Grip", (-0.31, 0.0, 0.0), (-0.12, 0.0, 0.0), 0.026, 0.028, m["wood_dk"], segs=8)
    add_box("Guard", (0.042, 0.055, 0.19), (-0.10, 0.0, 0.0), m["gold"], bevel=0.008)
    add_box("Blade", (0.50, 0.036, 0.088), (0.16, 0.0, 0.0), m["steel"], bevel=0.006)
    add_box("Fuller", (0.36, 0.042, 0.022), (0.11, 0.0, 0.0), m["steel_dk"], bevel=0.002)
    add_capsule("Tip", (0.39, 0.0, 0.0), (0.51, 0.0, 0.0), 0.044, 0.004, m["steel"], segs=6, flat=True)
    render_pair(out_dir, "sword")


def build_axe(out_dir):
    reset_gear_studio(52, 34)
    m = make_gear_mats()
    add_ellipsoid("Pommel", (0.034, 0.034, 0.034), (-0.30, 0.0, 0.0), m["steel_dk"])
    add_capsule("Haft", (-0.29, 0.0, 0.0), (0.34, 0.0, 0.0), 0.025, 0.028, m["wood_dk"], segs=10)
    add_box("Socket", (0.09, 0.065, 0.095), (0.21, 0.0, 0.0), m["steel_dk"], bevel=0.01)
    add_box("Poll", (0.055, 0.055, 0.075), (0.20, 0.0, 0.055), m["steel_dk"], bevel=0.006)
    # Beveled bearded blade projecting downward (-Z) cleanly
    add_box("BladeInner", (0.13, 0.044, 0.12), (0.23, 0.0, -0.07), m["steel_dk"], bevel=0.006, rot_deg=(0.0, 8.0, 0.0))
    add_box("BladeEdge", (0.16, 0.024, 0.17), (0.25, 0.0, -0.115), m["steel"], bevel=0.006, rot_deg=(0.0, 6.0, 0.0))
    render_pair(out_dir, "axe")


def build_pickaxe(out_dir):
    reset_gear_studio(52, 38)
    m = make_gear_mats()
    add_capsule("Haft", (-0.29, 0.0, 0.0), (0.32, 0.0, 0.0), 0.025, 0.028, m["wood_dk"], segs=10)
    add_box("Collar", (0.095, 0.068, 0.11), (0.21, 0.0, 0.0), m["steel_dk"], bevel=0.01)
    add_capsule("PickTopA", (0.22, 0.0, 0.04), (0.17, 0.0, 0.21), 0.038, 0.022, m["steel"], segs=6, flat=True)
    add_capsule("PickTopB", (0.17, 0.0, 0.21), (0.09, 0.0, 0.30), 0.022, 0.004, m["steel"], segs=6, flat=True)
    add_capsule("PickBotA", (0.22, 0.0, -0.04), (0.17, 0.0, -0.21), 0.038, 0.022, m["steel"], segs=6, flat=True)
    add_capsule("PickBotB", (0.17, 0.0, -0.21), (0.09, 0.0, -0.30), 0.022, 0.004, m["steel"], segs=6, flat=True)
    render_pair(out_dir, "pickaxe")


def build_bow(out_dir, drawn=False):
    reset_gear_studio(40, 56)
    m = make_gear_mats()
    pull = 0.11 if drawn else 0.0
    tip_x = -0.13 - (0.05 if drawn else 0.0)
    tip_z = 0.44 - (0.03 if drawn else 0.0)
    add_box("Riser", (0.055, 0.055, 0.16), (0.05, 0.0, 0.0), m["gold"], bevel=0.012)
    for sz in (1.0, -1.0):
        add_capsule(f"LimbA_{sz}", (0.04, 0.0, sz * 0.07), (-0.01, 0.0, sz * 0.26), 0.030, 0.024, m["wood_lt"], segs=8)
        add_capsule(f"LimbB_{sz}", (-0.01, 0.0, sz * 0.26), (tip_x, 0.0, sz * tip_z), 0.024, 0.014, m["wood_dk"], segs=8)
        add_capsule(f"String_{sz}", (tip_x, 0.01, sz * tip_z), (tip_x - pull, 0.01, 0.0), 0.015, 0.015, m["cord"], segs=6)
    # Nocked arrow along X
    ax0 = tip_x - pull
    add_capsule("ArrowShaft", (ax0, 0.0, 0.0), (ax0 + 0.44, 0.0, 0.0), 0.011, 0.011, m["wood_lt"], segs=6)
    add_capsule("ArrowHead", (ax0 + 0.42, 0.0, 0.0), (ax0 + 0.50, 0.0, 0.0), 0.026, 0.003, m["steel"], segs=4, flat=True)
    add_box("Fletch", (0.065, 0.022, 0.048), (ax0 + 0.03, 0.0, 0.0), m["cord"], bevel=0.002)
    render_pair(out_dir, "bow-drawn" if drawn else "bow")


def build_shield(out_dir):
    reset_gear_studio(32, 36)
    m = make_gear_mats()
    add_ellipsoid("Rim", (0.18, 0.05, 0.20), (0.0, 0.02, 0.0), m["steel"], segs=16, rings=10)
    add_ellipsoid("WoodFace", (0.145, 0.055, 0.165), (0.0, 0.0, 0.0), m["wood_lt"], segs=14, rings=8)
    add_box("VerticalStrut", (0.032, 0.06, 0.28), (0.0, -0.01, 0.0), m["wood_dk"], bevel=0.004)
    add_ellipsoid("Boss", (0.055, 0.065, 0.060), (0.0, -0.045, 0.0), m["gold"], segs=12, rings=8)
    render_pair(out_dir, "wooden-shield")


def build_torch(out_dir):
    for f in range(4):
        reset_gear_studio(28, 48)
        m = make_gear_mats()
        sway = math.sin(f * math.pi * 0.5) * 0.028
        lift = (f % 2) * 0.025
        add_capsule("Handle", (0.0, 0.0, -0.34), (0.0, 0.0, 0.04), 0.024, 0.034, m["wood_dk"], segs=8)
        add_box("Cup", (0.085, 0.085, 0.055), (0.0, 0.0, 0.045), m["steel_dk"], bevel=0.008)
        add_capsule("FlameOut", (0.0, 0.0, 0.06), (sway, 0.0, 0.30 + lift), 0.070, 0.008, m["flame_out"], segs=10)
        add_capsule("FlameIn", (0.0, -0.02, 0.08), (sway * 0.6, -0.02, 0.23 + lift * 0.8), 0.044, 0.006, m["flame_in"], segs=10)
        render_pair(out_dir, f"torch-{f}")


def build_lantern(out_dir):
    for f in range(2):
        reset_gear_studio(28, 36)
        m = make_gear_mats()
        pulse = 0.012 if f == 0 else -0.006
        add_ellipsoid("Ring", (0.045, 0.024, 0.045), (0.0, 0.0, 0.22), m["steel"], segs=10, rings=6)
        add_box("Cap", (0.14, 0.14, 0.045), (0.0, 0.0, 0.155), m["gold"], bevel=0.01)
        add_box("Base", (0.13, 0.13, 0.04), (0.0, 0.0, -0.135), m["steel_dk"], bevel=0.008)
        for sx in (-0.055, 0.055):
            add_capsule(f"Cage_{sx}", (sx, -0.055, -0.12), (sx, -0.055, 0.14), 0.012, 0.012, m["steel_dk"], segs=6)
        add_ellipsoid("Core", (0.062 + pulse, 0.062 + pulse, 0.095 + pulse), (0.0, 0.0, 0.01), m["flame_in"], segs=12, rings=8)
        render_pair(out_dir, f"lantern-{f}")


def build_flint_dagger(out_dir):
    reset_gear_studio(42, 24)
    m = make_gear_mats()
    add_ellipsoid("Pommel", (0.032, 0.032, 0.032), (-0.28, 0.0, 0.0), m["wood_lt"], segs=8, rings=6)
    add_capsule("Grip", (-0.26, 0.0, 0.0), (-0.11, 0.0, 0.0), 0.022, 0.025, m["wood_dk"], segs=8)
    add_box("Guard", (0.032, 0.044, 0.11), (-0.09, 0.0, 0.0), m["cord"], bevel=0.006)
    add_box("BladeBase", (0.19, 0.032, 0.068), (0.02, 0.0, 0.0), m["flint"], bevel=0.005)
    add_capsule("Tip", (0.10, 0.0, 0.0), (0.28, 0.0, 0.0), 0.036, 0.003, m["steel"], segs=4, flat=True)
    render_pair(out_dir, "flint-dagger")


def build_wooden_spear(out_dir):
    reset_gear_studio(72, 24)
    m = make_gear_mats()
    add_capsule("Shaft", (-0.58, 0.0, 0.0), (0.38, 0.0, 0.0), 0.020, 0.022, m["wood_lt"], segs=10)
    add_box("Lashing", (0.09, 0.048, 0.056), (0.36, 0.0, 0.0), m["cord"], bevel=0.006)
    add_box("Socket", (0.07, 0.042, 0.052), (0.42, 0.0, 0.0), m["steel_dk"], bevel=0.005)
    add_capsule("Head", (0.44, 0.0, 0.0), (0.68, 0.0, 0.0), 0.042, 0.003, m["steel"], segs=4, flat=True)
    render_pair(out_dir, "wooden-spear")


def build_iron_greatsword(out_dir):
    reset_gear_studio(72, 34)
    m = make_gear_mats()
    add_ellipsoid("Pommel", (0.055, 0.055, 0.055), (-0.54, 0.0, 0.0), m["gold"], segs=10, rings=8)
    add_capsule("Grip", (-0.50, 0.0, 0.0), (-0.18, 0.0, 0.0), 0.030, 0.032, m["wood_dk"], segs=8)
    add_box("Guard", (0.055, 0.068, 0.28), (-0.15, 0.0, 0.0), m["steel_dk"], bevel=0.01)
    add_box("Blade", (0.64, 0.044, 0.12), (0.19, 0.0, 0.0), m["steel"], bevel=0.008)
    add_box("Fuller", (0.48, 0.052, 0.032), (0.14, 0.0, 0.0), m["steel_dk"], bevel=0.003)
    add_capsule("Tip", (0.49, 0.0, 0.0), (0.66, 0.0, 0.0), 0.060, 0.005, m["steel"], segs=6, flat=True)
    render_pair(out_dir, "iron-greatsword")


def main():
    out_dir = parse_out_dir(sys.argv)
    os.makedirs(out_dir, exist_ok=True)
    build_sword(out_dir)
    build_axe(out_dir)
    build_pickaxe(out_dir)
    build_bow(out_dir, drawn=False)
    build_bow(out_dir, drawn=True)
    build_shield(out_dir)
    build_torch(out_dir)
    build_lantern(out_dir)
    build_flint_dagger(out_dir)
    build_wooden_spear(out_dir)
    build_iron_greatsword(out_dir)
    with open(os.path.join(out_dir, "gear-meta.json"), "w", encoding="utf-8") as fh:
        json.dump({"pxPerMeter": PX_PER_METER, "scale": round(16.0 / PX_PER_METER, 4)}, fh)
    print(f"Rendered 48 px/m 3D gear frames to {out_dir}")


if __name__ == "__main__":
    main()
