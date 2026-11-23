"""Builds the Rig_SkeletonHumanoid bare creepy Skeleton (no weapons, cape, or horns)."""

import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from skeleton_actions import apply_skeleton_actions
from studio_core import make_toon_material, setup_pixel_studio


def apply_smooth_mesh(obj, flat=False):
    """Set smooth or crisp faceted shading across mesh polygons."""
    for poly in obj.data.polygons:
        poly.use_smooth = not flat


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=16, rings=10, flat=False):
    """Create a rounded skull, socket, joint, or bony nodule mesh."""
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
    apply_smooth_mesh(obj, flat=flat)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_box(name, size_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), bevel=0.008):
    """Create a small beveled bony plate, tooth, vertebra, or jaw segment."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((sx, sy, sz, 1.0)), verts=bm.verts)
    if bevel > 0.0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect="EDGES")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    apply_smooth_mesh(obj, flat=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.015):
    """Create an anatomical bone shaft/strut aligned cleanly between two points."""
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
    apply_smooth_mesh(obj, flat=False)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_long_bone(parts, bone_name, p0, p1, r_mid, r_end, mats):
    """Assemble one knobby long bone (shaft + proximal/distal condyle joints)."""
    shaft = create_capsule(f"Skel_{bone_name}_Shaft", p0, p1, r_mid, r_mid, mats["bone"], extend=0.0)
    top_cap = create_ellipsoid(f"Skel_{bone_name}_TopCap", (r_end, r_end, r_end), p0, mats["bone_dk"], segs=10, rings=8)
    bot_cap = create_ellipsoid(f"Skel_{bone_name}_BotCap", (r_end, r_end, r_end), p1, mats["bone_dk"], segs=10, rings=8)
    parts += [(shaft, bone_name), (top_cap, bone_name), (bot_cap, bone_name)]


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid skeletal bone piece cleanly to an armature bone."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_skeleton_materials():
    """Create weathered ivory bone, recessed shadow bone, and dark empty socket materials."""
    return {
        "bone": make_toon_material("Skeleton_Ivory", "#6e6552", "#b8ae95", "#e8dfc6", t_mid=0.25, t_hi=0.68),
        "bone_dk": make_toon_material("Skeleton_BoneShadow", "#4d4639", "#8d836e", "#bdb39a", t_mid=0.26, t_hi=0.70),
        "void": make_toon_material("Skeleton_HollowDark", "#12100e", "#221e1a", "#36302a", t_mid=0.35, t_hi=0.80),
    }


def build_skeleton_armature(root):
    """Build Rig_SkeletonHumanoid tall ~1.66m skeleton facing -Y with soles at z=0.0."""
    arm_data = bpy.data.armatures.new("Rig_SkeletonHumanoid")
    arm_obj = bpy.data.objects.new("Rig_SkeletonHumanoid", arm_data)
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

    pelvis = add_bone("Pelvis", (0.0, 0.0, 0.78), (0.0, 0.0, 0.94))
    spine = add_bone("Spine", (0.0, 0.0, 0.94), (0.0, -0.03, 1.34), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.03, 1.34), (0.0, -0.06, 1.43), spine, connect=True)
    head = add_bone("Head", (0.0, -0.06, 1.43), (0.0, -0.08, 1.72), neck, connect=True)
    add_bone("Jaw", (0.0, -0.08, 1.48), (0.0, -0.22, 1.41), head)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * 0.28, -0.02, 1.29), (sign * 0.34, -0.04, 0.99), spine)
        fa = add_bone(f"Forearm_{side}", (sign * 0.34, -0.04, 0.99), (sign * 0.36, -0.14, 0.72), ua, connect=True)
        add_bone(f"Hand_{side}", (sign * 0.36, -0.14, 0.72), (sign * 0.34, -0.20, 0.58), fa, connect=True)

        th = add_bone(f"Thigh_{side}", (sign * 0.14, 0.01, 0.78), (sign * 0.17, -0.04, 0.42), pelvis)
        sh = add_bone(f"Shin_{side}", (sign * 0.17, -0.04, 0.42), (sign * 0.18, 0.01, 0.08), th, connect=True)
        add_bone(f"Foot_{side}", (sign * 0.18, 0.01, 0.08), (sign * 0.19, -0.14, 0.02), sh, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def add_skull_and_jaw(parts, mats):
    """Build bare creepy cranium, deep empty eye/nasal cavities, cheekbones, and hinged jaw."""
    cranium = create_ellipsoid("Skel_Cranium", (0.165, 0.17, 0.155), (0.0, -0.04, 1.615), mats["bone"], segs=18, rings=12)
    cheek_block = create_box("Skel_Maxilla", (0.20, 0.16, 0.105), (0.0, -0.145, 1.505), mats["bone"], bevel=0.018)
    brow_ridge = create_box("Skel_BrowRidge", (0.235, 0.095, 0.046), (0.0, -0.205, 1.60), mats["bone"], rot_deg=(-12.0, 0.0, 0.0), bevel=0.01)
    nose_cav = create_box("Skel_NasalCav", (0.048, 0.05, 0.058), (0.0, -0.228, 1.525), mats["void"], rot_deg=(0.0, 45.0, 0.0), bevel=0.004)
    jaw_main = create_box("Skel_Mandible", (0.165, 0.155, 0.062), (0.0, -0.145, 1.415), mats["bone_dk"], bevel=0.012)
    mouth_dark = create_box("Skel_MouthGap", (0.135, 0.065, 0.042), (0.0, -0.212, 1.452), mats["void"], bevel=0.004)
    parts += [
        (cranium, "Head"), (cheek_block, "Head"), (brow_ridge, "Head"),
        (nose_cav, "Head"), (jaw_main, "Jaw"), (mouth_dark, "Head"),
    ]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        socket = create_ellipsoid(
            f"Skel_EyeSocket_{side}",
            (0.060, 0.048, 0.056),
            (sign * 0.072, -0.205, 1.568),
            mats["void"],
            rot_deg=(12.0, -sign * 14.0, sign * 12.0),
            segs=12,
            rings=8,
        )
        cheek = create_ellipsoid(f"Skel_Cheek_{side}", (0.055, 0.052, 0.036), (sign * 0.098, -0.195, 1.508), mats["bone"], segs=10, rings=6)
        parts += [(socket, "Head"), (cheek, "Head")]

    # Upper grinning bone teeth
    for t_i, tx in enumerate((-0.054, -0.018, 0.018, 0.054)):
        tooth = create_box(f"Skel_Tooth_{t_i}", (0.025, 0.026, 0.034), (tx, -0.228, 1.458), mats["bone"], bevel=0.003)
        parts.append((tooth, "Head"))


def add_ribcage_spine_pelvis(parts, mats):
    """Build segmented vertebrae, open curved ribs over dark hollow core, and iliac pelvis."""
    neck_v1 = create_ellipsoid("Skel_NeckVert1", (0.055, 0.055, 0.045), (0.0, -0.05, 1.38), mats["bone_dk"], segs=10, rings=6)
    chest_hollow = create_ellipsoid("Skel_ChestCore", (0.128, 0.10, 0.135), (0.0, -0.02, 1.16), mats["void"], segs=14, rings=10)
    sternum = create_box("Skel_Sternum", (0.055, 0.045, 0.24), (0.0, -0.145, 1.19), mats["bone"], rot_deg=(6.0, 0.0, 0.0), bevel=0.008)
    sacrum = create_box("Skel_Sacrum", (0.115, 0.095, 0.13), (0.0, 0.015, 0.85), mats["bone_dk"], bevel=0.012)
    pubic_arch = create_capsule("Skel_PubicArch", (-0.12, -0.02, 0.78), (0.12, -0.02, 0.78), 0.028, 0.028, mats["bone_dk"], extend=0.0)
    parts += [(neck_v1, "Neck"), (chest_hollow, "Spine"), (sternum, "Spine"), (sacrum, "Pelvis"), (pubic_arch, "Pelvis")]

    # 6 visible vertebrae down back + abdomen spine
    for v_i, vz in enumerate((1.30, 1.21, 1.12, 1.03, 0.95)):
        vert = create_box(f"Skel_Vertebra_{v_i}", (0.075, 0.075, 0.062), (0.0, 0.05, vz), mats["bone"], bevel=0.01)
        parts.append((vert, "Spine" if vz >= 0.98 else "Pelvis"))

    # 4 paired curved ivory rib hoops + collarbones + iliac wings
    for r_i, (rz, rw, rd) in enumerate(((1.28, 0.20, 0.13), (1.20, 0.22, 0.14), (1.12, 0.21, 0.13), (1.04, 0.17, 0.11))):
        for sign, side in ((-1.0, "L"), (1.0, "R")):
            r_back = create_capsule(f"Skel_RibB_{r_i}_{side}", (sign * 0.04, 0.05, rz + 0.02), (sign * rw, -0.02, rz), 0.026, 0.024, mats["bone"], extend=0.005)
            r_front = create_capsule(f"Skel_RibF_{r_i}_{side}", (sign * rw, -0.02, rz), (sign * 0.03, -rd, rz - 0.02), 0.024, 0.022, mats["bone"], extend=0.005)
            parts += [(r_back, "Spine"), (r_front, "Spine")]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        clav = create_capsule(f"Skel_Clav_{side}", (0.0, -0.12, 1.32), (sign * 0.25, -0.02, 1.30), 0.028, 0.024, mats["bone"], extend=0.008)
        hip_wing = create_box(f"Skel_Iliac_{side}", (0.14, 0.13, 0.12), (sign * 0.12, 0.0, 0.85), mats["bone"], rot_deg=(0.0, sign * 18.0, -sign * 16.0), bevel=0.015)
        parts += [(clav, "Spine"), (hip_wing, "Pelvis")]


def add_bony_limbs(parts, mats):
    """Assemble bare skeleton arms, legs, clawed finger hands, and bony feet at z=0.0."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        create_long_bone(parts, f"UpperArm_{side}", (sign * 0.28, -0.02, 1.28), (sign * 0.34, -0.04, 1.00), 0.034, 0.050, mats)
        create_long_bone(parts, f"Forearm_{side}", (sign * 0.34, -0.04, 0.99), (sign * 0.36, -0.14, 0.72), 0.030, 0.044, mats)
        palm = create_box(f"Skel_Palm_{side}", (0.075, 0.075, 0.05), (sign * 0.35, -0.16, 0.68), mats["bone_dk"], bevel=0.008)
        parts.append((palm, f"Hand_{side}"))
        for f_i, fx in enumerate((-0.028, 0.0, 0.028)):
            finger = create_capsule(
                f"Skel_Finger_{side}_{f_i}",
                (sign * 0.35 + fx, -0.18, 0.66),
                (sign * 0.34 + fx * 1.2, -0.22, 0.56),
                0.015, 0.009, mats["bone"], extend=0.004,
            )
            parts.append((finger, f"Hand_{side}"))

        create_long_bone(parts, f"Thigh_{side}", (sign * 0.14, 0.01, 0.76), (sign * 0.17, -0.04, 0.43), 0.042, 0.058, mats)
        create_long_bone(parts, f"Shin_{side}", (sign * 0.17, -0.04, 0.41), (sign * 0.18, 0.01, 0.08), 0.036, 0.052, mats)
        ankle = create_box(f"Skel_FootBase_{side}", (0.095, 0.16, 0.055), (sign * 0.185, -0.06, 0.028), mats["bone_dk"], bevel=0.008)
        parts.append((ankle, f"Foot_{side}"))
        for t_i, tx in enumerate((-0.028, 0.028)):
            toe = create_capsule(
                f"Skel_Toe_{side}_{t_i}",
                (sign * 0.185 + tx, -0.12, 0.03),
                (sign * 0.19 + tx * 1.1, -0.20, 0.02),
                0.018, 0.012, mats["bone"], extend=0.004,
            )
            parts.append((toe, f"Foot_{side}"))


def build_skeleton_meshes(arm_obj):
    """Assemble all skeletal anatomical bones onto Rig_SkeletonHumanoid."""
    mats = build_skeleton_materials()
    parts = []
    add_skull_and_jaw(parts, mats)
    add_ribcage_spine_pelvis(parts, mats)
    add_bony_limbs(parts, mats)

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


def build_skeleton_scene(save_blend_path=None):
    """Build complete 96px base (144px @ 48 px/m) Bare Creepy Skeleton Blender scene."""
    studio = setup_pixel_studio(cell_px=96, px_per_meter=32, pitch_deg=38.0, target_z=0.84)
    studio["scene"]["sprite_ground_y"] = 80
    arm_obj = build_skeleton_armature(studio["root"])
    meshes = build_skeleton_meshes(arm_obj)
    actions = apply_skeleton_actions("Skeleton", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
