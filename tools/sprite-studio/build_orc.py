"""Builds the muscular Rig_OrcBrute Orc Warrior with spiked pauldron, tusks, and battleaxe."""

import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from orc_actions import apply_orc_actions
from studio_core import make_toon_material, setup_pixel_studio


def shade_mesh(obj, flat=False):
    """Apply smooth muscle curves or crisp flat steel/leather bevel facets."""
    for poly in obj.data.polygons:
        poly.use_smooth = not flat


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=16, rings=10):
    """Create a smooth rounded muscle/skull/ear ellipsoid."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*radius_xyz, 1.0)), verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=False)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_beveled_slab(name, size_xyz, center, mat, bevel=0.025, rot_deg=(0.0, 0.0, 0.0), taper_top=1.0, flat=False):
    """Create a tapered beveled muscle, armor, or leather slab."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    for v in bm.verts:
        tf = taper_top if v.co.z > 0.0 else 1.0
        v.co.x *= sx * tf
        v.co.y *= sy * (0.6 + 0.4 * tf)
        v.co.z *= sz
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=flat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.02, segs=12, flat=False):
    """Create a tapered limb, tusk, spike, or haft capsule between two points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = span.length + extend * 2.0
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_head, radius2=r_tail, depth=length
    )
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=flat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_axe_blade(name, side_sign, mat):
    """Create a crescent steel battleaxe head wing projecting left or right from haft socket."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        out = 1.0 if v.co.x * side_sign > 0.0 else 0.0
        # Flare vertically toward outer cutting edge and pinch sharp horizontally
        v.co.z *= 0.26 + 0.22 * out
        v.co.y *= 0.05 - 0.036 * out
        v.co.x = side_sign * (0.04 + 0.29 * out)
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.008, segments=1, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid body/armor part cleanly to an armature bone."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_orc_materials():
    """Create olive skin, brown leather, spiked steel, razor blade, tusk, and red eye materials."""
    return {
        "skin": make_toon_material("Orc_OliveSkin", "#364024", "#5e6e3e", "#87995b", t_mid=0.25, t_hi=0.68),
        "leather": make_toon_material("Orc_Leather", "#3b2213", "#6b4024", "#9b623b", t_mid=0.26, t_hi=0.68),
        "steel": make_toon_material("Orc_Steel", "#323842", "#657080", "#9da9ba", t_mid=0.25, t_hi=0.65),
        "blade": make_toon_material("Orc_AxeBlade", "#444d5c", "#8592a6", "#c6d2e0", t_mid=0.22, t_hi=0.58),
        "dark": make_toon_material("Orc_DarkTrim", "#15181c", "#282d34", "#404752", t_mid=0.35, t_hi=0.80),
        "tusk": make_toon_material("Orc_Tusk", "#9c9484", "#dbd3c1", "#faf6ec", t_mid=0.22, t_hi=0.68),
        "eye": make_toon_material("Orc_RedEye", "#7c1d13", "#dc2626", "#f87171", t_mid=0.08, t_hi=0.55),
    }


