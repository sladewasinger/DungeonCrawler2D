"""Builds the highly detailed Rig_GolemTitan 3D Stone Golem with glowing runes, moss, and 5 actions."""

import math
import bmesh
import bpy
import os
import sys
_B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _p in (_B, os.path.join(_B, 'actions')):
    if _p not in sys.path:
        sys.path.insert(0, _p)
from mathutils import Euler, Matrix, Vector

from golem_actions import apply_golem_actions
from studio_core import make_toon_material, setup_pixel_studio


def shade_object(obj, flat=True):
    """Apply flat chiseled stone facets or smooth shading across polygons."""
    for poly in obj.data.polygons:
        poly.use_smooth = not flat


def link_mesh_obj(name, bm, mat, loc=(0.0, 0.0, 0.0), rot_deg=(0.0, 0.0, 0.0), flat=True):
    """Finalize bmesh into a linked Blender object with transform and material."""
    mesh = bpy.data.meshes.new(name)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(loc)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    shade_object(obj, flat=flat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_beveled_slab(name, size_xyz, center, mat, bevel=0.035, rot_deg=(0.0, 0.0, 0.0), taper_top=1.0, flat=True):
    """Build a beveled chiseled stone slab with optional top taper."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    for v in bm.verts:
        tf = taper_top if v.co.z > 0.0 else 1.0
        v.co.x *= sx * tf
        v.co.y *= sy * (0.5 + 0.5 * tf)
        v.co.z *= sz
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    return link_mesh_obj(name, bm, mat, loc=center, rot_deg=rot_deg, flat=flat)


def create_octa_limb(name, head_pt, tail_pt, r_head, r_tail, mat, segs=8, extend=0.025, flat=True):
    """Create a beveled octagonal armored stone prism aligned along a limb span."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = span.length + extend * 2.0
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_head, radius2=r_tail, depth=length
    )
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=min(r_head, r_tail) * 0.14, segments=1, affect="EDGES")
    obj = link_mesh_obj(name, bm, mat, loc=(h + t) * 0.5, flat=flat)
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    return obj


