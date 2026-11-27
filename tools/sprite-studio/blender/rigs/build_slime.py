"""Builds the glossy emerald-jade Rig_Slime monster model with 5 animation clips."""

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

from slime_actions import apply_slime_actions
from studio_core import make_toon_material, setup_pixel_studio


def apply_smooth_mesh(obj):
    """Enable smooth shading for glossy gelatin curvature."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_dome_shell(name, radius_xyz, center, mat, segs=22, rings=14, rot_deg=(0.0, 0.0, 0.0)):
    """Create a flattened-base translucent-look gelatin dome resting cleanly on ground."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    rx, ry, rz = radius_xyz
    for v in bm.verts:
        z_norm = v.co.z
        # Flatten bottom skirt gently for wide puddle silhouette
        z_scaled = max(-0.22, z_norm) * rz
        flare = 1.08 if z_norm < 0.0 else 1.0 - 0.12 * (z_norm ** 2)
        v.co.x *= rx * flare
        v.co.y *= ry * flare
        v.co.z = z_scaled
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    apply_smooth_mesh(obj)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_ellipsoid(name, radius_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), segs=16, rings=10):
    """Create a smooth rounded gelatin blob, sheen, or eye."""
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


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a mesh cleanly to an armature bone preserving world transform."""
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def build_slime_materials():
    """Create glossy emerald, specular sheen, amber eye, and olive fleck materials."""
    return {
        "ooze": make_toon_material("Slime_Ooze", "#104a36", "#1d7e58", "#44c989", t_mid=0.22, t_hi=0.66),
        "sheen": make_toon_material("Slime_Sheen", "#8af0b4", "#c6ffe0", "#eafff2", t_mid=0.05, t_hi=0.50),
        "fleck": make_toon_material("Slime_Fleck", "#2e4d18", "#50802b", "#7fb347", t_mid=0.20, t_hi=0.65),
        "eye": make_toon_material("Slime_AmberEye", "#9c4a08", "#f59e0b", "#fef08a", t_mid=0.08, t_hi=0.55),
        "pupil": make_toon_material("Slime_DarkPupil", "#0b1a14", "#12261e", "#1d382c", t_mid=0.40, t_hi=0.85),
    }


def build_slime_armature(root):
    """Build Rig_Slime with Base, squash-stretch Body, and Crest wobble bone."""
    arm_data = bpy.data.armatures.new("Rig_Slime")
    arm_obj = bpy.data.objects.new("Rig_Slime", arm_data)
    arm_obj.parent = root
    bpy.context.scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones

    def add_bone(name, head, tail, parent=None):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent:
            b.parent = parent
        return b

    base = add_bone("Base", (0.0, 0.0, 0.0), (0.0, 0.0, 0.14))
    body = add_bone("Body", (0.0, 0.0, 0.14), (0.0, 0.0, 0.64), base)
    add_bone("Crest", (0.0, 0.02, 0.44), (0.0, 0.02, 0.66), body)

    bpy.ops.object.mode_set(mode="OBJECT")
    return arm_obj


def build_slime_meshes(arm_obj):
    """Assemble hornless glossy emerald ooze dome, puddle lobes, sunken eyes, sheen, and flecks."""
    mats = build_slime_materials()
    parts = []

    dome = create_dome_shell("Slime_Dome", (0.42, 0.39, 0.44), (0.0, 0.02, 0.10), mats["ooze"])
    puddle = create_ellipsoid("Slime_Puddle", (0.46, 0.42, 0.065), (0.0, 0.0, 0.065), mats["ooze"])
    crest = create_ellipsoid("Slime_CrestBlob", (0.19, 0.17, 0.09), (0.0, 0.04, 0.41), mats["ooze"])
    sheen1 = create_ellipsoid("Slime_SheenMain", (0.11, 0.055, 0.018), (-0.145, -0.135, 0.448), mats["sheen"], rot_deg=(-28.0, -24.0, 14.0), segs=12, rings=8)
    sheen2 = create_ellipsoid("Slime_SheenDot", (0.045, 0.032, 0.016), (-0.235, -0.05, 0.382), mats["sheen"], rot_deg=(-20.0, -28.0, 10.0), segs=10, rings=6)
    parts += [
        (dome, "Body"), (puddle, "Base"), (crest, "Crest"),
        (sheen1, "Body"), (sheen2, "Body"),
    ]

    # Puddle edge lobes resting flush at z=0.0 + inner olive flecks
    lobe_specs = (
        ((-0.36, -0.16, 0.065), (0.14, 0.12, 0.065)),
        ((0.36, -0.14, 0.065), (0.14, 0.12, 0.065)),
        ((-0.30, 0.26, 0.065), (0.15, 0.13, 0.065)),
        ((0.30, 0.26, 0.065), (0.15, 0.13, 0.065)),
        ((0.0, 0.36, 0.065), (0.18, 0.12, 0.065)),
    )
    for idx, (pos, rad) in enumerate(lobe_specs):
        parts.append((create_ellipsoid(f"Slime_Lobe_{idx}", rad, pos, mats["ooze"], segs=12, rings=8), "Base"))

    fleck_specs = (
        ((-0.24, 0.14, 0.30), (0.055, 0.05, 0.05)),
        ((0.23, -0.08, 0.34), (0.06, 0.05, 0.045)),
        ((0.18, 0.22, 0.28), (0.065, 0.055, 0.05)),
        ((-0.17, -0.20, 0.32), (0.045, 0.045, 0.04)),
    )
    for idx, (pos, rad) in enumerate(fleck_specs):
        parts.append((create_ellipsoid(f"Slime_Fleck_{idx}", rad, pos, mats["fleck"], segs=10, rings=6), "Body"))

    # Recessed sunken amber eyes + flush dark slit pupils inside the dome (no horns or brow lumps)
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        eye = create_ellipsoid(
            f"Slime_Eye_{side}", (0.062, 0.030, 0.048), (sign * 0.125, -0.308, 0.250),
            mats["eye"], rot_deg=(0.0, -sign * 14.0, 0.0), segs=12, rings=8,
        )
        pupil = create_ellipsoid(
            f"Slime_Pupil_{side}", (0.022, 0.015, 0.032), (sign * 0.125, -0.325, 0.250),
            mats["pupil"], segs=10, rings=6,
        )
        parts += [(eye, "Body"), (pupil, "Body")]

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


def build_slime_scene(save_blend_path=None):
    """Build complete 64px base (96px @ 48 px/m) translucent hornless Emerald Slime scene."""
    studio = setup_pixel_studio(cell_px=64, px_per_meter=32, pitch_deg=38.0, target_z=0.34)
    studio["scene"]["sprite_ground_y"] = 52
    studio["scene"]["sprite_body_alpha"] = 0.78
    arm_obj = build_slime_armature(studio["root"])
    meshes = build_slime_meshes(arm_obj)
    actions = apply_slime_actions("Slime", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