def build_orc_armature(root):
    """Build Rig_OrcBrute ~1.84m hulking orc warrior skeleton facing -Y with boots at z=0.0."""
    arm_data = bpy.data.armatures.new("Rig_OrcBrute")
    arm_obj = bpy.data.objects.new("Rig_OrcBrute", arm_data)
    arm_obj.parent = root
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = parent
            b.use_connect = connect
        return b

    pelvis = add_bone("Pelvis", (0.0, 0.0, 0.78), (0.0, 0.0, 0.98))
    torso = add_bone("Torso", (0.0, 0.0, 0.98), (0.0, -0.04, 1.50), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.04, 1.50), (0.0, -0.07, 1.58), torso, connect=True)
    add_bone("Head", (0.0, -0.07, 1.58), (0.0, -0.09, 1.88), neck, connect=True)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * 0.44, -0.02, 1.38), (sign * 0.52, -0.04, 1.04), torso)
        fa = add_bone(f"Forearm_{side}", (sign * 0.52, -0.04, 1.04), (sign * 0.54, -0.18, 0.72), ua, connect=True)
        add_bone(f"Hand_{side}", (sign * 0.54, -0.18, 0.72), (sign * 0.50, -0.24, 0.56), fa, connect=True)

        th = add_bone(f"Thigh_{side}", (sign * 0.21, 0.01, 0.78), (sign * 0.26, -0.06, 0.44), pelvis)
        sh = add_bone(f"Shin_{side}", (sign * 0.26, -0.06, 0.44), (sign * 0.28, 0.01, 0.14), th, connect=True)
        add_bone(f"Foot_{side}", (sign * 0.28, 0.01, 0.14), (sign * 0.29, -0.14, 0.02), sh, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def add_orc_head(parts, mats):
    """Build fierce scowling Orc head, jutting jaw, upward ivory tusks, and pointed ears."""
    skull = create_ellipsoid("Orc_Skull", (0.19, 0.20, 0.18), (0.0, -0.08, 1.72), mats["skin"])
    jaw = create_beveled_slab("Orc_Jaw", (0.31, 0.24, 0.13), (0.0, -0.165, 1.595), mats["skin"], bevel=0.03)
    brow = create_beveled_slab("Orc_Brow", (0.33, 0.14, 0.062), (0.0, -0.235, 1.745), mats["skin"], bevel=0.02, rot_deg=(-12.0, 0.0, 0.0))
    nose = create_ellipsoid("Orc_Nose", (0.055, 0.048, 0.045), (0.0, -0.272, 1.675), mats["skin"], segs=10, rings=6)
    parts += [(skull, "Head"), (jaw, "Head"), (brow, "Head"), (nose, "Head")]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        eye = create_ellipsoid(f"Orc_Eye_{side}", (0.034, 0.028, 0.028), (sign * 0.082, -0.264, 1.708), mats["eye"], segs=8, rings=6)
        tusk = create_capsule(f"Orc_Tusk_{side}", (sign * 0.082, -0.265, 1.61), (sign * 0.10, -0.285, 1.715), 0.022, 0.006, mats["tusk"], extend=0.005, segs=8)
        ear = create_capsule(f"Orc_Ear_{side}", (sign * 0.175, -0.08, 1.69), (sign * 0.30, -0.04, 1.76), 0.042, 0.010, mats["skin"], extend=0.008, segs=8)
        parts += [(eye, "Head"), (tusk, "Head"), (ear, "Head")]


def add_orc_torso_and_armor(parts, mats):
    """Build hulking olive chest, diagonal leather baldric, war belt, and loincloth."""
    chest = create_beveled_slab("Orc_Chest", (0.52, 0.40, 0.56), (0.0, -0.02, 1.24), mats["skin"], bevel=0.07, taper_top=1.42)
    pect_l = create_ellipsoid("Orc_PecL", (0.17, 0.11, 0.12), (-0.15, -0.155, 1.32), mats["skin"], rot_deg=(0.0, 0.0, -10.0))
    pect_r = create_ellipsoid("Orc_PecR", (0.17, 0.11, 0.12), (0.15, -0.155, 1.32), mats["skin"], rot_deg=(0.0, 0.0, 10.0))
    trap = create_ellipsoid("Orc_Traps", (0.36, 0.22, 0.16), (0.0, 0.04, 1.50), mats["skin"])
    strap = create_capsule("Orc_Bandolier", (-0.23, -0.255, 1.45), (0.20, -0.225, 0.98), 0.046, 0.046, mats["leather"], extend=0.01, segs=10, flat=True)
    strap_bk = create_capsule("Orc_BandolierBack", (-0.23, 0.15, 1.46), (0.20, 0.16, 0.98), 0.052, 0.052, mats["leather"], extend=0.01, segs=10, flat=True)
    buckle = create_beveled_slab("Orc_StrapBuckle", (0.10, 0.06, 0.10), (-0.015, -0.278, 1.215), mats["steel"], bevel=0.012, rot_deg=(0.0, -38.0, 0.0), flat=True)
    belt = create_beveled_slab("Orc_WarBelt", (0.58, 0.44, 0.13), (0.0, -0.01, 0.92), mats["leather"], bevel=0.025, flat=True)
    belt_bkl = create_beveled_slab("Orc_BeltBuckle", (0.16, 0.09, 0.14), (0.0, -0.23, 0.92), mats["steel"], bevel=0.015, flat=True)
    pelvis = create_beveled_slab("Orc_Pelvis", (0.52, 0.38, 0.22), (0.0, 0.0, 0.80), mats["leather"], bevel=0.03)
    loin = create_beveled_slab("Orc_Loincloth", (0.26, 0.10, 0.30), (0.0, -0.21, 0.72), mats["leather"], bevel=0.02, rot_deg=(-8.0, 0.0, 0.0), taper_top=0.88, flat=True)
    parts += [
        (chest, "Torso"), (pect_l, "Torso"), (pect_r, "Torso"), (trap, "Torso"),
        (strap, "Torso"), (strap_bk, "Torso"), (buckle, "Torso"),
        (belt, "Pelvis"), (belt_bkl, "Pelvis"), (pelvis, "Pelvis"), (loin, "Pelvis"),
    ]


def add_spiked_pauldron_and_arms(parts, mats):
    """Build spiked steel left shoulder pauldron, studded bracers, fists, and double battleaxe."""
    # Massive spiked steel pauldron on UpperArm_L
    p_dome = create_ellipsoid("Orc_Pauldron", (0.28, 0.26, 0.24), (-0.44, -0.02, 1.41), mats["steel"])
    p_rim = create_beveled_slab("Orc_PauldronRim", (0.48, 0.46, 0.07), (-0.44, -0.02, 1.29), mats["dark"], bevel=0.015, rot_deg=(0.0, -14.0, 0.0), flat=True)
    parts += [(p_dome, "UpperArm_L"), (p_rim, "UpperArm_L")]
    for sp_i, sp_rot in enumerate(((0.0, -32.0, 0.0), (24.0, -24.0, 0.0), (-24.0, -24.0, 0.0), (0.0, -58.0, 0.0))):
        e = Euler(tuple(math.radians(a) for a in sp_rot), "XYZ")
        offset = e.to_matrix() @ Vector((0.0, 0.0, 0.28))
        base = Vector((-0.44, -0.02, 1.41)) + offset * 0.65
        tip = Vector((-0.44, -0.02, 1.41)) + offset * 1.18
        spike = create_capsule(f"Orc_PauldronSpike_{sp_i}", base, tip, 0.046, 0.008, mats["blade"], extend=0.005, segs=8, flat=True)
        parts.append((spike, "UpperArm_L"))

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        bicep = create_capsule(f"Orc_UpperArm_{side}", (sign * 0.44, -0.02, 1.38), (sign * 0.52, -0.04, 1.05), 0.145, 0.125, mats["skin"], extend=0.025)
        bracer = create_capsule(f"Orc_Bracer_{side}", (sign * 0.52, -0.04, 1.04), (sign * 0.54, -0.18, 0.72), 0.145, 0.135, mats["steel"], extend=0.02, segs=8, flat=True)
        cuff = create_beveled_slab(f"Orc_Cuff_{side}", (0.28, 0.28, 0.07), (sign * 0.54, -0.17, 0.76), mats["dark"], bevel=0.012, flat=True)
        fist = create_beveled_slab(f"Orc_Fist_{side}", (0.20, 0.20, 0.18), (sign * 0.52, -0.22, 0.62), mats["skin"], bevel=0.03)
        parts += [(bicep, f"UpperArm_{side}"), (bracer, f"Forearm_{side}"), (cuff, f"Forearm_{side}"), (fist, f"Hand_{side}")]

    # Double-bladed steel battleaxe gripped in Hand_R
    haft = create_capsule("Orc_AxeHaft", (0.52, -0.06, 0.34), (0.52, -0.58, 1.18), 0.036, 0.036, mats["leather"], extend=0.01, segs=10, flat=True)
    ax_hub = create_beveled_slab("Orc_AxeHub", (0.12, 0.12, 0.18), (0.52, -0.52, 1.08), mats["dark"], bevel=0.015, rot_deg=(32.0, 0.0, 0.0), flat=True)
    ax_tip = create_capsule("Orc_AxeFinial", (0.52, -0.56, 1.15), (0.52, -0.66, 1.31), 0.034, 0.008, mats["blade"], extend=0.005, segs=8, flat=True)
    blade_l = create_axe_blade("Orc_AxeBladeL", -1.0, mats["blade"])
    blade_r = create_axe_blade("Orc_AxeBladeR", 1.0, mats["blade"])
    for blade in (blade_l, blade_r):
        blade.location = Vector((0.52, -0.52, 1.08))
        blade.rotation_euler = Euler((math.radians(32.0), 0.0, math.radians(-18.0)), "XYZ")
    parts += [(haft, "Hand_R"), (ax_hub, "Hand_R"), (ax_tip, "Hand_R"), (blade_l, "Hand_R"), (blade_r, "Hand_R")]


def add_orc_legs_and_boots(parts, mats):
    """Build muscular olive legs and thick cuffed leather war boots at z=0.0."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        thigh = create_capsule(f"Orc_Thigh_{side}", (sign * 0.21, 0.01, 0.78), (sign * 0.26, -0.06, 0.44), 0.145, 0.120, mats["skin"], extend=0.03)
        cuff = create_beveled_slab(f"Orc_BootCuff_{side}", (0.29, 0.29, 0.10), (sign * 0.265, -0.04, 0.40), mats["leather"], bevel=0.02, flat=True)
        shin = create_capsule(f"Orc_BootShin_{side}", (sign * 0.26, -0.06, 0.42), (sign * 0.28, 0.01, 0.14), 0.135, 0.125, mats["leather"], extend=0.025, segs=10)
        sole = create_beveled_slab(f"Orc_BootSole_{side}", (0.27, 0.34, 0.07), (sign * 0.285, -0.06, 0.035), mats["dark"], bevel=0.012, flat=True)
        boot_top = create_beveled_slab(f"Orc_BootTop_{side}", (0.25, 0.30, 0.12), (sign * 0.285, -0.04, 0.11), mats["leather"], bevel=0.025, taper_top=0.84)
        parts += [
            (thigh, f"Thigh_{side}"), (cuff, f"Shin_{side}"), (shin, f"Shin_{side}"),
            (sole, f"Foot_{side}"), (boot_top, f"Foot_{side}"),
        ]


def build_orc_meshes(arm_obj):
    """Assemble full Orc Warrior mesh onto Rig_OrcBrute."""
    mats = build_orc_materials()
    parts = []
    add_orc_head(parts, mats)
    add_orc_torso_and_armor(parts, mats)
    add_spiked_pauldron_and_arms(parts, mats)
    add_orc_legs_and_boots(parts, mats)

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return [p[0] for p in parts]


def compute_combined_bounds(objects):
    """Compute world-space bounds across visible mesh objects."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    xs, ys, zs = [], [], []
    for obj in objects:
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            wc = eval_obj.matrix_world @ Vector(corner)
            xs.append(wc.x); ys.append(wc.y); zs.append(wc.z)
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        "size": [round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4), round(max(zs) - min(zs), 4)],
    }


def build_orc_scene(save_blend_path=None):
    """Build complete 112px base (168px @ 48 px/m) Orc Warrior Blender scene with 5 Actions."""
    studio = setup_pixel_studio(cell_px=112, px_per_meter=32, pitch_deg=38.0, target_z=0.92)
    studio["scene"]["sprite_ground_y"] = 94
    arm_obj = build_orc_armature(studio["root"])
    meshes = build_orc_meshes(arm_obj)
    actions = apply_orc_actions("Orc", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
