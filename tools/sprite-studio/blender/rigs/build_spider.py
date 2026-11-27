"""Builds the reusable Rig_Arachnid 8-legged Widow Spider model with 5 animation clips."""

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

from arachnid_actions import apply_arachnid_actions
from studio_core import make_toon_material, setup_pixel_studio

LEG_SPECS_R = (
    (1, (0.12, -0.25, 0.24), (0.32, -0.45, 0.46), (0.44, -0.51, 0.23), (0.48, -0.55, 0.0)),
    (2, (0.14, -0.16, 0.25), (0.42, -0.20, 0.53), (0.60, -0.18, 0.25), (0.68, -0.17, 0.0)),
    (3, (0.14, -0.06, 0.25), (0.41, 0.09, 0.52), (0.58, 0.17, 0.24), (0.66, 0.22, 0.0)),
    (4, (0.11, 0.04, 0.24), (0.32, 0.34, 0.46), (0.48, 0.50, 0.22), (0.54, 0.58, 0.0)),
)


def apply_smooth_mesh(obj):
    """Enable smooth shading across polygons for organic exoskeleton curves."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=18, rings=12):
    """Create a smooth rounded exoskeleton mesh."""
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
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.018):
    """Create a smooth tapered chitin segment aligned between two 3D points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = span.length + extend * 2.0
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=12, radius1=r_head, radius2=r_tail, depth=length
    )
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="SmoothCap", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_abdomen_shell(mat):
    """Build tapered widow-spider teardrop abdomen mesh facing +Y rear."""
    mesh = bpy.data.meshes.new("Spider_Abdomen")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=22, v_segments=14, radius=1.0)
    for v in bm.verts:
        t = v.co.y
        taper = 0.85 if t < 0.0 else (1.06 - 0.35 * max(0.0, t - 0.3))
        v.co.x *= 0.255 * taper
        v.co.y *= 0.32
        v.co.z *= 0.245 * (0.94 + 0.08 * t)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Spider_Abdomen", mesh)
    obj.location = Vector((0.0, 0.25, 0.355))
    obj.rotation_euler = Euler((math.radians(-10.0), 0.0, 0.0), "XYZ")
    obj.data.materials.append(mat)
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mirror_pt(pt, sign):
    """Mirror an X>0 template point cleanly to left (-1) or right (+1)."""
    return (pt[0] * sign, pt[1], pt[2])


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid carapace/segment mesh to an armature bone preserving world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_spider_materials():
    """Create 5 cel-shaded materials matching the crimson-backed widow spider."""
    return {
        "chitin": make_toon_material("Spider_Chitin", "#171a22", "#2c313c", "#4f5868", t_mid=0.25, t_hi=0.68),
        "leg": make_toon_material("Spider_LegChitin", "#1b1f29", "#343b49", "#5c6678", t_mid=0.22, t_hi=0.64),
        "crimson": make_toon_material("Spider_Crimson", "#6e1118", "#b8222a", "#ec484a", t_mid=0.24, t_hi=0.68),
        "eye": make_toon_material("Spider_RubyEye", "#7f1d1d", "#dc2626", "#ff8888", t_mid=0.08, t_hi=0.55),
        "fang": make_toon_material("Spider_Fang", "#75685a", "#b2a492", "#e2d8ca", t_mid=0.26, t_hi=0.68),
    }


