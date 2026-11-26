"""Builds the reusable Rig_ChibiHumanoid bare Goblin with a looping 6-frame Idle clip."""

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

from studio_core import make_toon_material, setup_pixel_studio


def apply_smooth_mesh(obj):
    """Shade mesh polygons smoothly without flat bevel seams."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_ellipsoid(name, radius_xyz, center, mat, segs=18, rings=12):
    """Create a smooth low-poly rounded volume aligned cleanly in world space."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    scale_mat = Matrix.Diagonal((radius_xyz[0], radius_xyz[1], radius_xyz[2], 1.0))
    bmesh.ops.transform(bm, matrix=scale_mat, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.data.materials.append(mat)
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_bone_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.035):
    """Build a continuous overlapping capsule aligned exactly along a bone segment."""
    h = Vector(head_pt)
    t = Vector(tail_pt)
    span = t - h
    length = span.length + extend * 2.0
    mid = (h + t) * 0.5

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=14,
        radius1=r_head,
        radius2=r_tail,
        depth=length,
    )
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = mid
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="SmoothCaps", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_goblin_ear(name, side_sign, mat):
    """Create an iconic swept-back pointed goblin ear (side_sign: -1 left, +1 right)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=10,
        radius1=0.088,
        radius2=0.012,
        depth=0.33,
    )
    for v in bm.verts:
        t = max(0.0, min(1.0, (v.co.z + 0.165) / 0.33))
        v.co.y *= 0.48
        v.co.z += (t ** 1.5) * 0.03
        v.co.y += (t ** 1.3) * 0.055
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector((side_sign * 0.21, 0.055, 0.76))
    obj.rotation_euler = Euler(
        (math.radians(-6.0), side_sign * math.radians(88.0), side_sign * math.radians(-42.0)),
        "XYZ",
    )
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="EarSmooth", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_chibi_armature(root):
    """Build reusable Rig_ChibiHumanoid with future-ready equipment sockets."""
    arm_data = bpy.data.armatures.new("Rig_ChibiHumanoid")
    arm_obj = bpy.data.objects.new("Rig_ChibiHumanoid", arm_data)
    arm_obj.parent = root
    bpy.context.scene.collection.objects.link(arm_obj)

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = parent
            b.use_connect = connect
        return b

    pelvis = add_bone("Pelvis", (0.0, 0.0, 0.25), (0.0, 0.0, 0.40))
    spine = add_bone("Spine", (0.0, 0.0, 0.40), (0.0, 0.0, 0.61), pelvis, connect=True)
    head = add_bone("Head", (0.0, 0.0, 0.61), (0.0, 0.0, 1.02), spine, connect=True)
    add_bone("Ear_L", (-0.17, 0.01, 0.80), (-0.40, 0.11, 0.90), head)
    add_bone("Ear_R", (0.17, 0.01, 0.80), (0.40, 0.11, 0.90), head)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * 0.165, 0.0, 0.56), (sign * 0.235, -0.015, 0.42), spine)
        add_bone(f"Forearm_{side}", (sign * 0.235, -0.015, 0.42), (sign * 0.265, -0.045, 0.28), ua, connect=True)
        th = add_bone(f"Thigh_{side}", (sign * 0.105, 0.0, 0.27), (sign * 0.108, 0.0, 0.14), pelvis)
        add_bone(f"Shin_{side}", (sign * 0.108, 0.0, 0.14), (sign * 0.110, -0.015, 0.02), th, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")

    sockets = (
        ("Socket_Hand_R", "Forearm_R", (0.0, 0.0, 0.0)),
        ("Socket_Hand_L", "Forearm_L", (0.0, 0.0, 0.0)),
        ("Socket_Head", "Head", (0.0, -0.02, 0.0)),
        ("Socket_Back", "Spine", (0.0, 0.0, 0.14)),
    )
    for sock_name, bone_name, local_pos in sockets:
        sock = bpy.data.objects.new(sock_name, None)
        sock.empty_display_type = "SPHERE"
        sock.empty_display_size = 0.04
        sock.parent = arm_obj
        sock.parent_type = "BONE"
        sock.parent_bone = bone_name
        sock.location = Vector(local_pos)
        bpy.context.scene.collection.objects.link(sock)

    return arm_obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid smooth mesh cleanly to a single armature bone with preserved world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world_mat


def build_goblin_meshes(arm_obj):
    """Assemble chunky, readable Cainos-style bare goblin body parts (~1.05m tall)."""
    skin = make_toon_material("Mat_GoblinSkin", "#35664b", "#6aa84f", "#a3d66b", t_mid=0.30, t_hi=0.72)
    ear_mat = make_toon_material("Mat_GoblinEar", "#3b654a", "#78ae58", "#b1de78", t_mid=0.28, t_hi=0.74)
    cloth = make_toon_material("Mat_ClothLeather", "#4f322f", "#8a583c", "#be8760", t_mid=0.32, t_hi=0.75)
    sclera = make_toon_material("Mat_EyeSclera", "#cbb978", "#f6edb8", "#fffbe0", t_mid=0.22, t_hi=0.70)
    pupil = make_toon_material("Mat_EyePupil", "#1d1426", "#251a30", "#392948", t_mid=0.50, t_hi=0.90)

    parts = []

    # Pelvis & waist belt + loincloth flaps (clean silhouette from South, East, North)
    pelvis_mesh = create_ellipsoid("Goblin_Pelvis", (0.165, 0.135, 0.095), (0.0, 0.0, 0.285), cloth)
    belt_mesh = create_ellipsoid("Goblin_Belt", (0.178, 0.144, 0.045), (0.0, 0.0, 0.345), cloth)
    loin_front = create_ellipsoid("Goblin_LoinFront", (0.072, 0.038, 0.085), (0.0, -0.118, 0.235), cloth)
    loin_back = create_ellipsoid("Goblin_LoinBack", (0.085, 0.038, 0.085), (0.0, 0.112, 0.24), cloth)
    parts += [(pelvis_mesh, "Pelvis"), (belt_mesh, "Pelvis"), (loin_front, "Pelvis"), (loin_back, "Pelvis")]

    # Chibi hunched chest/belly + tucked neck overlapping Head smoothly
    torso = create_ellipsoid("Goblin_Torso", (0.182, 0.145, 0.165), (0.0, -0.005, 0.468), skin)
    neck = create_ellipsoid("Goblin_Neck", (0.092, 0.085, 0.075), (0.0, -0.01, 0.625), skin)
    parts += [(torso, "Spine"), (neck, "Spine")]

    # Expressive chibi goblin head + cheeky snout/nose + angled brows + big eyes + ears
    head = create_ellipsoid("Goblin_Head", (0.245, 0.215, 0.190), (0.0, -0.02, 0.812), skin)
    nose = create_bone_capsule("Goblin_Nose", (0.0, -0.18, 0.805), (0.0, -0.285, 0.782), 0.054, 0.024, skin, extend=0.015)
    parts += [(head, "Head"), (nose, "Head")]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        # Mischievous goblin brow tilted inward (\ /)
        brow = create_ellipsoid(
            f"Goblin_Brow_{side}",
            (0.068, 0.042, 0.026),
            (sign * 0.084, -0.196, 0.862),
            skin,
            segs=12,
            rings=8,
        )
        brow.rotation_euler = Euler((math.radians(8.0), sign * math.radians(-16.0), sign * math.radians(10.0)), "XYZ")

        eye_w = create_ellipsoid(f"Goblin_Eye_{side}", (0.056, 0.036, 0.062), (sign * 0.086, -0.206, 0.818), sclera, segs=14, rings=10)
        eye_p = create_ellipsoid(f"Goblin_Pupil_{side}", (0.032, 0.024, 0.044), (sign * 0.084, -0.228, 0.812), pupil, segs=12, rings=8)
        ear = create_goblin_ear(f"Goblin_Ear_{side}", sign, ear_mat)
        parts += [(brow, "Head"), (eye_w, "Head"), (eye_p, "Head"), (ear, f"Ear_{side}")]

        # Solid overlapping arms aligned right along bone axes (zero gaps!)
        ua = create_bone_capsule(
            f"Goblin_UpperArm_{side}",
            (sign * 0.165, 0.0, 0.56),
            (sign * 0.235, -0.015, 0.42),
            0.072,
            0.060,
            skin,
            extend=0.040,
        )
        fa = create_bone_capsule(
            f"Goblin_Forearm_{side}",
            (sign * 0.235, -0.015, 0.42),
            (sign * 0.265, -0.045, 0.28),
            0.060,
            0.052,
            skin,
            extend=0.035,
        )
        fist = create_ellipsoid(f"Goblin_Hand_{side}", (0.062, 0.062, 0.062), (sign * 0.268, -0.052, 0.265), skin, segs=12, rings=8)
        parts += [(ua, f"UpperArm_{side}"), (fa, f"Forearm_{side}"), (fist, f"Forearm_{side}")]

        # Solid overlapping chunky legs + feet resting flat at z = 0.0
        th = create_bone_capsule(
            f"Goblin_Thigh_{side}",
            (sign * 0.105, 0.0, 0.27),
            (sign * 0.108, 0.0, 0.14),
            0.076,
            0.064,
            skin,
            extend=0.035,
        )
        sh = create_bone_capsule(
            f"Goblin_Shin_{side}",
            (sign * 0.108, 0.0, 0.14),
            (sign * 0.110, -0.015, 0.025),
            0.062,
            0.054,
            skin,
            extend=0.025,
        )
        foot = create_ellipsoid(f"Goblin_Foot_{side}", (0.068, 0.095, 0.042), (sign * 0.112, -0.045, 0.042), skin, segs=12, rings=8)
        parts += [(th, f"Thigh_{side}"), (sh, f"Shin_{side}"), (foot, f"Shin_{side}")]

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return [p[0] for p in parts]


def build_idle_animation(arm_obj, frame_count=6):
    """Animate a lively, clean 6-frame breathing Idle loop on Rig_ChibiHumanoid."""
    scene = bpy.context.scene
    scene.frame_start = 1
    scene.frame_end = frame_count

    arm_obj.animation_data_create()
    action = bpy.data.actions.new("Goblin_Idle")
    arm_obj.animation_data.action = action

    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="POSE")
    pb = arm_obj.pose.bones
    for bone in pb:
        bone.rotation_mode = "XYZ"

    for f in range(1, frame_count + 1):
        phase = (2.0 * math.pi * (f - 1)) / float(frame_count)
        bob = -0.048 * (1.0 - math.cos(phase)) * 0.5
        arm_phase = math.sin(phase)
        ear_phase = math.sin(phase - 0.85)

        pb["Pelvis"].location = Vector((0.0, 0.0, bob))
        pb["Pelvis"].keyframe_insert(data_path="location", frame=f)

        pb["Spine"].rotation_euler = Euler((math.radians(5.0 * math.cos(phase)), 0.0, 0.0), "XYZ")
        pb["Spine"].keyframe_insert(data_path="rotation_euler", frame=f)

        pb["Head"].rotation_euler = Euler((math.radians(-4.5 * math.cos(phase)), 0.0, math.radians(3.0 * arm_phase)), "XYZ")
        pb["Head"].keyframe_insert(data_path="rotation_euler", frame=f)

        for sign, side in ((-1.0, "L"), (1.0, "R")):
            pb[f"Ear_{side}"].rotation_euler = Euler((0.0, 0.0, sign * math.radians(5.0 * ear_phase)), "XYZ")
            pb[f"Ear_{side}"].keyframe_insert(data_path="rotation_euler", frame=f)

            pb[f"UpperArm_{side}"].rotation_euler = Euler((math.radians(7.0 * arm_phase), sign * math.radians(7.0 * math.cos(phase)), 0.0), "XYZ")
            pb[f"UpperArm_{side}"].keyframe_insert(data_path="rotation_euler", frame=f)

            pb[f"Forearm_{side}"].rotation_euler = Euler((math.radians(-10.0 * arm_phase), 0.0, 0.0), "XYZ")
            pb[f"Forearm_{side}"].keyframe_insert(data_path="rotation_euler", frame=f)

            # Thigh bone points world -Z (+Y bone local = -Z world), so bob pulls up along -Y local
            pb[f"Thigh_{side}"].location = Vector((0.0, bob * 0.65, 0.0))
            pb[f"Thigh_{side}"].keyframe_insert(data_path="location", frame=f)

    bpy.ops.object.mode_set(mode="OBJECT")
    scene.frame_set(1)


def compute_combined_bounds(objects):
    """Compute world-space axis-aligned min/max/size across a list of mesh objects."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    xs, ys, zs = [], [], []
    for obj in objects:
        eval_obj = obj.evaluated_get(depsgraph)
        for corner in eval_obj.bound_box:
            wc = eval_obj.matrix_world @ Vector(corner)
            xs.append(wc.x)
            ys.append(wc.y)
            zs.append(wc.z)
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        "size": [round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4), round(max(zs) - min(zs), 4)],
    }


def build_goblin_scene(save_blend_path=None):
    """Build complete Blender pixel studio scene with bare goblin + Rig_ChibiHumanoid + Idle clip."""
    studio = setup_pixel_studio(cell_px=64, px_per_meter=32, pitch_deg=38.0, target_z=0.50)
    arm_obj = build_chibi_armature(studio["root"])
    meshes = build_goblin_meshes(arm_obj)
    build_idle_animation(arm_obj, frame_count=6)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name}
