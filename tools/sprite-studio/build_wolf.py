"""Builds the reusable Rig_Quadruped Timber Wolf model with pounce attack and 5 clips."""

import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from quadruped_actions import (
    ALL_QUADRUPED_BONES,
    bind_action_for_edit,
    build_corpse_action,
    build_idle_action,
    build_run_action,
    build_walk_action,
    key_pose_bones,
    prepare_clean_action,
    reset_pose_bones,
    set_world_loc,
    set_world_rot,
)
from studio_core import make_toon_material, setup_pixel_studio


def apply_smooth_mesh(obj):
    """Enable smooth shading for sleek canine fur silhouettes."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=16, rings=10):
    """Create a smooth rounded ellipsoid volume."""
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


def build_lofted_tube(name, sections, mat, segs=18):
    """Create continuous lofted body mesh from [(y, z_center, rx, rz), ...] sections."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for y, zc, rx, rz in sections:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ring.append(bm.verts.new((math.cos(ang) * rx, y, zc + math.sin(ang) * rz)))
        rings.append(ring)
    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        for s in range(segs):
            ns = (s + 1) % segs
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="SmoothSub", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bind_trunk_armature(obj, arm_obj):
    """Weight continuous wolf trunk smoothly across Pelvis, Spine, and Neck."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vg_pel = obj.vertex_groups.new(name="Pelvis")
    vg_spn = obj.vertex_groups.new(name="Spine")
    vg_nck = obj.vertex_groups.new(name="Neck")
    for v in obj.data.vertices:
        y = v.co.y
        w_pel = max(0.0, min(1.0, (y - 0.04) / 0.24))
        w_nck = max(0.0, min(1.0, (-0.24 - y) / 0.20))
        w_spn = max(0.0, 1.0 - w_pel - w_nck)
        if w_pel > 0.0:
            vg_pel.add([v.index], w_pel, "REPLACE")
        if w_spn > 0.0:
            vg_spn.add([v.index], w_spn, "REPLACE")
        if w_nck > 0.0:
            vg_nck.add([v.index], w_nck, "REPLACE")


def create_bone_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.025):
    """Create tapered canine limb/ear/snout segment aligned between two points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = span.length + extend * 2.0
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=14, radius1=r_head, radius2=r_tail, depth=length
    )
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="SmoothCaps", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_plume_tail(mat):
    """Create thick curved swooping timber-wolf plume tail."""
    segs = 12
    pts = (
        (0.36, 0.50, 0.045),
        (0.45, 0.50, 0.075),
        (0.55, 0.54, 0.095),
        (0.62, 0.64, 0.088),
        (0.61, 0.74, 0.060),
        (0.54, 0.80, 0.018),
    )
    mesh = bpy.data.meshes.new("Wolf_Tail")
    bm = bmesh.new()
    rings = []
    for y, z, r in pts:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ring.append(bm.verts.new((math.cos(ang) * r * 0.82, y, z + math.sin(ang) * r)))
        rings.append(ring)
    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        for s in range(segs):
            ns = (s + 1) % segs
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new("Wolf_Tail", mesh)
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="TailSmooth", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid mesh part cleanly to an armature bone preserving world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_wolf_armature(root):
    """Build sleek Rig_Quadruped wolf skeleton facing -Y with paws at z=0.0."""
    arm_data = bpy.data.armatures.new("Rig_Quadruped")
    arm_obj = bpy.data.objects.new("Rig_Quadruped", arm_data)
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

    pelvis = add_bone("Pelvis", (0.0, 0.32, 0.50), (0.0, 0.04, 0.51))
    spine = add_bone("Spine", (0.0, 0.04, 0.51), (0.0, -0.28, 0.55), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.28, 0.55), (0.0, -0.44, 0.62), spine, connect=True)
    head = add_bone("Head", (0.0, -0.44, 0.62), (0.0, -0.74, 0.56), neck, connect=True)
    add_bone("Tail", (0.0, 0.36, 0.50), (0.0, 0.60, 0.72), pelvis)
    add_bone("Ear_L", (-0.11, -0.46, 0.72), (-0.17, -0.42, 0.90), head)
    add_bone("Ear_R", (0.11, -0.46, 0.72), (0.17, -0.42, 0.90), head)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        fu = add_bone(f"FrontUpper_{side}", (sign * 0.145, -0.26, 0.49), (sign * 0.145, -0.23, 0.24), spine)
        add_bone(f"FrontLower_{side}", (sign * 0.145, -0.23, 0.24), (sign * 0.145, -0.27, 0.02), fu, connect=True)
        bu = add_bone(f"BackUpper_{side}", (sign * 0.135, 0.28, 0.49), (sign * 0.135, 0.33, 0.24), pelvis)
        add_bone(f"BackLower_{side}", (sign * 0.135, 0.33, 0.24), (sign * 0.135, 0.28, 0.02), bu, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def build_wolf_attack_action(arm_obj, prefix="Wolf"):
    """Build 6-frame wolf crouch-snarl windup (F1-3) -> pounce bite lunge (F4-6)."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=12, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    poses = (
        (0.03, -0.05, 8.0, 6.0, -8.0, 12.0, -18.0, 28.0, 16.0),
        (0.06, -0.08, 12.0, 10.0, -12.0, 16.0, -28.0, 40.0, 24.0),
        (0.08, -0.10, 14.0, 12.0, -14.0, 18.0, -34.0, 46.0, 30.0),
        (-0.14, 0.08, -14.0, 10.0, 8.0, 14.0, -56.0, 18.0, 52.0),
        (-0.09, 0.04, -8.0, 6.0, 6.0, 10.0, -36.0, 22.0, 34.0),
        (-0.02, 0.00, 0.0, 0.0, 0.0, 0.0, -10.0, 8.0, 10.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, pel_rx, sp_rx, nk_rx, hd_rx, f_up, f_lo, b_up = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Pelvis"], pel_rx, 0.0, 0.0)
        set_world_rot(pb["Spine"], sp_rx, 0.0, 0.0)
        set_world_rot(pb["Neck"], nk_rx, 0.0, 0.0)
        set_world_rot(pb["Head"], hd_rx, 0.0, 0.0)
        set_world_rot(pb["Tail"], -12.0 if f <= 3 else 20.0, 0.0, 0.0)
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            set_world_rot(pb["Ear_" + side], 18.0 if f <= 3 else -6.0, 0.0, sign * 12.0)
            set_world_rot(pb[f"FrontUpper_{side}"], f_up, 0.0, 0.0)
            set_world_rot(pb[f"FrontLower_{side}"], f_lo, 0.0, 0.0)
            set_world_rot(pb[f"BackUpper_{side}"], b_up, 0.0, 0.0)
            set_world_rot(pb[f"BackLower_{side}"], -12.0 if b_up > 25.0 else 6.0, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_wolf_meshes(arm_obj):
    """Assemble weighted athletic wolf trunk, ruff, snout, amber eyes, ears, plume tail, and legs."""
    fur = make_toon_material("Wolf_SlateFur", "#323c48", "#5b6a7c", "#8ea2b8", t_mid=0.25, t_hi=0.68)
    frost = make_toon_material("Wolf_FrostRuff", "#6f7d8f", "#aebccf", "#e1eaf2", t_mid=0.22, t_hi=0.66)
    paw_mat = make_toon_material("Wolf_DarkPaw", "#171b22", "#2a303b", "#434c5c", t_mid=0.26, t_hi=0.70)
    eye_mat = make_toon_material("Wolf_AmberEye", "#9c4a08", "#f59e0b", "#fde047", t_mid=0.06, t_hi=0.52)
    fang_mat = make_toon_material("Wolf_Fang", "#9c9484", "#dbd3c1", "#faf6ec", t_mid=0.24, t_hi=0.68)

    # Athletic broad chest & narrow waist via single smooth weighted loft
    trunk_sections = (
        (0.41, 0.50, 0.06, 0.05),
        (0.32, 0.51, 0.16, 0.15),
        (0.14, 0.50, 0.15, 0.135),
        (-0.04, 0.52, 0.17, 0.16),
        (-0.22, 0.55, 0.21, 0.20),
        (-0.34, 0.58, 0.20, 0.19),
        (-0.46, 0.62, 0.14, 0.14),
    )
    trunk = build_lofted_tube("Wolf_Trunk", trunk_sections, fur, segs=18)
    bind_trunk_armature(trunk, arm_obj)

    parts = []
    # Hackles / frosty chest ruff + pointed head + open-jaw snout + plume tail
    hackles = create_ellipsoid("Wolf_Hackles", (0.21, 0.16, 0.17), (0.0, -0.32, 0.60), fur, rot_deg=(-16.0, 0.0, 0.0))
    ruff = create_ellipsoid("Wolf_ChestRuff", (0.165, 0.13, 0.13), (0.0, -0.36, 0.50), frost, rot_deg=(-18.0, 0.0, 0.0))
    skull = create_ellipsoid("Wolf_Skull", (0.165, 0.175, 0.15), (0.0, -0.49, 0.63), fur)
    cheek_ruff = create_ellipsoid("Wolf_CheekRuff", (0.175, 0.105, 0.095), (0.0, -0.49, 0.565), frost)
    snout_top = create_bone_capsule("Wolf_SnoutTop", (0.0, -0.57, 0.62), (0.0, -0.78, 0.56), 0.084, 0.042, fur, extend=0.012)
    snout_bot = create_bone_capsule("Wolf_SnoutJaw", (0.0, -0.56, 0.545), (0.0, -0.75, 0.515), 0.064, 0.034, frost, extend=0.010)
    nose = create_ellipsoid("Wolf_Nose", (0.036, 0.034, 0.030), (0.0, -0.79, 0.565), paw_mat, segs=10, rings=8)
    tail = create_plume_tail(fur)
    parts += [
        (hackles, "Spine"), (ruff, "Neck"), (skull, "Head"), (cheek_ruff, "Head"),
        (snout_top, "Head"), (snout_bot, "Head"), (nose, "Head"), (tail, "Tail"),
    ]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        eye = create_ellipsoid(f"Wolf_Eye_{side}", (0.024, 0.022, 0.024), (sign * 0.092, -0.615, 0.652), eye_mat, segs=8, rings=6)
        brow = create_ellipsoid(f"Wolf_Brow_{side}", (0.042, 0.034, 0.020), (sign * 0.092, -0.595, 0.672), fur, rot_deg=(0.0, -sign * 20.0, 0.0), segs=10, rings=6)
        fang = create_bone_capsule(f"Wolf_Fang_{side}", (sign * 0.036, -0.71, 0.56), (sign * 0.036, -0.71, 0.51), 0.012, 0.004, fang_mat, extend=0.004)
        ear = create_bone_capsule(f"Wolf_Ear_{side}", (sign * 0.105, -0.46, 0.72), (sign * 0.17, -0.42, 0.91), 0.056, 0.010, fur, extend=0.012)

        fu = create_bone_capsule(f"Wolf_FrontUp_{side}", (sign * 0.145, -0.26, 0.49), (sign * 0.145, -0.23, 0.24), 0.072, 0.052, fur, extend=0.028)
        fl = create_bone_capsule(f"Wolf_FrontLo_{side}", (sign * 0.145, -0.23, 0.24), (sign * 0.145, -0.27, 0.045), 0.048, 0.040, fur, extend=0.022)
        fp = create_ellipsoid(f"Wolf_FrontPaw_{side}", (0.048, 0.060, 0.035), (sign * 0.145, -0.285, 0.035), paw_mat, segs=10, rings=6)

        bu = create_bone_capsule(f"Wolf_BackUp_{side}", (sign * 0.135, 0.28, 0.49), (sign * 0.135, 0.33, 0.24), 0.078, 0.052, fur, extend=0.028)
        bl = create_bone_capsule(f"Wolf_BackLo_{side}", (sign * 0.135, 0.33, 0.24), (sign * 0.135, 0.28, 0.045), 0.046, 0.038, fur, extend=0.022)
        bp = create_ellipsoid(f"Wolf_BackPaw_{side}", (0.046, 0.058, 0.035), (sign * 0.135, 0.265, 0.035), paw_mat, segs=10, rings=6)
        parts += [
            (eye, "Head"), (brow, "Head"), (fang, "Head"), (ear, f"Ear_{side}"),
            (fu, f"FrontUpper_{side}"), (fl, f"FrontLower_{side}"), (fp, f"FrontLower_{side}"),
            (bu, f"BackUpper_{side}"), (bl, f"BackLower_{side}"), (bp, f"BackLower_{side}"),
        ]

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return [trunk] + [p[0] for p in parts]


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


def build_wolf_scene(save_blend_path=None):
    """Build complete 80px base (120px @ 48 px/m) Timber Wolf Blender scene with 5 Actions."""
    studio = setup_pixel_studio(cell_px=80, px_per_meter=32, pitch_deg=38.0, target_z=0.46)
    studio["scene"]["sprite_ground_y"] = 64
    arm_obj = build_wolf_armature(studio["root"])
    meshes = build_wolf_meshes(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    idle = build_idle_action(arm_obj, "Wolf")
    walk = build_walk_action(arm_obj, "Wolf")
    run = build_run_action(arm_obj, "Wolf")
    attack = build_wolf_attack_action(arm_obj, "Wolf")
    corpse = build_corpse_action(arm_obj, "Wolf")

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)

    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": [a.name for a in (idle, walk, run, attack, corpse)]}