def build_arachnid_armature(root):
    """Build Rig_Arachnid skeleton with Body, Abdomen, Palps, Fangs, and 8 3-segment legs."""
    arm_data = bpy.data.armatures.new("Rig_Arachnid")
    arm_obj = bpy.data.objects.new("Rig_Arachnid", arm_data)
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

    body = add_bone("Body", (0.0, -0.02, 0.25), (0.0, -0.34, 0.22))
    add_bone("Abdomen", (0.0, 0.02, 0.27), (0.0, 0.45, 0.35), body)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        add_bone(f"Pedipalp_{side}", (sign * 0.11, -0.30, 0.21), (sign * 0.15, -0.45, 0.13), body)
        add_bone(f"Fang_{side}", (sign * 0.055, -0.34, 0.18), (sign * 0.042, -0.42, 0.09), body)
        for idx, r_pt, k_pt, m_pt, f_pt in LEG_SPECS_R:
            fe = add_bone(f"Leg{idx}_Femur_{side}", mirror_pt(r_pt, sign), mirror_pt(k_pt, sign), body)
            ti = add_bone(f"Leg{idx}_Tibia_{side}", mirror_pt(k_pt, sign), mirror_pt(m_pt, sign), fe, connect=True)
            add_bone(f"Leg{idx}_Tarsus_{side}", mirror_pt(m_pt, sign), mirror_pt(f_pt, sign), ti, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def add_body_and_markings(parts, mats):
    """Build cephalothorax, teardrop abdomen, crimson widow stripes, eyes, and fangs."""
    thorax = create_ellipsoid("Spider_Thorax", (0.18, 0.21, 0.145), (0.0, -0.18, 0.24), mats["chitin"], segs=18, rings=12)
    pedicel = create_ellipsoid("Spider_Pedicel", (0.08, 0.08, 0.075), (0.0, -0.01, 0.25), mats["chitin"], segs=12, rings=8)
    head_crown = create_ellipsoid("Spider_HeadStripe", (0.07, 0.11, 0.045), (0.0, -0.20, 0.355), mats["crimson"], segs=12, rings=8)
    abdomen = create_abdomen_shell(mats["chitin"])
    parts += [(thorax, "Body"), (pedicel, "Body"), (head_crown, "Body"), (abdomen, "Abdomen")]

    # Bold contoured dorsal crimson widow bands visible across South, Side, and North views
    ab_stripe = create_ellipsoid("Spider_WidowStripe", (0.055, 0.21, 0.055), (0.0, 0.25, 0.56), mats["crimson"], rot_deg=(-12.0, 0.0, 0.0), segs=14, rings=10)
    ab_tail_dot = create_ellipsoid("Spider_WidowTip", (0.075, 0.085, 0.075), (0.0, 0.47, 0.45), mats["crimson"], segs=12, rings=8)
    parts += [(ab_stripe, "Abdomen"), (ab_tail_dot, "Abdomen")]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        chev_f = create_capsule(f"Spider_ChevF_{side}", (0.0, 0.14, 0.555), (sign * 0.225, 0.09, 0.435), 0.038, 0.024, mats["crimson"], extend=0.012)
        chev_m = create_capsule(f"Spider_ChevM_{side}", (0.0, 0.28, 0.568), (sign * 0.248, 0.24, 0.430), 0.040, 0.024, mats["crimson"], extend=0.012)
        chev_b = create_capsule(f"Spider_ChevB_{side}", (0.0, 0.42, 0.515), (sign * 0.185, 0.42, 0.385), 0.035, 0.020, mats["crimson"], extend=0.012)
        parts += [(chev_f, "Abdomen"), (chev_m, "Abdomen"), (chev_b, "Abdomen")]

        # 3 ruby eyes per side + chelicera base + curved ivory fang + 2-segment palp
        e_main = create_ellipsoid(f"Spider_EyeMain_{side}", (0.034, 0.030, 0.034), (sign * 0.052, -0.365, 0.255), mats["eye"], segs=10, rings=8)
        e_side = create_ellipsoid(f"Spider_EyeSide_{side}", (0.024, 0.024, 0.024), (sign * 0.105, -0.335, 0.245), mats["eye"], segs=8, rings=6)
        e_top = create_ellipsoid(f"Spider_EyeTop_{side}", (0.020, 0.020, 0.020), (sign * 0.080, -0.345, 0.295), mats["eye"], segs=8, rings=6)

        chel = create_capsule(f"Spider_Chel_{side}", (sign * 0.055, -0.33, 0.19), (sign * 0.052, -0.39, 0.14), 0.038, 0.026, mats["chitin"], extend=0.01)
        fang = create_capsule(f"Spider_Fang_{side}", (sign * 0.052, -0.39, 0.14), (sign * 0.035, -0.43, 0.075), 0.022, 0.006, mats["fang"], extend=0.005)
        palp1 = create_capsule(f"Spider_Palp1_{side}", (sign * 0.11, -0.30, 0.21), (sign * 0.16, -0.39, 0.20), 0.028, 0.022, mats["leg"], extend=0.01)
        palp2 = create_capsule(f"Spider_Palp2_{side}", (sign * 0.16, -0.39, 0.20), (sign * 0.14, -0.46, 0.12), 0.022, 0.012, mats["leg"], extend=0.008)
        parts += [
            (e_main, "Body"), (e_side, "Body"), (e_top, "Body"),
            (chel, f"Fang_{side}"), (fang, f"Fang_{side}"),
            (palp1, f"Pedipalp_{side}"), (palp2, f"Pedipalp_{side}"),
        ]


def add_eight_legs(parts, mats):
    """Build 8 multi-jointed curved chitin legs across all 4 pairs (L & R)."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        for idx, r_pt, k_pt, m_pt, f_pt in LEG_SPECS_R:
            r, k, m, f = (mirror_pt(p, sign) for p in (r_pt, k_pt, m_pt, f_pt))
            femur = create_capsule(f"Spider_Leg{idx}_Femur_{side}", r, k, 0.048, 0.036, mats["leg"], extend=0.015)
            knee = create_ellipsoid(f"Spider_Leg{idx}_Knee_{side}", (0.046, 0.046, 0.046), k, mats["chitin"], segs=10, rings=8)
            tibia = create_capsule(f"Spider_Leg{idx}_Tibia_{side}", k, m, 0.038, 0.026, mats["leg"], extend=0.012)
            joint = create_ellipsoid(f"Spider_Leg{idx}_Joint_{side}", (0.030, 0.030, 0.030), m, mats["chitin"], segs=8, rings=6)
            tarsus = create_capsule(f"Spider_Leg{idx}_Tarsus_{side}", m, f, 0.026, 0.010, mats["chitin"], extend=0.008)
            parts += [
                (femur, f"Leg{idx}_Femur_{side}"),
                (knee, f"Leg{idx}_Femur_{side}"),
                (tibia, f"Leg{idx}_Tibia_{side}"),
                (joint, f"Leg{idx}_Tibia_{side}"),
                (tarsus, f"Leg{idx}_Tarsus_{side}"),
            ]


def build_spider_meshes(arm_obj):
    """Assemble spider body parts, widow markings, eyes, fangs, and 8 legs onto Rig_Arachnid."""
    mats = build_spider_materials()
    parts = []
    add_body_and_markings(parts, mats)
    add_eight_legs(parts, mats)

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


def build_spider_scene(save_blend_path=None):
    """Build complete 80px base (120px @ 48 px/m) Widow Spider Blender scene with 5 Actions."""
    studio = setup_pixel_studio(cell_px=80, px_per_meter=32, pitch_deg=38.0, target_z=0.35)
    studio["scene"]["sprite_ground_y"] = 64
    arm_obj = build_arachnid_armature(studio["root"])
    meshes = build_spider_meshes(arm_obj)
    actions = apply_arachnid_actions("Spider", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
