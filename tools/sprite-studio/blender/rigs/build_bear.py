"""Builds an organic continuous Rig_Quadruped Grizzly Bear (zero back blobs or sausage limbs)."""

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
    """Enable smooth shading across polygons for natural grizzly coat continuity."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=14, rings=10):
    """Create a smooth rounded ear, eye, claw, or stub-tail ellipsoid."""
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


def create_profile_tube(name, sections, mats, segs=20, material_fn=None):
    """Loft a smooth subdivided tube from [(cx, cy, z_bot, z_top, rx, ry), ...] rings."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for cx, cy, z_bot, z_top, rx, ry in sections:
        zc = (z_bot + z_top) * 0.5
        rz = (z_top - z_bot) * 0.5
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ca, sa = math.cos(ang), math.sin(ang)
            # Flatten underside gently while preserving natural arched shoulder/back curve
            z_off = sa * rz * (0.94 if sa < 0.0 else 1.0)
            ring.append(bm.verts.new((cx + ca * rx, cy + sa * ry, zc + z_off)))
        rings.append(ring)

    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        mat_idx = material_fn(r_i) if material_fn else 0
        for s in range(segs):
            ns = (s + 1) % segs
            f = bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))
            f.material_index = mat_idx

    f_start = bm.faces.new(list(reversed(rings[0])))
    f_start.material_index = material_fn(0) if material_fn else 0
    f_end = bm.faces.new(rings[-1])
    f_end.material_index = material_fn(len(rings) - 2) if material_fn else 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    for m in mats:
        obj.data.materials.append(m)
    mod = obj.modifiers.new(name="SmoothSub", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bind_body_weights(obj, arm_obj):
    """Weight continuous bear body smoothly across Pelvis, Spine, Neck, and Head."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vgs = {n: obj.vertex_groups.new(name=n) for n in ("Pelvis", "Spine", "Neck", "Head")}
    for v in obj.data.vertices:
        y = v.co.y
        w_pel = max(0.0, min(1.0, (y - 0.04) / 0.34))
        w_nck = max(0.0, min(1.0, (-0.34 - y) / 0.24)) * (1.0 - w_pel)
        w_hd = max(0.0, min(0.35, (-0.56 - y) / 0.20))
        w_nck = max(0.0, w_nck - w_hd)
        w_spn = max(0.0, 1.0 - w_pel - w_nck - w_hd)
        for key, val in (("Pelvis", w_pel), ("Spine", w_spn), ("Neck", w_nck), ("Head", w_hd)):
            if val > 0.0:
                vgs[key].add([v.index], val, "REPLACE")


def bind_leg_weights(obj, arm_obj, parent_bone, upper_bone, lower_bone):
    """Weight a single continuous leg mesh smoothly from torso socket down through elbow/knee."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vg_p = obj.vertex_groups.new(name=parent_bone)
    vg_u = obj.vertex_groups.new(name=upper_bone)
    vg_l = obj.vertex_groups.new(name=lower_bone)
    for v in obj.data.vertices:
        z = v.co.z
        w_p = max(0.0, min(0.45, (z - 0.62) / 0.55))
        w_l = max(0.0, min(1.0, (0.42 - z) / 0.16))
        w_u = max(0.0, 1.0 - w_p - w_l)
        if w_p > 0.0:
            vg_p.add([v.index], w_p, "REPLACE")
        if w_u > 0.0:
            vg_u.add([v.index], w_u, "REPLACE")
        if w_l > 0.0:
            vg_l.add([v.index], w_l, "REPLACE")


def create_flush_capsule(name, head_pt, tail_pt, radius, mat):
    """Create a small smooth scar strip or toe claw capsule."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10, radius1=radius, radius2=radius * 0.85, depth=span.length)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid ear, eye, scar, or claw to an armature bone preserving world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_bear_armature(root):
    """Build large Rig_Quadruped grizzly skeleton facing -Y with paws resting at z=0.0."""
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

    pelvis = add_bone("Pelvis", (0.0, 0.44, 0.66), (0.0, 0.06, 0.72))
    spine = add_bone("Spine", (0.0, 0.06, 0.72), (0.0, -0.40, 0.80), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.40, 0.80), (0.0, -0.58, 0.82), spine, connect=True)
    head = add_bone("Head", (0.0, -0.58, 0.82), (0.0, -0.94, 0.78), neck, connect=True)
    add_bone("Tail", (0.0, 0.64, 0.76), (0.0, 0.78, 0.74), pelvis)
    add_bone("Ear_L", (-0.18, -0.58, 1.01), (-0.25, -0.56, 1.12), head)
    add_bone("Ear_R", (0.18, -0.58, 1.01), (0.25, -0.56, 1.12), head)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        fu = add_bone(f"FrontUpper_{side}", (sign * 0.27, -0.34, 0.74), (sign * 0.27, -0.36, 0.36), spine)
        add_bone(f"FrontLower_{side}", (sign * 0.27, -0.36, 0.36), (sign * 0.28, -0.39, 0.04), fu, connect=True)
        bu = add_bone(f"BackUpper_{side}", (sign * 0.25, 0.40, 0.70), (sign * 0.25, 0.43, 0.34), pelvis)
        add_bone(f"BackLower_{side}", (sign * 0.25, 0.43, 0.34), (sign * 0.25, 0.39, 0.04), bu, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def build_bear_attack_action(arm_obj, prefix="Bear"):
    """Build 6-frame rearing grizzly swipe (F1-3 rear onto hind legs, F4-6 heavy paw slam)."""
    action = prepare_clean_action(f"{prefix}_Attack", fps=9, loop_start=3, loop_end=5)
    bind_action_for_edit(arm_obj, action)
    reset_pose_bones(arm_obj)
    pb = arm_obj.pose.bones

    # (py, pz, pel_rx, sp_rx, fl_u, fl_l, fr_u, fr_l, leg_b_rx)
    poses = (
        (0.05, -0.04, -16.0, -8.0, -34.0, -24.0, -36.0, -24.0, 14.0),
        (0.08, -0.09, -32.0, -14.0, -68.0, -34.0, -78.0, -36.0, 28.0),
        (0.10, -0.13, -44.0, -16.0, -88.0, -36.0, -98.0, -38.0, 38.0),
        (-0.10, -0.04, 14.0, 10.0, -18.0, 14.0, -42.0, -12.0, -8.0),
        (-0.06, -0.02, 8.0, 6.0, -12.0, 10.0, -24.0, 8.0, -4.0),
        (0.00, 0.00, 0.0, 0.0, -6.0, 6.0, -8.0, 6.0, 0.0),
    )

    for f, p in enumerate(poses, start=1):
        py, pz, pel_rx, sp_rx, fl_u, fl_l, fr_u, fr_l, bu_rx = p
        set_world_loc(pb["Pelvis"], 0.0, py, pz)
        set_world_rot(pb["Pelvis"], pel_rx, 0.0, 0.0)
        set_world_rot(pb["Spine"], sp_rx, 0.0, 10.0 if f <= 3 else -12.0)
        set_world_rot(pb["Head"], -pel_rx * 0.45, 0.0, 0.0)
        set_world_rot(pb["FrontUpper_L"], fl_u, -12.0 if f <= 3 else 0.0, 0.0)
        set_world_rot(pb["FrontLower_L"], fl_l, 0.0, 0.0)
        set_world_rot(pb["FrontUpper_R"], fr_u, 14.0 if f <= 3 else 0.0, 0.0)
        set_world_rot(pb["FrontLower_R"], fr_l, 0.0, 0.0)
        for side in ("L", "R"):
            set_world_rot(pb[f"BackUpper_{side}"], bu_rx, 0.0, 0.0)
            set_world_rot(pb[f"BackLower_{side}"], -bu_rx * 0.4, 0.0, 0.0)
        key_pose_bones(arm_obj, ALL_QUADRUPED_BONES, f)
    return action


def build_bear_meshes(arm_obj):
    """Assemble continuous organic Grizzly body, sculpted head, tapered legs, claws, and ears."""
    fur = make_toon_material("Bear_RussetFur", "#421f0e", "#7c3d1b", "#b36330", t_mid=0.25, t_hi=0.68)
    fur_dk = make_toon_material("Bear_DarkFur", "#2b1307", "#5c2c13", "#874622", t_mid=0.28, t_hi=0.72)
    muzzle_m = make_toon_material("Bear_HoneyMuzzle", "#9c6c30", "#d9a452", "#f2c97d", t_mid=0.22, t_hi=0.66)
    dark = make_toon_material("Bear_Obsidian", "#121012", "#242124", "#3d383c", t_mid=0.35, t_hi=0.80)

    # Single smooth anatomical torso from rump through gently arched withers to thick neck (zero hump blob)
    body_sections = (
        (0.0, 0.72, 0.62, 0.80, 0.10, 0.0),
        (0.0, 0.62, 0.50, 0.96, 0.28, 0.0),
        (0.0, 0.42, 0.41, 1.04, 0.37, 0.0),
        (0.0, 0.18, 0.38, 1.07, 0.40, 0.0),
        (0.0, -0.06, 0.38, 1.11, 0.41, 0.0),
        (0.0, -0.28, 0.41, 1.16, 0.40, 0.0),
        (0.0, -0.44, 0.46, 1.12, 0.36, 0.0),
        (0.0, -0.58, 0.55, 1.04, 0.30, 0.0),
        (0.0, -0.68, 0.62, 0.98, 0.22, 0.0),
    )
    body = create_profile_tube("Bear_Body", body_sections, [fur], segs=22)
    bind_body_weights(body, arm_obj)

    # Continuous sculpted head -> broad cheeks -> honey-tan grizzly muzzle
    head_sections = (
        (0.0, -0.60, 0.65, 0.94, 0.19, 0.0),
        (0.0, -0.70, 0.60, 1.04, 0.27, 0.0),
        (0.0, -0.82, 0.64, 0.99, 0.21, 0.0),
        (0.0, -0.92, 0.68, 0.89, 0.14, 0.0),
        (0.0, -1.03, 0.70, 0.85, 0.10, 0.0),
        (0.0, -1.07, 0.74, 0.83, 0.05, 0.0),
    )
    head_mesh = create_profile_tube("Bear_Head", head_sections, [fur, muzzle_m], segs=20, material_fn=lambda i: 1 if i >= 3 else 0)

    meshes = [body]
    parts = [(head_mesh, "Head")]

    # Four continuous organic sculpted bear legs (tucked shoulders/hips tapering to flat claws, zero sausages)
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        front_rings = (
            (sign * 0.20, -0.32, 0.86, 0.86, 0.18, 0.23),
            (sign * 0.26, -0.33, 0.66, 0.66, 0.165, 0.195),
            (sign * 0.27, -0.35, 0.46, 0.46, 0.142, 0.162),
            (sign * 0.27, -0.36, 0.30, 0.30, 0.130, 0.145),
            (sign * 0.27, -0.37, 0.14, 0.14, 0.122, 0.142),
            (sign * 0.28, -0.40, 0.05, 0.05, 0.130, 0.165),
            (sign * 0.28, -0.42, 0.00, 0.00, 0.095, 0.125),
        )
        back_rings = (
            (sign * 0.18, 0.38, 0.84, 0.84, 0.18, 0.23),
            (sign * 0.24, 0.40, 0.64, 0.64, 0.17, 0.20),
            (sign * 0.25, 0.42, 0.44, 0.44, 0.144, 0.165),
            (sign * 0.25, 0.43, 0.26, 0.26, 0.128, 0.145),
            (sign * 0.25, 0.41, 0.10, 0.10, 0.120, 0.140),
            (sign * 0.25, 0.39, 0.04, 0.04, 0.126, 0.160),
            (sign * 0.25, 0.38, 0.00, 0.00, 0.092, 0.118),
        )
        f_leg = create_leg_loft(f"Bear_FrontLeg_{side}", front_rings, fur)
        bind_leg_weights(f_leg, arm_obj, "Spine", f"FrontUpper_{side}", f"FrontLower_{side}")
        b_leg = create_leg_loft(f"Bear_BackLeg_{side}", back_rings, fur)
        bind_leg_weights(b_leg, arm_obj, "Pelvis", f"BackUpper_{side}", f"BackLower_{side}")
        meshes += [f_leg, b_leg]

        ear = create_ellipsoid(f"Bear_Ear_{side}", (0.070, 0.046, 0.072), (sign * 0.19, -0.62, 1.03), fur_dk, rot_deg=(0.0, sign * 22.0, 0.0), segs=12, rings=8)
        ear_in = create_ellipsoid(f"Bear_EarIn_{side}", (0.038, 0.026, 0.040), (sign * 0.19, -0.645, 1.025), muzzle_m, rot_deg=(0.0, sign * 22.0, 0.0), segs=10, rings=6)
        eye = create_ellipsoid(f"Bear_Eye_{side}", (0.024, 0.020, 0.020), (sign * 0.135, -0.855, 0.88), dark, segs=8, rings=6)
        brow = create_ellipsoid(f"Bear_Brow_{side}", (0.048, 0.026, 0.016), (sign * 0.13, -0.84, 0.915), fur_dk, rot_deg=(0.0, -sign * 18.0, 0.0), segs=10, rings=6)
        parts += [(ear, f"Ear_{side}"), (ear_in, f"Ear_{side}"), (eye, "Head"), (brow, "Head")]

        for ci, ox in enumerate((-0.055, 0.0, 0.055)):
            fc = create_flush_capsule(f"Bear_FClaw_{side}_{ci}", (sign * 0.28 + ox, -0.53, 0.03), (sign * 0.28 + ox, -0.575, 0.012), 0.017, dark)
            bc = create_flush_capsule(f"Bear_BClaw_{side}_{ci}", (sign * 0.25 + ox, 0.26, 0.03), (sign * 0.25 + ox, 0.215, 0.012), 0.016, dark)
            parts += [(fc, f"FrontLower_{side}"), (bc, f"BackLower_{side}")]

    nose = create_ellipsoid("Bear_Nose", (0.056, 0.045, 0.038), (0.0, -1.07, 0.805), dark, segs=10, rings=8)
    tail = create_ellipsoid("Bear_StubTail", (0.085, 0.095, 0.080), (0.0, 0.72, 0.75), fur_dk, segs=10, rings=8)
    scar1 = create_flush_capsule("Bear_Scar1", (0.376, -0.34, 0.78), (0.376, -0.18, 0.92), 0.016, dark)
    scar2 = create_flush_capsule("Bear_Scar2", (0.376, -0.18, 0.78), (0.376, -0.34, 0.92), 0.016, dark)
    parts += [(nose, "Head"), (tail, "Tail"), (scar1, "Spine"), (scar2, "Spine")]

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return meshes + [p[0] for p in parts]


def create_leg_loft(name, rings_spec, mat, segs=14):
    """Build a continuous horizontal-slice leg mesh from [(cx, cy, z, _z2, rx, ry), ...] rings."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for cx, cy, z, _unused, rx, ry in rings_spec:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ring.append(bm.verts.new((cx + math.cos(ang) * rx, cy + math.sin(ang) * ry, z)))
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
    mod = obj.modifiers.new(name="SmoothLeg", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


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


def build_bear_scene(save_blend_path=None):
    """Build complete 112px base (168px @ 48 px/m) organic Grizzly Bear Blender scene."""
    studio = setup_pixel_studio(cell_px=112, px_per_meter=32, pitch_deg=38.0, target_z=0.68)
    studio["scene"]["sprite_ground_y"] = 92
    arm_obj = build_bear_armature(studio["root"])
    meshes = build_bear_meshes(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    idle = build_idle_action(arm_obj, "Bear")
    idle["fps"] = 5
    walk = build_walk_action(arm_obj, "Bear")
    walk["fps"] = 7
    run = build_run_action(arm_obj, "Bear")
    run["fps"] = 11
    attack = build_bear_attack_action(arm_obj, "Bear")
    corpse = build_corpse_action(arm_obj, "Bear")

    reset_pose_bones(arm_obj)
    bind_action_for_edit(arm_obj, idle)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = 6
    bpy.context.scene.frame_set(1)

    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": [a.name for a in (idle, walk, run, attack, corpse)]}