def create_boulder(name, radius_xyz, center, mat, seed=1, subdivs=2, rough=0.13, flat=True):
    """Create a faceted craggy rock boulder via seeded deterministic displacement."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivs, radius=1.0)
    rx, ry, rz = radius_xyz
    for idx, v in enumerate(bm.verts):
        n = math.sin(v.co.x * 4.3 + seed * 1.7) * math.cos(v.co.y * 5.1 + seed) * math.sin(v.co.z * 3.7 - seed)
        bump = 1.0 + rough * (n + 0.35 * math.sin(idx * 0.9 + seed))
        v.co.x *= rx * bump
        v.co.y *= ry * bump
        v.co.z *= rz * bump
    return link_mesh_obj(name, bm, mat, loc=center, flat=flat)


def create_moss_pad(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), seed=3):
    """Create an irregular thin moss cushion hugging stone seams."""
    obj = create_boulder(name, radius_xyz, center, mat, seed=seed, subdivs=2, rough=0.16, flat=False)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    return obj


def add_glow_bar(name, p0, p1, thickness, mat):
    """Build a crisp glowing runic bar segment between two 3D points."""
    return create_octa_limb(name, p0, p1, thickness, thickness, mat, segs=6, extend=thickness * 0.3, flat=True)


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid armor/stone piece to its armature bone preserving world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_golem_materials():
    """Create 5 flat cel-shaded materials matching the weathered Moss & Rune Golem palette."""
    return {
        "stone": make_toon_material("Golem_Stone", "#46423a", "#746e61", "#9e9888", t_mid=0.28, t_hi=0.70),
        "stone_hi": make_toon_material("Golem_StoneLight", "#565148", "#888273", "#b4ad9c", t_mid=0.26, t_hi=0.66),
        "crevice": make_toon_material("Golem_Crevice", "#1d1b18", "#33302a", "#4a463d", t_mid=0.35, t_hi=0.80),
        "moss": make_toon_material("Golem_Moss", "#294812", "#4b7921", "#6ea836", t_mid=0.28, t_hi=0.68),
        "glow": make_toon_material("Golem_RuneGlow", "#14a6c4", "#36ebff", "#c4feff", t_mid=0.05, t_hi=0.52),
    }


def build_golem_armature(root):
    """Build Rig_GolemTitan armature (~2.48m tall, feet at z=0.0, facing -Y)."""
    arm_data = bpy.data.armatures.new("Rig_GolemTitan")
    arm_obj = bpy.data.objects.new("Rig_GolemTitan", arm_data)
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

    pelvis = add_bone("Pelvis", (0.0, 0.0, 0.88), (0.0, 0.0, 1.14))
    torso = add_bone("Torso", (0.0, 0.0, 1.14), (0.0, -0.04, 1.92), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.04, 1.92), (0.0, -0.10, 2.04), torso, connect=True)
    add_bone("Head", (0.0, -0.10, 2.04), (0.0, -0.12, 2.48), neck, connect=True)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * 0.76, -0.02, 1.74), (sign * 0.89, -0.04, 1.24), torso)
        fa = add_bone(f"Forearm_{side}", (sign * 0.89, -0.04, 1.24), (sign * 1.00, -0.22, 0.68), ua, connect=True)
        add_bone(f"Fist_{side}", (sign * 1.00, -0.22, 0.68), (sign * 0.95, -0.24, 0.38), fa, connect=True)

        th = add_bone(f"Thigh_{side}", (sign * 0.27, 0.02, 0.90), (sign * 0.47, -0.14, 0.50), pelvis)
        sh = add_bone(f"Shin_{side}", (sign * 0.47, -0.14, 0.50), (sign * 0.52, 0.02, 0.16), th, connect=True)
        add_bone(f"Foot_{side}", (sign * 0.52, 0.02, 0.16), (sign * 0.54, -0.10, 0.02), sh, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def add_head_crown_and_visor(parts, mats):
    """Build castellated turret helmet, glowing T-visor, cheek guards, and crown moss."""
    helm = create_octa_limb("Golem_Helm", (0.0, -0.12, 1.96), (0.0, -0.12, 2.38), 0.30, 0.31, mats["stone"], segs=8)
    jaw = create_beveled_slab("Golem_Jaw", (0.42, 0.38, 0.18), (0.0, -0.17, 2.00), mats["stone_hi"], bevel=0.025)
    brow = create_beveled_slab("Golem_Brow", (0.48, 0.36, 0.11), (0.0, -0.18, 2.27), mats["stone_hi"], bevel=0.025)
    cap_dark = create_octa_limb("Golem_CrownVoid", (0.0, -0.12, 2.34), (0.0, -0.12, 2.43), 0.22, 0.22, mats["crevice"], segs=8)
    parts += [(helm, "Head"), (jaw, "Head"), (brow, "Head"), (cap_dark, "Head")]

    # Five castellated turret merlons crowning the helmet rim
    merlon_angles = (-62.0, -24.0, 0.0, 24.0, 62.0, 125.0, -125.0)
    for idx, deg in enumerate(merlon_angles):
        ang = math.radians(deg)
        mx = math.sin(ang) * 0.24
        my = -0.12 - math.cos(ang) * 0.23
        merlon = create_beveled_slab(
            f"Golem_Merlon_{idx}", (0.14, 0.12, 0.14), (mx, my, 2.41), mats["stone_hi"], bevel=0.02, rot_deg=(0.0, 0.0, -deg)
        )
        parts.append((merlon, "Head"))

    # Recessed dark T-slit + luminous cyan T-visor
    v_h = create_beveled_slab("Golem_VisorCavH", (0.31, 0.10, 0.095), (0.0, -0.36, 2.16), mats["crevice"], bevel=0.01)
    v_v = create_beveled_slab("Golem_VisorCavV", (0.10, 0.10, 0.17), (0.0, -0.36, 2.08), mats["crevice"], bevel=0.01)
    g_h = create_beveled_slab("Golem_VisorGlowH", (0.25, 0.05, 0.045), (0.0, -0.395, 2.16), mats["glow"], bevel=0.008)
    g_v = create_beveled_slab("Golem_VisorGlowV", (0.055, 0.05, 0.085), (0.0, -0.395, 2.12), mats["glow"], bevel=0.008)
    crown_moss = create_moss_pad("Golem_CrownMoss", (0.09, 0.09, 0.05), (-0.17, -0.22, 2.38), mats["moss"], seed=11)
    parts += [(v_h, "Head"), (v_v, "Head"), (g_h, "Head"), (g_v, "Head"), (crown_moss, "Head")]


def rune_pt(x, z):
    """Project (x, z) flush onto angled front pectoral stone tablets."""
    y = -0.476 + 0.177 * (abs(x) - 0.27) + 0.07 * (z - 1.58)
    return (x, y, z)


def add_chest_runes(parts, mats):
    """Build beveled pectoral stone tablets and Elder Futhark glyphs Hagalaz, Thurisaz, Algiz, Othala."""
    plate_l = create_beveled_slab("Golem_ChestPlate_L", (0.44, 0.22, 0.42), (-0.27, -0.35, 1.58), mats["stone_hi"], bevel=0.032, rot_deg=(-4.0, 0.0, -10.0))
    plate_r = create_beveled_slab("Golem_ChestPlate_R", (0.44, 0.22, 0.42), (0.27, -0.35, 1.58), mats["stone_hi"], bevel=0.032, rot_deg=(-4.0, 0.0, 10.0))
    cleft = create_beveled_slab("Golem_ChestCleft", (0.06, 0.16, 0.44), (0.0, -0.35, 1.58), mats["crevice"], bevel=0.01)
    parts += [(plate_l, "Torso"), (plate_r, "Torso"), (cleft, "Torso")]

    # Elder Futhark glyphs carved proud onto left and right chest tablets: ᚺ ᚦ | ᛉ ᛟ
    t = 0.0155
    strokes = (
        # Hagalaz (ᚺ) - double vertical staves + steep runic crossbar
        (rune_pt(-0.42, 1.44), rune_pt(-0.42, 1.71)),
        (rune_pt(-0.31, 1.44), rune_pt(-0.31, 1.71)),
        (rune_pt(-0.42, 1.65), rune_pt(-0.31, 1.50)),
        # Thurisaz (ᚦ) - stave + sharp thorn point
        (rune_pt(-0.22, 1.44), rune_pt(-0.22, 1.71)),
        (rune_pt(-0.22, 1.65), rune_pt(-0.11, 1.575)),
        (rune_pt(-0.11, 1.575), rune_pt(-0.22, 1.50)),
        # Algiz (ᛉ) - central stave + upward twin protection branches
        (rune_pt(0.18, 1.44), rune_pt(0.18, 1.71)),
        (rune_pt(0.18, 1.56), rune_pt(0.11, 1.70)),
        (rune_pt(0.18, 1.56), rune_pt(0.25, 1.70)),
        # Othala (ᛟ) - diamond enclosure + crossed lower legs
        (rune_pt(0.37, 1.71), rune_pt(0.305, 1.615)),
        (rune_pt(0.37, 1.71), rune_pt(0.435, 1.615)),
        (rune_pt(0.305, 1.615), rune_pt(0.435, 1.44)),
        (rune_pt(0.435, 1.615), rune_pt(0.305, 1.44)),
    )
    for idx, (p0, p1) in enumerate(strokes):
        parts.append((add_glow_bar(f"Golem_Rune_{idx}", p0, p1, t, mats["glow"]), "Torso"))

    # North-facing back energy diamond core & layered stone spinal plates
    spine_top = create_beveled_slab("Golem_SpinePlateTop", (0.48, 0.14, 0.34), (0.0, 0.31, 1.78), mats["stone_hi"], bevel=0.03)
    spine_bot = create_beveled_slab("Golem_SpinePlateBot", (0.42, 0.14, 0.34), (0.0, 0.28, 1.24), mats["stone_hi"], bevel=0.03)
    back_cav = create_beveled_slab("Golem_BackCav", (0.32, 0.12, 0.32), (0.0, 0.36, 1.55), mats["crevice"], bevel=0.025, rot_deg=(0.0, 45.0, 0.0))
    back_glow = create_beveled_slab("Golem_BackCore", (0.20, 0.07, 0.20), (0.0, 0.40, 1.55), mats["glow"], bevel=0.018, rot_deg=(0.0, 45.0, 0.0))
    parts += [(spine_top, "Torso"), (spine_bot, "Torso"), (back_cav, "Torso"), (back_glow, "Torso")]


def add_torso_and_moss(parts, mats):
    """Build dramatic V-taper granite chest, slim waist/abdomen, and draped moss patches."""
    torso_core = create_beveled_slab("Golem_TorsoCore", (0.76, 0.56, 0.86), (0.0, -0.02, 1.53), mats["stone"], bevel=0.06, taper_top=1.72)
    hunch_back = create_boulder("Golem_HunchBack", (0.58, 0.34, 0.34), (0.0, 0.14, 1.85), mats["stone_hi"], seed=7, rough=0.11)
    abdomen = create_beveled_slab("Golem_Abdomen", (0.64, 0.46, 0.32), (0.0, -0.02, 1.15), mats["stone"], bevel=0.04, rot_deg=(4.0, 0.0, 0.0), taper_top=1.18)
    waist_seam = create_beveled_slab("Golem_WaistSeam", (0.58, 0.44, 0.09), (0.0, -0.02, 1.00), mats["crevice"], bevel=0.015)
    pelvis_blk = create_beveled_slab("Golem_Pelvis", (0.68, 0.46, 0.26), (0.0, 0.0, 0.88), mats["stone"], bevel=0.035, taper_top=0.96)
    loin_slab = create_beveled_slab("Golem_LoinPlate", (0.26, 0.24, 0.28), (0.0, -0.20, 0.82), mats["stone_hi"], bevel=0.028)
    parts += [
        (torso_core, "Torso"), (hunch_back, "Torso"), (abdomen, "Torso"),
        (waist_seam, "Pelvis"), (pelvis_blk, "Pelvis"), (loin_slab, "Pelvis"),
    ]
    add_chest_runes(parts, mats)

    moss_specs = (
        ((-0.34, -0.25, 1.86), (0.19, 0.14, 0.05), (12.0, -24.0, -18.0), "Torso", 13),
        ((0.18, -0.32, 1.78), (0.14, 0.08, 0.05), (18.0, 14.0, 22.0), "Torso", 17),
        ((-0.10, -0.28, 1.29), (0.14, 0.07, 0.045), (0.0, 12.0, -10.0), "Torso", 19),
        ((0.20, -0.26, 1.22), (0.12, 0.06, 0.045), (0.0, -16.0, 14.0), "Torso", 23),
        ((0.02, 0.29, 1.88), (0.20, 0.13, 0.05), (-14.0, 0.0, 0.0), "Torso", 29),
        ((-0.20, -0.23, 0.96), (0.12, 0.06, 0.04), (0.0, 14.0, 0.0), "Pelvis", 31),
    )
    for idx, (pos, rad, rot, bone, seed) in enumerate(moss_specs):
        parts.append((create_moss_pad(f"Golem_TorsoMoss_{idx}", rad, pos, mats["moss"], rot_deg=rot, seed=seed), bone))


def add_arm_pair(parts, mats):
    """Build massive boulder pauldrons, trim upper arms, oversized gauntlets, and chunky fists."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        p_main = create_boulder(f"Golem_Pauldron_{side}", (0.37, 0.36, 0.38), (sign * 0.76, -0.02, 1.74), mats["stone"], seed=int(41 + sign * 5), rough=0.14)
        p_cap = create_boulder(f"Golem_PauldronCap_{side}", (0.26, 0.26, 0.18), (sign * 0.74, -0.05, 1.96), mats["stone_hi"], seed=int(53 + sign * 3), rough=0.10)
        p_crack = create_beveled_slab(f"Golem_PauldronCrack_{side}", (0.36, 0.06, 0.08), (sign * 0.82, -0.27, 1.74), mats["crevice"], bevel=0.008, rot_deg=(0.0, sign * 28.0, 0.0))
        p_moss = create_moss_pad(f"Golem_PauldronMoss_{side}", (0.15, 0.14, 0.055), (sign * 0.77, -0.13, 2.00), mats["moss"], rot_deg=(18.0, sign * 20.0, 0.0), seed=int(61 + sign * 7))

        # Trimmer upper bicep contrasting with oversized forearm gauntlet
        sh_joint = create_boulder(f"Golem_ShJoint_{side}", (0.14, 0.14, 0.14), (sign * 0.76, -0.03, 1.48), mats["crevice"], seed=4, rough=0.05)
        bicep = create_octa_limb(f"Golem_Bicep_{side}", (sign * 0.78, -0.03, 1.54), (sign * 0.89, -0.04, 1.24), 0.17, 0.155, mats["stone"], segs=8)
        elb_joint = create_boulder(f"Golem_ElbJoint_{side}", (0.135, 0.135, 0.135), (sign * 0.89, -0.05, 1.22), mats["crevice"], seed=6, rough=0.05)

        # Oversized flared stone gauntlet bracer + carved fissure rings + flush moss
        bracer = create_octa_limb(f"Golem_Bracer_{side}", (sign * 0.89, -0.04, 1.22), (sign * 1.00, -0.22, 0.68), 0.24, 0.34, mats["stone_hi"], segs=8, extend=0.025)
        b_crack1 = create_octa_limb(f"Golem_BracerCrack1_{side}", (sign * 0.928, -0.102, 1.04), (sign * 0.942, -0.126, 0.97), 0.285, 0.295, mats["crevice"], segs=8, extend=0.0)
        b_crack2 = create_octa_limb(f"Golem_BracerCrack2_{side}", (sign * 0.964, -0.161, 0.86), (sign * 0.976, -0.181, 0.79), 0.320, 0.330, mats["crevice"], segs=8, extend=0.0)
        b_moss = create_moss_pad(f"Golem_BracerMoss_{side}", (0.08, 0.13, 0.09), (sign * 1.08, -0.24, 1.00), mats["moss"], rot_deg=(0.0, sign * 12.0, 0.0), seed=int(71 + sign * 4))

        # Huge sculpted stone palm + 4 knuckle fingers + inward thumb
        palm = create_beveled_slab(f"Golem_FistPalm_{side}", (0.38, 0.38, 0.30), (sign * 0.98, -0.23, 0.50), mats["stone"], bevel=0.04)
        thumb = create_beveled_slab(f"Golem_FistThumb_{side}", (0.13, 0.16, 0.15), (sign * 0.78, -0.30, 0.52), mats["stone_hi"], bevel=0.02, rot_deg=(-22.0, sign * 14.0, sign * 24.0))
        parts += [
            (p_main, f"UpperArm_{side}"), (p_cap, f"UpperArm_{side}"), (p_crack, f"UpperArm_{side}"),
            (p_moss, f"UpperArm_{side}"), (sh_joint, f"UpperArm_{side}"), (bicep, f"UpperArm_{side}"),
            (elb_joint, f"Forearm_{side}"), (bracer, f"Forearm_{side}"), (b_crack1, f"Forearm_{side}"),
            (b_crack2, f"Forearm_{side}"), (b_moss, f"Forearm_{side}"),
            (palm, f"Fist_{side}"), (thumb, f"Fist_{side}"),
        ]
        for k in range(4):
            ky = -0.34 + k * 0.085
            knuckle = create_beveled_slab(
                f"Golem_Knuckle_{side}_{k}", (0.12, 0.095, 0.17), (sign * 1.11, ky, 0.39), mats["stone_hi"], bevel=0.018
            )
            parts.append((knuckle, f"Fist_{side}"))


