"""Builds the Stylized Chibi-Heroic 3D Player (player.blend) with Male/Female, 4 Hairs, and 4 Leather Armor Slots."""

import math
import os
import sys
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

from player_actions import apply_player_actions  # noqa: E402
from studio_core import make_toon_material, setup_pixel_studio  # noqa: E402


def get_or_create_collection(name, parent=None):
    """Return a clean sub-collection linked under scene/parent for modular visibility."""
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        target = parent or bpy.context.scene.collection
        target.children.link(col)
    return col


def link_to_collection(obj, col):
    """Move an object cleanly into a single modular collection."""
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def shade_mesh(obj, flat=False):
    """Apply smooth or flat shading across mesh polygons."""
    for poly in obj.data.polygons:
        poly.use_smooth = not flat


def create_ellipsoid(name, radius_xyz, center, mat, col, rot_deg=(0.0, 0.0, 0.0), segs=16, rings=10, flat=False):
    """Create a smooth sculpted sphere/ellipsoid in the target collection."""
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
    shade_mesh(obj, flat=flat)
    bpy.context.scene.collection.objects.link(obj)
    link_to_collection(obj, col)
    return obj


def create_taper_slab(name, size_xyz, center, mat, col, bevel=0.02, rot_deg=(0.0, 0.0, 0.0), taper_top=1.0, flat=False):
    """Create a tapered beveled slab for torso, armor plates, belts, boots, and hoods."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    for v in bm.verts:
        tf = taper_top if v.co.z > 0.0 else 1.0
        v.co.x *= sx * tf
        v.co.y *= sy * (0.68 + 0.32 * tf)
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
    link_to_collection(obj, col)
    return obj


def create_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, col, extend=0.015, segs=12, flat=False):
    """Create a tapered limb, hair lock, or spike capsule between two points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = max(0.01, span.length + extend * 2.0)
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
    link_to_collection(obj, col)
    return obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid part cleanly to a Rig_Hero bone."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_player_materials():
    """Create distinct cel-shaded materials aligned with @dc2d/content palettes."""
    return {
        "skin": make_toon_material("Hero_Skin", "#c79468", "#ecc096", "#f8d7b6", t_mid=0.25, t_hi=0.70),
        "eye_white": make_toon_material("Hero_EyeWhite", "#cbd5e1", "#f8fafc", "#ffffff", t_mid=0.20, t_hi=0.65),
        "eye_iris": make_toon_material("Hero_EyeIris", "#26160c", "#5c361c", "#8c5730", t_mid=0.24, t_hi=0.70),
        "eye_pupil": make_toon_material("Hero_EyePupil", "#0b111e", "#141b2d", "#24304a", t_mid=0.50, t_hi=0.90),
        "hair": make_toon_material("Hero_Hair", "#4b2d1b", "#6d442b", "#8c5c3d", t_mid=0.26, t_hi=0.68),
        "shirt": make_toon_material("Hero_UnderShirt", "#475569", "#64748b", "#94a3b8", t_mid=0.28, t_hi=0.72),
        "pants": make_toon_material("Hero_UnderPants", "#272d38", "#3b4252", "#525e73", t_mid=0.28, t_hi=0.72),
        "hood": make_toon_material("Hero_LeatherHood", "#6f2e15", "#9a4622", "#bd5d30", t_mid=0.26, t_hi=0.70),
        "tunic": make_toon_material("Hero_LeatherTunic", "#662b13", "#8e401e", "#b5582c", t_mid=0.26, t_hi=0.70),
        "leggings": make_toon_material("Hero_LeatherLeggings", "#4f2311", "#72361c", "#914828", t_mid=0.26, t_hi=0.70),
        "boots": make_toon_material("Hero_LeatherBoots", "#3b190c", "#572814", "#783a20", t_mid=0.26, t_hi=0.70),
        "gold": make_toon_material("Hero_AccentGold", "#92400e", "#d97706", "#fbbf24", t_mid=0.22, t_hi=0.62),
        "silver": make_toon_material("Hero_AccentSilver", "#64748b", "#94a3b8", "#cbd5e1", t_mid=0.24, t_hi=0.66),
    }


def add_socket_empty(name, loc, arm_obj, bone_name, col):
    """Attach a transform socket Empty cleanly to an armature bone."""
    emp = bpy.data.objects.new(name, None)
    emp.empty_display_type = "SPHERE"
    emp.empty_display_size = 0.045
    emp.location = Vector(loc)
    bpy.context.scene.collection.objects.link(emp)
    link_to_collection(emp, col)
    bpy.context.view_layer.update()
    parent_to_bone(emp, arm_obj, bone_name)
    return emp


def build_hero_armature(root, core_col):
    """Build Rig_Hero ~1.56m Stylized Chibi-Heroic skeleton facing -Y with feet at z=0.0."""
    arm_data = bpy.data.armatures.new("Rig_Hero")
    arm_obj = bpy.data.objects.new("Rig_Hero", arm_data)
    arm_obj.parent = root
    bpy.context.scene.collection.objects.link(arm_obj)
    link_to_collection(arm_obj, core_col)
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

    pelvis = add_bone("Pelvis", (0.0, 0.0, 0.64), (0.0, 0.0, 0.76))
    torso = add_bone("Torso", (0.0, 0.0, 0.76), (0.0, -0.01, 1.07), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.01, 1.07), (0.0, -0.01, 1.13), torso, connect=True)
    add_bone("Head", (0.0, -0.01, 1.13), (0.0, -0.01, 1.56), neck, connect=True)

    # Anatomical L = +X (shield/lantern side), R = -X (weapon side facing viewer foreground in East)
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * 0.20, -0.01, 1.01), (sign * 0.23, -0.02, 0.79), torso)
        fa = add_bone(f"Forearm_{side}", (sign * 0.23, -0.02, 0.79), (sign * 0.24, -0.08, 0.58), ua, connect=True)
        add_bone(f"Hand_{side}", (sign * 0.24, -0.08, 0.58), (sign * 0.23, -0.10, 0.50), fa, connect=True)

        th = add_bone(f"Thigh_{side}", (sign * 0.105, 0.0, 0.66), (sign * 0.11, -0.02, 0.36), pelvis)
        sh = add_bone(f"Shin_{side}", (sign * 0.11, -0.02, 0.36), (sign * 0.11, 0.01, 0.10), th, connect=True)
        add_bone(f"Foot_{side}", (sign * 0.11, 0.01, 0.10), (sign * 0.11, -0.11, 0.02), sh, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    add_socket_empty("Socket_Shoulder_L", (0.20, -0.01, 1.01), arm_obj, "Torso", core_col)
    add_socket_empty("Socket_Shoulder_R", (-0.20, -0.01, 1.01), arm_obj, "Torso", core_col)
    add_socket_empty("Socket_Hand_L", (0.23, -0.09, 0.53), arm_obj, "Hand_L", core_col)
    add_socket_empty("Socket_Hand_R", (-0.23, -0.09, 0.53), arm_obj, "Hand_R", core_col)
    add_socket_empty("Socket_Head", (0.0, -0.01, 1.50), arm_obj, "Head", core_col)
    add_socket_empty("Socket_Back", (0.0, 0.13, 0.92), arm_obj, "Torso", core_col)
    return arm_obj


def add_hero_head(parts, mats, col, female=False):
    """Build expressive RPG hero skull, jaw/chin, ears, nose, and layered iris/pupil eyes."""
    tag = "Fem" if female else "Male"
    rad = (0.204, 0.186, 0.202) if female else (0.214, 0.194, 0.208)
    skull = create_ellipsoid(f"{tag}_Skull", rad, (0.0, -0.015, 1.335), mats["skin"], col, segs=18, rings=12)
    jaw = create_taper_slab(
        f"{tag}_Jaw",
        (0.24 if female else 0.28, 0.19, 0.11),
        (0.0, -0.055, 1.195),
        mats["skin"],
        col,
        bevel=0.042 if female else 0.032,
        taper_top=1.18,
    )
    chin = create_ellipsoid(
        f"{tag}_Chin",
        (0.088 if female else 0.108, 0.082, 0.052),
        (0.0, -0.095, 1.168),
        mats["skin"],
        col,
        segs=12,
        rings=8,
    )
    nose = create_ellipsoid(f"{tag}_Nose", (0.025, 0.030, 0.022), (0.0, -0.214, 1.285), mats["skin"], col, segs=10, rings=6)
    neck = create_capsule(f"{tag}_Neck", (0.0, -0.01, 1.05), (0.0, -0.01, 1.15), 0.072 if female else 0.084, 0.068, mats["skin"], col, extend=0.01)
    parts += [(skull, "Head"), (jaw, "Head"), (chin, "Head"), (nose, "Head"), (neck, "Neck")]

    for sign, side in ((1.0, "L"), (-1.0, "R")):
        ex = sign * 0.072
        ear = create_ellipsoid(f"{tag}_Ear_{side}", (0.036, 0.042, 0.054), (sign * rad[0] * 0.98, -0.01, 1.30), mats["skin"], col, segs=10, rings=8)
        sclera = create_ellipsoid(f"{tag}_EyeW_{side}", (0.050, 0.030, 0.060), (ex, -0.197, 1.328), mats["eye_white"], col, segs=12, rings=8)
        iris = create_ellipsoid(f"{tag}_EyeIris_{side}", (0.037, 0.026, 0.046), (ex - sign * 0.002, -0.208, 1.326), mats["eye_iris"], col, segs=12, rings=8)
        pupil = create_ellipsoid(f"{tag}_EyePupil_{side}", (0.026, 0.022, 0.035), (ex - sign * 0.003, -0.217, 1.325), mats["eye_pupil"], col, segs=10, rings=6)
        spec = create_ellipsoid(f"{tag}_EyeSpec_{side}", (0.013, 0.013, 0.013), (ex + sign * 0.015, -0.222, 1.348), mats["eye_white"], col, segs=8, rings=6)
        brow = create_taper_slab(
            f"{tag}_Brow_{side}",
            (0.078, 0.028, 0.020),
            (ex, -0.204, 1.396),
            mats["hair"],
            col,
            bevel=0.006,
            rot_deg=(0.0, sign * (-4.0 if female else 5.0), sign * -4.0),
        )
        parts += [(ear, "Head"), (sclera, "Head"), (iris, "Head"), (pupil, "Head"), (spec, "Head"), (brow, "Head")]
        if female:
            lash = create_taper_slab(
                f"{tag}_Lash_{side}",
                (0.052, 0.022, 0.014),
                (ex + sign * 0.021, -0.207, 1.366),
                mats["eye_pupil"],
                col,
                bevel=0.004,
                rot_deg=(0.0, sign * 12.0, sign * -6.0),
            )
            parts.append((lash, "Head"))


def add_hero_torso_and_legs(parts, mats, core_col, arm_col, female=False):
    """Build articulated bare-skin body in cloth underwear briefs/bandeau, bare legs/feet, and bare arms."""
    tag = "Fem" if female else "Male"
    if female:
        chest = create_taper_slab(f"{tag}_Chest", (0.246, 0.198, 0.22), (0.0, -0.01, 0.96), mats["skin"], core_col, bevel=0.042, taper_top=1.22)
        waist = create_taper_slab(f"{tag}_Waist", (0.162, 0.145, 0.15), (0.0, -0.005, 0.805), mats["skin"], core_col, bevel=0.028, taper_top=1.08)
        bra_band = create_taper_slab(f"{tag}_BraBand", (0.254, 0.208, 0.068), (0.0, -0.012, 0.928), mats["shirt"], core_col, bevel=0.018, taper_top=1.04)
        pelvis = create_ellipsoid(f"{tag}_Pelvis", (0.162, 0.138, 0.108), (0.0, 0.0, 0.675), mats["pants"], core_col, segs=18, rings=12)
        waistband = create_taper_slab(f"{tag}_BriefBand", (0.228, 0.192, 0.042), (0.0, 0.0, 0.742), mats["pants"], core_col, bevel=0.012)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            bust_skin = create_ellipsoid(f"{tag}_BustSkin_{side}", (0.088, 0.086, 0.078), (sign * 0.066, -0.118, 0.932), mats["skin"], core_col, segs=14, rings=10)
            bust_cup = create_ellipsoid(f"{tag}_BraCup_{side}", (0.091, 0.089, 0.070), (sign * 0.066, -0.121, 0.928), mats["shirt"], core_col, segs=14, rings=10)
            glute = create_ellipsoid(f"{tag}_Glute_{side}", (0.088, 0.086, 0.084), (sign * 0.068, 0.080, 0.648), mats["pants"], core_col, segs=14, rings=10)
            stub = create_ellipsoid(f"{tag}_ShoulderStub_{side}", (0.054, 0.054, 0.054), (sign * 0.172, -0.01, 1.00), mats["skin"], core_col, segs=10, rings=8)
            parts += [(bust_skin, "Torso"), (bust_cup, "Torso"), (glute, "Pelvis"), (stub, "Torso")]
        parts += [(chest, "Torso"), (waist, "Torso"), (bra_band, "Torso"), (pelvis, "Pelvis"), (waistband, "Pelvis")]
    else:
        chest = create_taper_slab(f"{tag}_Chest", (0.315, 0.235, 0.27), (0.0, -0.01, 0.94), mats["skin"], core_col, bevel=0.048, taper_top=1.20)
        waist = create_taper_slab(f"{tag}_Waist", (0.265, 0.21, 0.12), (0.0, -0.005, 0.78), mats["skin"], core_col, bevel=0.032, taper_top=1.08)
        pelvis = create_taper_slab(f"{tag}_Pelvis", (0.285, 0.215, 0.155), (0.0, 0.0, 0.68), mats["pants"], core_col, bevel=0.038, taper_top=1.05)
        waistband = create_taper_slab(f"{tag}_BriefBand", (0.292, 0.222, 0.042), (0.0, 0.0, 0.735), mats["pants"], core_col, bevel=0.012)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            pec = create_ellipsoid(f"{tag}_Pec_{side}", (0.072, 0.050, 0.052), (sign * 0.070, -0.105, 0.960), mats["skin"], core_col, segs=12, rings=8)
            stub = create_ellipsoid(f"{tag}_ShoulderStub_{side}", (0.064, 0.062, 0.062), (sign * 0.198, -0.01, 1.01), mats["skin"], core_col, segs=10, rings=8)
            parts += [(pec, "Torso"), (stub, "Torso")]
        parts += [(chest, "Torso"), (waist, "Torso"), (pelvis, "Pelvis"), (waistband, "Pelvis")]

    sx = 0.175 if female else 0.200
    ar_u = (0.056, 0.048) if female else (0.066, 0.056)
    ar_f = (0.048, 0.042) if female else (0.056, 0.048)
    leg_tx = 0.094 if female else 0.105
    leg_sx = 0.094 if female else 0.110
    tr = (0.072, 0.056) if female else (0.084, 0.074)
    sr = (0.056, 0.044) if female else (0.074, 0.060)
    foot_sz = (0.100, 0.178, 0.074) if female else (0.118, 0.190, 0.082)

    for sign, side in ((1.0, "L"), (-1.0, "R")):
        thigh = create_capsule(f"{tag}_Thigh_{side}", (sign * leg_tx, 0.0, 0.65), (sign * leg_sx, -0.02, 0.36), tr[0], tr[1], mats["skin"], core_col, extend=0.02)
        shin = create_capsule(f"{tag}_Shin_{side}", (sign * leg_sx, -0.02, 0.36), (sign * leg_sx, 0.01, 0.10), sr[0], sr[1], mats["skin"], core_col, extend=0.015)
        foot = create_taper_slab(f"{tag}_Foot_{side}", foot_sz, (sign * leg_sx, -0.042, 0.042), mats["skin"], core_col, bevel=0.022, taper_top=0.84)
        parts += [(thigh, f"Thigh_{side}"), (shin, f"Shin_{side}"), (foot, f"Foot_{side}")]

        ua = create_capsule(f"{tag}_UpperArm_{side}", (sign * sx, -0.01, 1.01), (sign * (sx + 0.03), -0.02, 0.79), ar_u[0], ar_u[1], mats["skin"], arm_col, extend=0.022)
        fa = create_capsule(f"{tag}_Forearm_{side}", (sign * (sx + 0.03), -0.02, 0.79), (sign * (sx + 0.04), -0.08, 0.58), ar_f[0], ar_f[1], mats["skin"], arm_col, extend=0.016)
        hand = create_ellipsoid(f"{tag}_Hand_{side}", (0.050 if female else 0.058, 0.050, 0.054), (sign * (sx + 0.035), -0.095, 0.54), mats["skin"], arm_col, segs=10, rings=8)
        parts += [(ua, f"UpperArm_{side}"), (fa, f"Forearm_{side}"), (hand, f"Hand_{side}")]


def add_hair_styles(arm_obj, mats):
    """Build 4 crisp sculpted 3D hair collections parented to Head."""
    # 1. Short Hero Crop (layered crown + asymmetrical swept fringe tufts lifted off brows)
    col_short = get_or_create_collection("Hair_Short")
    short_parts = [
        create_ellipsoid("HairShort_Cap", (0.228, 0.214, 0.176), (0.0, 0.014, 1.402), mats["hair"], col_short, rot_deg=(8.0, 0.0, 0.0), segs=18, rings=12),
        create_ellipsoid("HairShort_Nape", (0.196, 0.130, 0.145), (0.0, 0.110, 1.300), mats["hair"], col_short, rot_deg=(-12.0, 0.0, 0.0), segs=14, rings=10),
        create_capsule("HairShort_TuftL", (0.03, -0.14, 1.485), (0.105, -0.185, 1.402), 0.056, 0.014, mats["hair"], col_short, extend=0.01, segs=10),
        create_capsule("HairShort_TuftC", (-0.02, -0.15, 1.485), (-0.055, -0.194, 1.396), 0.062, 0.015, mats["hair"], col_short, extend=0.01, segs=10),
        create_capsule("HairShort_TuftR", (-0.09, -0.12, 1.472), (-0.155, -0.162, 1.390), 0.052, 0.014, mats["hair"], col_short, extend=0.01, segs=10),
        create_taper_slab("HairShort_SideL", (0.08, 0.11, 0.12), (0.185, -0.02, 1.375), mats["hair"], col_short, bevel=0.02, taper_top=0.80),
        create_taper_slab("HairShort_SideR", (0.08, 0.11, 0.12), (-0.185, -0.02, 1.375), mats["hair"], col_short, bevel=0.02, taper_top=0.80),
    ]

    # 2. Long Parted Flowing Hair
    col_long = get_or_create_collection("Hair_Long")
    long_parts = [
        create_ellipsoid("HairLong_Cap", (0.226, 0.210, 0.172), (0.0, 0.010, 1.400), mats["hair"], col_long, segs=18, rings=12),
        create_taper_slab("HairLong_BackUpper", (0.35, 0.14, 0.30), (0.0, 0.135, 1.22), mats["hair"], col_long, bevel=0.048, rot_deg=(-10.0, 0.0, 0.0), taper_top=0.78),
        create_taper_slab("HairLong_BackLower", (0.39, 0.13, 0.28), (0.0, 0.160, 0.99), mats["hair"], col_long, bevel=0.046, rot_deg=(-8.0, 0.0, 0.0), taper_top=0.88),
        create_capsule("HairLong_SideL", (0.185, -0.095, 1.38), (0.175, -0.105, 1.07), 0.068, 0.044, mats["hair"], col_long, extend=0.015),
        create_capsule("HairLong_SideR", (-0.185, -0.095, 1.38), (-0.175, -0.105, 1.07), 0.068, 0.044, mats["hair"], col_long, extend=0.015),
        create_taper_slab("HairLong_BangL", (0.14, 0.075, 0.072), (0.085, -0.155, 1.460), mats["hair"], col_long, bevel=0.022, rot_deg=(-18.0, 14.0, -18.0), taper_top=0.78),
        create_taper_slab("HairLong_BangR", (0.14, 0.075, 0.072), (-0.085, -0.155, 1.460), mats["hair"], col_long, bevel=0.022, rot_deg=(-18.0, -14.0, 18.0), taper_top=0.78),
    ]

    # 3. Tousled Spiky Hero Hair (controlled RPG spikes, clear brows)
    col_spiky = get_or_create_collection("Hair_Spiky")
    spiky_parts = [
        create_ellipsoid("HairSpiky_Cap", (0.222, 0.208, 0.165), (0.0, 0.010, 1.398), mats["hair"], col_spiky, segs=16, rings=10),
    ]
    spikes = (
        ((0.0, 0.0, 1.49), (0.0, 0.03, 1.565), 0.068),
        ((-0.08, -0.03, 1.47), (-0.17, -0.05, 1.545), 0.062),
        ((0.08, -0.03, 1.47), (0.17, -0.05, 1.545), 0.062),
        ((-0.12, 0.06, 1.43), (-0.205, 0.12, 1.495), 0.058),
        ((0.12, 0.06, 1.43), (0.205, 0.12, 1.495), 0.058),
        ((0.0, 0.11, 1.42), (0.0, 0.21, 1.485), 0.064),
        ((-0.06, -0.13, 1.455), (-0.10, -0.205, 1.438), 0.054),
        ((0.06, -0.13, 1.455), (0.10, -0.205, 1.438), 0.054),
    )
    for idx, (p0, p1, rad) in enumerate(spikes):
        spiky_parts.append(create_capsule(f"HairSpiky_Cone_{idx}", p0, p1, rad, 0.012, mats["hair"], col_spiky, extend=0.01, segs=10))

    # 4. High Arching Ponytail (visible from south/se/side/north!)
    col_pony = get_or_create_collection("Hair_Ponytail")
    pony_parts = [
        create_ellipsoid("HairPony_Cap", (0.224, 0.210, 0.170), (0.0, 0.010, 1.398), mats["hair"], col_pony, segs=18, rings=12),
        create_taper_slab("HairPony_Fringe", (0.22, 0.075, 0.068), (0.0, -0.155, 1.458), mats["hair"], col_pony, bevel=0.022, rot_deg=(-16.0, 0.0, 0.0), taper_top=0.80),
        create_ellipsoid("HairPony_Band", (0.056, 0.056, 0.056), (0.0, 0.105, 1.545), mats["gold"], col_pony, segs=12, rings=8),
        create_capsule("HairPony_PlumeA", (0.0, 0.105, 1.545), (0.045, 0.225, 1.625), 0.066, 0.082, mats["hair"], col_pony, extend=0.015),
        create_capsule("HairPony_PlumeB", (0.045, 0.225, 1.625), (0.075, 0.305, 1.38), 0.080, 0.062, mats["hair"], col_pony, extend=0.015),
        create_capsule("HairPony_PlumeC", (0.075, 0.305, 1.38), (0.055, 0.265, 1.15), 0.060, 0.024, mats["hair"], col_pony, extend=0.015),
    ]

    bpy.context.view_layer.update()
    for obj in short_parts + long_parts + spiky_parts + pony_parts:
        parent_to_bone(obj, arm_obj, "Head")
    return [col_short, col_long, col_spiky, col_pony]


def add_armor_slots(arm_obj, mats):
    """Build modular 4-slot Leather Armor collections matching concentric clearances."""
    all_parts = []
    # 1. Head: Leather Hood
    col_hood = get_or_create_collection("Armor_Head_LeatherHood")
    all_parts += [
        (create_ellipsoid("Hood_Crown", (0.242, 0.234, 0.222), (0.0, 0.018, 1.370), mats["hood"], col_hood, segs=18, rings=12), "Head"),
        (create_taper_slab("Hood_Peak", (0.20, 0.18, 0.16), (0.0, 0.170, 1.425), mats["hood"], col_hood, bevel=0.04, rot_deg=(24.0, 0.0, 0.0), taper_top=0.45), "Head"),
        (create_taper_slab("Hood_Brim", (0.31, 0.12, 0.075), (0.0, -0.145, 1.465), mats["hood"], col_hood, bevel=0.022, rot_deg=(-20.0, 0.0, 0.0)), "Head"),
        (create_taper_slab("Hood_Cowl", (0.34, 0.28, 0.14), (0.0, 0.01, 1.11), mats["hood"], col_hood, bevel=0.035, taper_top=0.84), "Torso"),
        (create_taper_slab("Hood_Clasp", (0.075, 0.04, 0.065), (0.0, -0.145, 1.07), mats["gold"], col_hood, bevel=0.01, flat=True), "Torso"),
    ]

    # 2. Chest: Male & Female Tunics + Sleeves
    cols_chest = []
    for female in (False, True):
        tag = "Female" if female else "Male"
        col_t = get_or_create_collection(f"Armor_Chest_LeatherTunic_{tag}")
        cw = 0.296 if female else 0.376
        cd = 0.244 if female else 0.296
        ww = 0.214 if female else 0.332
        hem_w = 0.348 if female else 0.382
        sx = 0.186 if female else 0.218
        all_parts += [
            (create_taper_slab(f"Tunic_{tag}_Upper", (cw, cd, 0.26), (0.0, -0.01, 0.955), mats["tunic"], col_t, bevel=0.042, taper_top=1.20), "Torso"),
            (create_taper_slab(f"Tunic_{tag}_Lower", (ww, cd * 0.98, 0.17), (0.0, -0.005, 0.78), mats["tunic"], col_t, bevel=0.028, taper_top=1.06), "Torso"),
            (create_taper_slab(f"Tunic_{tag}_Collar", (ww * 0.95, 0.19, 0.06), (0.0, -0.04, 1.07), mats["hood"], col_t, bevel=0.015), "Torso"),
            (create_taper_slab(f"Tunic_{tag}_Belt", (ww + 0.05, cd + 0.02, 0.092), (0.0, -0.005, 0.73), mats["boots"], col_t, bevel=0.016, flat=True), "Pelvis"),
            (create_taper_slab(f"Tunic_{tag}_Buckle", (0.095, 0.045, 0.088), (0.0, -cd * 0.56, 0.73), mats["gold"], col_t, bevel=0.01, flat=True), "Pelvis"),
            (create_taper_slab(f"Tunic_{tag}_Hem", (hem_w, cd * 1.10, 0.17), (0.0, -0.005, 0.64), mats["tunic"], col_t, bevel=0.024, taper_top=0.96), "Pelvis"),
        ]
        if female:
            for sign, side in ((1.0, "L"), (-1.0, "R")):
                all_parts.append((create_ellipsoid(f"Tunic_FemBust_{side}", (0.098, 0.095, 0.085), (sign * 0.070, -0.128, 0.932), mats["tunic"], col_t, segs=14, rings=10), "Torso"))
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            pad = create_ellipsoid(f"Tunic_{tag}_Pauldron_{side}", (0.092, 0.088, 0.072), (sign * sx, -0.01, 1.025), mats["hood"], col_t, rot_deg=(0.0, sign * 18.0, 0.0), segs=12, rings=8)
            all_parts.append((pad, "Torso"))

        col_sl = get_or_create_collection(f"Armor_Chest_Sleeves_{tag}")
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            ux = 0.175 if female else 0.200
            r_u = 0.068 if female else 0.080
            sl = create_capsule(f"Sleeve_{tag}_{side}", (sign * ux, -0.01, 1.01), (sign * (ux + 0.03), -0.02, 0.81), r_u, r_u * 0.88, mats["tunic"], col_sl, extend=0.015)
            br = create_capsule(f"Bracer_{tag}_{side}", (sign * (ux + 0.03), -0.02, 0.77), (sign * (ux + 0.04), -0.08, 0.59), r_u * 0.76, r_u * 0.70, mats["boots"], col_sl, extend=0.01, flat=True)
            hd = create_ellipsoid(f"SleeveHand_{tag}_{side}", (0.050 if female else 0.058, 0.050, 0.054), (sign * (ux + 0.035), -0.095, 0.54), mats["skin"], col_sl, segs=10, rings=8)
            all_parts += [(sl, f"UpperArm_{side}"), (br, f"Forearm_{side}"), (hd, f"Hand_{side}")]
        cols_chest += [col_t, col_sl]

    # 3. Legs: Tailored Male & Female Leather Leggings + Knee Pads
    cols_legs = []
    for female in (False, True):
        tag = "Female" if female else "Male"
        col_l = get_or_create_collection(f"Armor_Legs_LeatherLeggings_{tag}")
        if female:
            all_parts.append((create_ellipsoid("Leggings_Fem_Pelvis", (0.192, 0.165, 0.126), (0.0, 0.0, 0.675), mats["leggings"], col_l, segs=18, rings=12), "Pelvis"))
            for sign, side in ((1.0, "L"), (-1.0, "R")):
                all_parts.append((create_ellipsoid(f"Leggings_Fem_Glute_{side}", (0.102, 0.100, 0.096), (sign * 0.068, 0.080, 0.648), mats["leggings"], col_l, segs=14, rings=10), "Pelvis"))
        else:
            all_parts.append((create_taper_slab("Leggings_Male_Pelvis", (0.392, 0.276, 0.195), (0.0, 0.0, 0.675), mats["leggings"], col_l, bevel=0.04), "Pelvis"))
        leg_tx = 0.094 if female else 0.105
        leg_sx = 0.094 if female else 0.110
        tr_arm = (0.092, 0.072) if female else (0.120, 0.096)
        sr_arm = (0.072, 0.058) if female else (0.094, 0.080)
        for sign, side in ((1.0, "L"), (-1.0, "R")):
            th = create_capsule(f"Leggings_{tag}_Thigh_{side}", (sign * leg_tx, 0.0, 0.65), (sign * leg_sx, -0.02, 0.36), tr_arm[0], tr_arm[1], mats["leggings"], col_l, extend=0.018)
            sh = create_capsule(f"Leggings_{tag}_Shin_{side}", (sign * leg_sx, -0.02, 0.36), (sign * leg_sx, 0.01, 0.16), sr_arm[0], sr_arm[1], mats["leggings"], col_l, extend=0.012)
            knee = create_ellipsoid(f"Leggings_{tag}_Knee_{side}", (0.068 if female else 0.078, 0.062 if female else 0.068, 0.058 if female else 0.064), (sign * leg_sx, -0.055, 0.365), mats["silver"], col_l, segs=10, rings=8, flat=True)
            all_parts += [(th, f"Thigh_{side}"), (sh, f"Shin_{side}"), (knee, f"Shin_{side}")]
        cols_legs.append(col_l)

    # 4. Feet: Cuffed Leather Boots
    col_boots = get_or_create_collection("Armor_Feet_LeatherBoots")
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        cuff = create_taper_slab(f"Boot_Cuff_{side}", (0.185, 0.185, 0.07), (sign * 0.11, -0.005, 0.295), mats["tunic"], col_boots, bevel=0.016, flat=True)
        shaft = create_capsule(f"Boot_Shaft_{side}", (sign * 0.11, -0.01, 0.29), (sign * 0.11, 0.01, 0.09), 0.090, 0.084, mats["boots"], col_boots, extend=0.015)
        vamp = create_taper_slab(f"Boot_Vamp_{side}", (0.138, 0.218, 0.096), (sign * 0.11, -0.048, 0.055), mats["boots"], col_boots, bevel=0.024, taper_top=0.82)
        sole = create_taper_slab(f"Boot_Sole_{side}", (0.148, 0.230, 0.036), (sign * 0.11, -0.048, 0.018), mats["eye_pupil"], col_boots, bevel=0.008, flat=True)
        all_parts += [(cuff, f"Shin_{side}"), (shaft, f"Shin_{side}"), (vamp, f"Foot_{side}"), (sole, f"Foot_{side}")]

    bpy.context.view_layer.update()
    for obj, bone in all_parts:
        parent_to_bone(obj, arm_obj, bone)

    return [col_hood, *cols_chest, *cols_legs, col_boots]


def set_collection_visible(col, visible):
    """Toggle viewport and render visibility on a Blender collection cleanly."""
    col.hide_viewport = not visible
    col.hide_render = not visible


def build_player_scene(save_blend_path=None):
    """Build complete Stylized Chibi-Heroic Player Blender scene with Male/Female, 4 Hairs, 4 Armors & 6 Actions."""
    studio = setup_pixel_studio(cell_px=192, px_per_meter=80, pitch_deg=38.0, target_z=0.80)
    studio["scene"]["sprite_ground_y"] = 148
    core_col = get_or_create_collection("Core_Rig")
    link_to_collection(studio["root"], core_col)
    link_to_collection(studio["camera"], core_col)
    link_to_collection(studio["sun"], core_col)

    arm_obj = build_hero_armature(studio["root"], core_col)
    mats = build_player_materials()

    male_core = get_or_create_collection("Body_Male_Core")
    male_arms = get_or_create_collection("Body_Male_Arms")
    male_parts = []
    add_hero_head(male_parts, mats, male_core, female=False)
    add_hero_torso_and_legs(male_parts, mats, male_core, male_arms, female=False)

    fem_core = get_or_create_collection("Body_Female_Core")
    fem_arms = get_or_create_collection("Body_Female_Arms")
    fem_parts = []
    add_hero_head(fem_parts, mats, fem_core, female=True)
    add_hero_torso_and_legs(fem_parts, mats, fem_core, fem_arms, female=True)

    bpy.context.view_layer.update()
    for obj, bone_name in male_parts + fem_parts:
        parent_to_bone(obj, arm_obj, bone_name)

    hair_cols = add_hair_styles(arm_obj, mats)
    armor_cols = add_armor_slots(arm_obj, mats)
    actions = apply_player_actions("Hero", arm_obj.name)

    for col in [fem_core, fem_arms, *hair_cols[1:], *armor_cols]:
        set_collection_visible(col, False)
    for col in [male_core, male_arms, hair_cols[0]]:
        set_collection_visible(col, True)

    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"armature": arm_obj.name, "actions": actions}


if __name__ == "__main__":
    out_blend = os.path.join(SCRIPT_DIR, "player.blend")
    res = build_player_scene(out_blend)
    print(f"Saved {out_blend}: {res}")