def add_leg_pair(parts, mats):
    """Build wide athletic bent legs with forward knee shields and heavy slab feet at z=0.0."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        thigh = create_octa_limb(f"Golem_Thigh_{side}", (sign * 0.27, 0.02, 0.88), (sign * 0.47, -0.14, 0.50), 0.20, 0.175, mats["stone"], segs=8)
        t_moss = create_moss_pad(f"Golem_ThighMoss_{side}", (0.11, 0.10, 0.06), (sign * 0.40, -0.22, 0.68), mats["moss"], seed=int(81 + sign * 3))
        knee_cav = create_boulder(f"Golem_KneeJoint_{side}", (0.14, 0.14, 0.14), (sign * 0.47, -0.14, 0.50), mats["crevice"], seed=9, rough=0.05)
        knee_cap = create_beveled_slab(f"Golem_KneeCap_{side}", (0.28, 0.22, 0.22), (sign * 0.47, -0.26, 0.50), mats["stone_hi"], bevel=0.03)
        shin = create_octa_limb(f"Golem_Shin_{side}", (sign * 0.47, -0.14, 0.49), (sign * 0.52, 0.02, 0.16), 0.18, 0.22, mats["stone"], segs=8)
        sole = create_beveled_slab(f"Golem_FootSole_{side}", (0.38, 0.44, 0.08), (sign * 0.53, -0.06, 0.04), mats["crevice"], bevel=0.015)
        foot_top = create_beveled_slab(f"Golem_FootTop_{side}", (0.35, 0.40, 0.15), (sign * 0.53, -0.04, 0.13), mats["stone_hi"], bevel=0.03, taper_top=0.86)
        toe_l = create_beveled_slab(f"Golem_ToeIn_{side}", (0.14, 0.14, 0.10), (sign * 0.44, -0.24, 0.06), mats["stone_hi"], bevel=0.015)
        toe_r = create_beveled_slab(f"Golem_ToeOut_{side}", (0.14, 0.14, 0.10), (sign * 0.62, -0.23, 0.06), mats["stone_hi"], bevel=0.015)
        parts += [
            (thigh, f"Thigh_{side}"), (t_moss, f"Thigh_{side}"),
            (knee_cav, f"Shin_{side}"), (knee_cap, f"Shin_{side}"), (shin, f"Shin_{side}"),
            (sole, f"Foot_{side}"), (foot_top, f"Foot_{side}"), (toe_l, f"Foot_{side}"), (toe_r, f"Foot_{side}"),
        ]


def build_golem_meshes(arm_obj):
    """Assemble all sculpted granite slabs, glowing runes, and moss pads onto Rig_GolemTitan."""
    mats = build_golem_materials()
    parts = []
    add_head_crown_and_visor(parts, mats)
    add_torso_and_moss(parts, mats)
    add_arm_pair(parts, mats)
    add_leg_pair(parts, mats)

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return [p[0] for p in parts]


def compute_combined_bounds(objects):
    """Compute world-space min/max/size bounds across visible mesh objects."""
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


def build_golem_scene(save_blend_path=None):
    """Build complete 128px base (192px @ 48 px/m) Stone Golem Blender scene with 5 Actions."""
    studio = setup_pixel_studio(cell_px=128, px_per_meter=32, pitch_deg=38.0, target_z=1.24)
    studio["scene"]["sprite_ground_y"] = 112
    arm_obj = build_golem_armature(studio["root"])
    meshes = build_golem_meshes(arm_obj)
    actions = apply_golem_actions("Golem", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
