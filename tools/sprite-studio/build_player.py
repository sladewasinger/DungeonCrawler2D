"""Builds Stylized Chibi-Heroic 3D Player (player.blend) with solid voxel-sculpted bodies, fitted armor, and Automatic Weights."""

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

MALE_ARM_AXES = {
    "sh": (0.195, -0.010, 1.010),
    "el": (0.258, -0.015, 0.800),
    "wr": (0.292, -0.060, 0.590),
    "hn": (0.298, -0.080, 0.505),
}
MALE_LEG_AXES = {
    "hip": (0.105, 0.000, 0.650),
    "kn": (0.118, -0.015, 0.360),
    "an": (0.118, 0.010, 0.100),
    "toe": (0.118, -0.115, 0.036),
}


def get_or_create_collection(name, parent=None):
    """Return a clean sub-collection linked under scene/parent for modular visibility."""
    col = bpy.data.collections.get(name)
    if not col:
        col = bpy.data.collections.new(name)
        target = parent or bpy.context.scene.collection
        target.children.link(col)
    return col


def link_to_collection(obj, col):
    """Move an object cleanly into a single target collection."""
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    col.objects.link(obj)


def set_collection_visible(col, visible):
    """Toggle viewport and render visibility on a Blender collection cleanly."""
    col.hide_viewport = not visible
    col.hide_render = not visible


def shade_mesh(obj, flat=False):
    """Apply smooth or flat shading across mesh polygons."""
    for poly in obj.data.polygons:
        poly.use_smooth = not flat


def create_ellipsoid(name, radius_xyz, center, mat, col, rot_deg=(0.0, 0.0, 0.0), segs=18, rings=12, flat=False):
    """Create a sculpted ellipsoid part in the target collection."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Diagonal((*radius_xyz, 1.0)), verts=bm.verts)
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


def create_taper_slab(name, size_xyz, center, mat, col, bevel=0.02, rot_deg=(0.0, 0.0, 0.0), taper_top=1.0, flat=False):
    """Create a tapered beveled rigid accent slab for brows, belts, buckles, and hood brim."""
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


def create_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, col, extend=0.015, segs=14, flat=False):
    """Create a smooth hemispherical-capped tapered limb or hair tube between two points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    length = max(0.01, span.length + extend * 2.0)
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_head, radius2=r_tail, depth=length
    )
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
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


def create_loft_mesh(name, sections, mat, col, segs=22, flat_chest=False):
    """Loft a watertight anatomical Z-profile tube from [(cx, cy, z, rx, ry), ...] rings."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for cx, cy, z, rx, ry in sections:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ca, sa = math.cos(ang), math.sin(ang)
            y_scale = 0.92 if (flat_chest and sa < 0.0) else 1.0
            ring.append(bm.verts.new((cx + ca * rx, cy + sa * ry * y_scale, z)))
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
    shade_mesh(obj, flat=False)
    bpy.context.scene.collection.objects.link(obj)
    link_to_collection(obj, col)
    return obj


def eval_catmull_rom(ctrl_pts, t):
    """Evaluate a uniform Catmull-Rom spline across (x, y, z, width, thickness, roll_deg) tuples."""
    n = len(ctrl_pts)
    padded = [ctrl_pts[0], *ctrl_pts, ctrl_pts[-1]]
    seg = min(int(t * (n - 1)), n - 2)
    u = max(0.0, min(1.0, t * (n - 1) - seg))
    u2, u3 = u * u, u * u * u
    p0, p1, p2, p3 = padded[seg], padded[seg + 1], padded[seg + 2], padded[seg + 3]
    out = [
        0.5 * ((2.0 * p1[k]) + (-p0[k] + p2[k]) * u + (2.0 * p0[k] - 5.0 * p1[k] + 4.0 * p2[k] - p3[k]) * u2
               + (-p0[k] + 3.0 * p1[k] - 3.0 * p2[k] + p3[k]) * u3)
        for k in range(6)
    ]
    return Vector((out[0], out[1], out[2])), max(0.004, out[3]), max(0.003, out[4]), out[5]


def create_hair_strand(name, ctrl_pts, mat, col, steps=16, profile_segs=10, ridge=0.45):
    """Loft a sculpted stylized almond/crescent hair lock along Catmull-Rom control points."""
    samples = [eval_catmull_rom(ctrl_pts, i / float(steps)) for i in range(steps + 1)]
    skull_center = Vector((0.0, -0.015, 1.338))
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    n_prev = None
    t_prev = None

    for i, (pos, width, thick, roll_deg) in enumerate(samples):
        if i == 0:
            tangent = (samples[1][0] - pos).normalized()
        elif i == steps:
            tangent = (pos - samples[i - 1][0]).normalized()
        else:
            tangent = (samples[i + 1][0] - samples[i - 1][0]).normalized()

        radial = pos - skull_center
        radial_perp = radial - tangent * radial.dot(tangent)
        radial_dir = radial_perp.normalized() if radial_perp.length > 1e-4 else tangent.orthogonal().normalized()

        if n_prev is None:
            out_base = radial_dir
        else:
            rot_q = t_prev.rotation_difference(tangent)
            transported = rot_q @ n_prev
            blended = transported * 0.75 + radial_dir * 0.25
            blended -= tangent * blended.dot(tangent)
            out_base = blended.normalized() if blended.length > 1e-4 else radial_dir

        n_prev, t_prev = out_base, tangent
        out_n = (Matrix.Rotation(math.radians(roll_deg), 3, tangent) @ out_base).normalized()
        side_b = tangent.cross(out_n).normalized()

        ring = []
        for s in range(profile_segs):
            ang = (2.0 * math.pi * s) / float(profile_segs)
            ca, sa = math.cos(ang), math.sin(ang)
            u_b = math.copysign(abs(ca) ** 0.82, ca) * width
            if sa >= 0.0:
                u_n = (sa * thick) + (1.0 - abs(ca)) * ridge * thick
            else:
                u_n = sa * thick * 0.55
            ring.append(bm.verts.new(pos + side_b * u_b + out_n * u_n))
        rings.append(ring)

    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        for s in range(profile_segs):
            ns = (s + 1) % profile_segs
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s]))

    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=False)
    bpy.context.scene.collection.objects.link(obj)
    link_to_collection(obj, col)
    return obj


def create_torus_ring(name, center, rot_deg, major_r, minor_r, mat, col, major_segs=18, minor_segs=10):
    """Create a smooth watertight sculpted ring (e.g., ponytail hair-tie band)."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for i in range(major_segs):
        phi = (2.0 * math.pi * i) / float(major_segs)
        cp, sp = math.cos(phi), math.sin(phi)
        ring = []
        for j in range(minor_segs):
            th = (2.0 * math.pi * j) / float(minor_segs)
            r = major_r + minor_r * math.cos(th)
            ring.append(bm.verts.new((cp * r, sp * r, minor_r * math.sin(th))))
        rings.append(ring)
    for i in range(major_segs):
        r0, r1 = rings[i], rings[(i + 1) % major_segs]
        for j in range(minor_segs):
            nj = (j + 1) % minor_segs
            bm.faces.new((r0[j], r1[j], r1[nj], r0[nj]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector(center)
    obj.rotation_euler = Euler(tuple(math.radians(a) for a in rot_deg), "XYZ")
    obj.data.materials.append(mat)
    shade_mesh(obj, flat=False)
    bpy.context.scene.collection.objects.link(obj)
    link_to_collection(obj, col)
    return obj


def join_remesh_smooth(name, parts, mat, col, voxel_size=0.012, smooth_factor=0.58, smooth_iters=10):
    """Join overlapping sculptural volumes, voxel-remesh into a solid manifold, and smooth transitions."""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="DESELECT")
    base = parts[0]
    for obj in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = base
    if len(parts) > 1:
        bpy.ops.object.join()
    base.name = name
    base.data.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    rem = base.modifiers.new(name="VoxelSculpt", type="REMESH")
    rem.mode = "VOXEL"
    rem.voxel_size = voxel_size
    rem.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=rem.name)

    sm = base.modifiers.new(name="OrganicSmooth", type="SMOOTH")
    sm.factor = smooth_factor
    sm.iterations = smooth_iters
    bpy.ops.object.modifier_apply(modifier=sm.name)

    base.data.materials.clear()
    base.data.materials.append(mat)
    shade_mesh(base, flat=False)
    link_to_collection(base, col)
    return base


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind a rigid part cleanly to a Rig_Hero bone preserving world transform."""
    bpy.context.view_layer.update()
    world_mat = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = world_mat


def sync_weights_from_body(obj, weight_source):
    """Copy exact body weights onto overlapping armor meshes, keeping ARMATURE_AUTO fallback on empty hems."""
    names = {g.index: g.name for g in obj.vertex_groups}
    saved = [{names[g.group]: g.weight for g in v.groups} for v in obj.data.vertices]
    existing = {g.name for g in obj.vertex_groups}
    for src_grp in weight_source.vertex_groups:
        if src_grp.name not in existing:
            obj.vertex_groups.new(name=src_grp.name)
            existing.add(src_grp.name)

    dt = obj.modifiers.new(name="BodyWeightSync", type="DATA_TRANSFER")
    dt.object = weight_source
    dt.use_vert_data = True
    dt.data_types_verts = {"VGROUP_WEIGHTS"}
    dt.vert_mapping = "POLYINTERP_NEAREST"
    dt.layers_vgroup_select_src = "ALL"
    dt.layers_vgroup_select_dst = "NAME"
    dt.mix_mode = "REPLACE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_move_to_index(modifier=dt.name, index=0)
    bpy.ops.object.modifier_apply(modifier=dt.name)

    by_name = {g.name: g for g in obj.vertex_groups}
    for v in obj.data.vertices:
        total = sum(g.weight for g in v.groups)
        if total > 0.01:
            for g in v.groups:
                g.weight /= total
        else:
            for name, grp in by_name.items():
                grp.add([v.index], saved[v.index].get(name, 0.0), "REPLACE")


def bind_automatic_weights(obj, arm_obj, allowed_bones=None, weight_source=None):
    """Bind a solid watertight mesh to Rig_Hero using Blender's Automatic Weights (ARMATURE_AUTO)."""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    deform_saved = {b.name: b.use_deform for b in arm_obj.data.bones}
    if allowed_bones is not None:
        allowed = set(allowed_bones)
        for b in arm_obj.data.bones:
            b.use_deform = b.name in allowed
    try:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        arm_obj.select_set(True)
        bpy.context.view_layer.objects.active = arm_obj
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    finally:
        for b in arm_obj.data.bones:
            b.use_deform = deform_saved.get(b.name, True)

    if weight_source is not None:
        sync_weights_from_body(obj, weight_source)

    for mod in obj.modifiers:
        if mod.type == "ARMATURE":
            mod.use_deform_preserve_volume = True

    weighted = sum(1 for v in obj.data.vertices if any(g.weight > 0.0 for g in v.groups))
    if len(obj.vertex_groups) == 0 or weighted < len(obj.data.vertices):
        raise RuntimeError(
            f"Automatic weights failed for {obj.name}: {weighted}/{len(obj.data.vertices)} vertices weighted"
        )
    return len(obj.vertex_groups), len(obj.data.vertices)


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
    """Build Rig_Hero ~1.56m Stylized Chibi-Heroic skeleton in clean A-pose facing -Y."""
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
    neck = add_bone("Neck", (0.0, -0.01, 1.07), (0.0, -0.01, 1.14), torso, connect=True)
    add_bone("Head", (0.0, -0.01, 1.14), (0.0, -0.01, 1.56), neck, connect=True)

    sh, el, wr, hn = MALE_ARM_AXES["sh"], MALE_ARM_AXES["el"], MALE_ARM_AXES["wr"], MALE_ARM_AXES["hn"]
    hip, kn, an, toe = MALE_LEG_AXES["hip"], MALE_LEG_AXES["kn"], MALE_LEG_AXES["an"], MALE_LEG_AXES["toe"]

    for sign, side in ((1.0, "L"), (-1.0, "R")):
        ua = add_bone(f"UpperArm_{side}", (sign * sh[0], sh[1], sh[2]), (sign * el[0], el[1], el[2]), torso)
        fa = add_bone(f"Forearm_{side}", (sign * el[0], el[1], el[2]), (sign * wr[0], wr[1], wr[2]), ua, connect=True)
        add_bone(f"Hand_{side}", (sign * wr[0], wr[1], wr[2]), (sign * hn[0], hn[1], hn[2]), fa, connect=True)

        th = add_bone(f"Thigh_{side}", (sign * hip[0], hip[1], hip[2]), (sign * kn[0], kn[1], kn[2]), pelvis)
        s_bone = add_bone(f"Shin_{side}", (sign * kn[0], kn[1], kn[2]), (sign * an[0], an[1], an[2]), th, connect=True)
        add_bone(f"Foot_{side}", (sign * an[0], an[1], an[2]), (sign * toe[0], toe[1], 0.02), s_bone, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.context.view_layer.update()

    add_socket_empty("Socket_Shoulder_L", (sh[0], sh[1], sh[2]), arm_obj, "Torso", core_col)
    add_socket_empty("Socket_Shoulder_R", (-sh[0], sh[1], sh[2]), arm_obj, "Torso", core_col)
    add_socket_empty("Socket_Hand_L", (0.295, -0.070, 0.540), arm_obj, "Hand_L", core_col)
    add_socket_empty("Socket_Hand_R", (-0.295, -0.070, 0.540), arm_obj, "Hand_R", core_col)
    add_socket_empty("Socket_Head", (0.0, -0.01, 1.50), arm_obj, "Head", core_col)
    add_socket_empty("Socket_Back", (0.0, 0.13, 0.92), arm_obj, "Torso", core_col)
    return arm_obj


def mirror_pt(pt, sign):
    return (sign * pt[0], pt[1], pt[2])


def build_body_skin_parts(tag, skin_mat, col, female=False):
    """Create generously overlapping anatomical primitives to fuse via Voxel Remesh."""
    parts = []
    # Shared cranium envelope guarantees Hair_* and Hood match both genders cleanly.
    skull_rad = (0.202, 0.184, 0.200) if female else (0.206, 0.188, 0.203)
    parts.append(create_ellipsoid(f"{tag}_Skull", skull_rad, (0.0, -0.015, 1.338), skin_mat, col, segs=20, rings=14))
    parts.append(create_ellipsoid(
        f"{tag}_Jaw", (0.132 if female else 0.148, 0.110, 0.082),
        (0.0, -0.055, 1.215), skin_mat, col, segs=16, rings=10,
    ))
    parts.append(create_ellipsoid(
        f"{tag}_Chin", (0.076 if female else 0.090, 0.078, 0.056),
        (0.0, -0.095, 1.182), skin_mat, col, segs=14, rings=8,
    ))
    parts.append(create_ellipsoid(f"{tag}_Nose", (0.025, 0.032, 0.026), (0.0, -0.208, 1.288), skin_mat, col, segs=10, rings=8))

    torso_sections = (
        [(0.0, 0.005, 0.575, 0.105, 0.090), (0.0, 0.004, 0.650, 0.146, 0.114), (0.0, 0.002, 0.725, 0.128, 0.102),
         (0.0, 0.000, 0.795, 0.098, 0.086), (0.0, -0.005, 0.900, 0.128, 0.104), (0.0, -0.010, 0.995, 0.146, 0.102),
         (0.0, -0.010, 1.030, 0.132, 0.094), (0.0, -0.010, 1.068, 0.092, 0.076), (0.0, -0.010, 1.112, 0.060, 0.056),
         (0.0, -0.010, 1.185, 0.058, 0.056)]
        if female else
        [(0.0, 0.005, 0.580, 0.110, 0.095), (0.0, 0.004, 0.648, 0.145, 0.112), (0.0, 0.002, 0.725, 0.142, 0.108),
         (0.0, 0.000, 0.795, 0.132, 0.102), (0.0, -0.006, 0.905, 0.156, 0.116), (0.0, -0.010, 0.995, 0.174, 0.122),
         (0.0, -0.010, 1.045, 0.148, 0.102), (0.0, -0.010, 1.080, 0.106, 0.084), (0.0, -0.010, 1.120, 0.070, 0.066),
         (0.0, -0.010, 1.185, 0.068, 0.065)]
    )
    parts.append(create_loft_mesh(f"{tag}_TorsoLoft", torso_sections, skin_mat, col, segs=24, flat_chest=not female))

    sh, el, wr, hn = MALE_ARM_AXES["sh"], MALE_ARM_AXES["el"], MALE_ARM_AXES["wr"], MALE_ARM_AXES["hn"]
    hip, kn, an, toe = MALE_LEG_AXES["hip"], MALE_LEG_AXES["kn"], MALE_LEG_AXES["an"], MALE_LEG_AXES["toe"]

    for sign, side in ((1.0, "L"), (-1.0, "R")):
        parts.append(create_ellipsoid(
            f"{tag}_Ear_{side}", (0.036, 0.042, 0.054),
            (sign * (skull_rad[0] - 0.006), -0.012, 1.300), skin_mat, col, segs=10, rings=8,
        ))
        if female:
            parts.append(create_ellipsoid(
                f"{tag}_Bust_{side}", (0.064, 0.062, 0.058),
                (sign * 0.058, -0.092, 0.922), skin_mat, col, segs=14, rings=10,
            ))
            parts.append(create_ellipsoid(
                f"{tag}_Glute_{side}", (0.080, 0.076, 0.076),
                (sign * 0.062, 0.058, 0.652), skin_mat, col, segs=14, rings=10,
            ))
        else:
            parts.append(create_ellipsoid(
                f"{tag}_Pec_{side}", (0.072, 0.036, 0.050),
                (sign * 0.070, -0.088, 0.960), skin_mat, col, segs=12, rings=8,
            ))

        deltoid_r = (0.062, 0.060, 0.062) if female else (0.074, 0.070, 0.070)
        parts.append(create_ellipsoid(f"{tag}_Deltoid_{side}", deltoid_r, mirror_pt(sh, sign), skin_mat, col, segs=12, rings=10))
        parts.append(create_capsule(
            f"{tag}_UA_{side}", mirror_pt(sh, sign), mirror_pt(el, sign),
            0.056 if female else 0.068, 0.048 if female else 0.058, skin_mat, col, extend=0.025,
        ))
        elbow_r = 0.049 if female else 0.059
        parts.append(create_ellipsoid(f"{tag}_Elb_{side}", (elbow_r, elbow_r, elbow_r), mirror_pt(el, sign), skin_mat, col, segs=10, rings=8))
        parts.append(create_capsule(
            f"{tag}_FA_{side}", mirror_pt(el, sign), mirror_pt(wr, sign),
            0.048 if female else 0.058, 0.040 if female else 0.047, skin_mat, col, extend=0.020,
        ))
        parts.append(create_ellipsoid(
            f"{tag}_Hand_{side}", (0.048 if female else 0.056, 0.050, 0.058),
            mirror_pt((0.296, -0.072, 0.542), sign), skin_mat, col, segs=12, rings=8,
        ))

        parts.append(create_capsule(
            f"{tag}_Th_{side}", mirror_pt(hip, sign), mirror_pt(kn, sign),
            0.080 if female else 0.088, 0.062 if female else 0.068, skin_mat, col, extend=0.030,
        ))
        knee_r = 0.062 if female else 0.068
        parts.append(create_ellipsoid(f"{tag}_Knee_{side}", (knee_r, knee_r, knee_r), mirror_pt(kn, sign), skin_mat, col, segs=10, rings=8))
        parts.append(create_capsule(
            f"{tag}_Sh_{side}", mirror_pt(kn, sign), mirror_pt(an, sign),
            0.060 if female else 0.068, 0.048 if female else 0.055, skin_mat, col, extend=0.022,
        ))
        parts.append(create_ellipsoid(
            f"{tag}_Heel_{side}", (0.052 if female else 0.058, 0.060, 0.050),
            (sign * an[0], 0.015, 0.054), skin_mat, col, segs=12, rings=8,
        ))
        parts.append(create_capsule(
            f"{tag}_Foot_{side}", (sign * an[0], 0.005, 0.052), (sign * toe[0], toe[1], 0.048),
            0.050 if female else 0.054, 0.040 if female else 0.044, skin_mat, col, extend=0.010,
        ))
    return parts


def paint_underwear_zones(body_obj, mats, female=False):
    """Assign briefs and female bandeau materials directly onto the remeshed solid body faces."""
    body_obj.data.materials.clear()
    body_obj.data.materials.append(mats["skin"])
    body_obj.data.materials.append(mats["pants"])
    body_obj.data.materials.append(mats["shirt"])

    for poly in body_obj.data.polygons:
        c = poly.center
        ax = abs(c.x)
        # Keep material zones inside torso/pelvis X envelope so lowered arms never receive cloth bands.
        leg_curve = 0.565 + 0.085 * max(0.0, min(1.0, (ax - 0.035) / 0.135))
        if ax < 0.215 and leg_curve <= c.z <= 0.745:
            poly.material_index = 1
        elif female and ax < 0.160 and 0.870 <= c.z <= 0.975:
            poly.material_index = 2
        else:
            poly.material_index = 0


def add_face_features(arm_obj, mats, col, female=False):
    """Attach crisp Sentinel eyes, pupils, highlights, and expressive brows flush against Head."""
    tag = "Fem" if female else "Male"
    parts = []
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        ex = sign * 0.058
        sclera = create_ellipsoid(f"{tag}_EyeW_{side}", (0.040, 0.016, 0.052), (ex, -0.175, 1.330), mats["eye_white"], col, segs=12, rings=8)
        iris = create_ellipsoid(f"{tag}_EyeIris_{side}", (0.030, 0.014, 0.041), (ex - sign * 0.001, -0.181, 1.328), mats["eye_iris"], col, segs=12, rings=8)
        pupil = create_ellipsoid(f"{tag}_EyePupil_{side}", (0.020, 0.012, 0.030), (ex - sign * 0.002, -0.186, 1.327), mats["eye_pupil"], col, segs=10, rings=6)
        spec = create_ellipsoid(f"{tag}_EyeSpec_{side}", (0.010, 0.008, 0.010), (ex + sign * 0.012, -0.190, 1.346), mats["eye_white"], col, segs=8, rings=6)
        brow = create_taper_slab(
            f"{tag}_Brow_{side}", (0.064, 0.016, 0.016), (ex, -0.179, 1.390),
            mats["hair"], col, bevel=0.004, rot_deg=(0.0, sign * (-4.0 if female else 5.0), sign * -4.0),
        )
        parts += [sclera, iris, pupil, spec, brow]
        if female:
            parts.append(create_taper_slab(
                f"{tag}_Lash_{side}", (0.042, 0.014, 0.011), (ex + sign * 0.016, -0.182, 1.362),
                mats["eye_pupil"], col, bevel=0.003, rot_deg=(0.0, sign * 12.0, sign * -6.0),
            ))
    bpy.context.view_layer.update()
    for obj in parts:
        parent_to_bone(obj, arm_obj, "Head")


def build_sculpted_body(arm_obj, mats, core_col, female=False):
    """Build ONE solid sculpted body mesh per gender, assign underwear materials, and bind via ARMATURE_AUTO."""
    tag = "Female" if female else "Male"
    raw_parts = build_body_skin_parts(tag, mats["skin"], core_col, female=female)
    body_obj = join_remesh_smooth(
        f"{tag}_Body_Sculpt", raw_parts, mats["skin"], core_col, voxel_size=0.011, smooth_factor=0.45, smooth_iters=5
    )
    for v in body_obj.data.vertices:
        if v.co.z < 0.002:
            v.co.z = 0.002
    paint_underwear_zones(body_obj, mats, female=female)
    vgs, vtx_count = bind_automatic_weights(body_obj, arm_obj)
    add_face_features(arm_obj, mats, core_col, female=female)
    print(f"Sculpted {tag} body bound via ARMATURE_AUTO: {vtx_count} verts across {vgs} bone groups")
    return body_obj


def _fuse_hair_strands(name, cap_spec, strands, mats, col, voxel_size=0.0085, smooth_factor=0.35, smooth_iters=3):
    """Build fitted scalp base + sculpted curved strand ribbons fused cleanly via Voxel Remesh."""
    cap_rad, cap_center, cap_rot = cap_spec
    parts = [create_ellipsoid(f"{name}_Scalp", cap_rad, cap_center, mats["hair"], col, rot_deg=cap_rot, segs=22, rings=14)]
    for idx, (ctrl_pts, steps, ridge) in enumerate(strands):
        parts.append(create_hair_strand(f"{name}_Strand_{idx}", ctrl_pts, mats["hair"], col, steps=steps, ridge=ridge))
    return join_remesh_smooth(name, parts, mats["hair"], col, voxel_size=voxel_size, smooth_factor=smooth_factor, smooth_iters=smooth_iters)


def build_hair_short(arm_obj, mats):
    """Build sculpted layered short adventurer crop with side-swept bangs, sideburns, and feathered nape."""
    col = get_or_create_collection("Hair_Short")
    strands = [
        # Crown sweep volumes from off-center part (x=+0.055)
        ([(0.055, -0.020, 1.535, 0.044, 0.036, 0.0), (0.010, -0.055, 1.552, 0.058, 0.036, -6.0),
          (-0.115, -0.045, 1.505, 0.056, 0.034, -12.0), (-0.195, -0.010, 1.395, 0.044, 0.026, -10.0)], 14, 0.42),
        ([(0.055, -0.010, 1.532, 0.042, 0.034, 0.0), (0.145, -0.025, 1.515, 0.052, 0.032, 8.0),
          (0.205, -0.005, 1.405, 0.042, 0.026, 10.0)], 12, 0.40),
        # 5 layered side-swept forehead bangs clearing eyes (z >= 1.365 over eye center)
        ([(0.055, -0.095, 1.522, 0.044, 0.030, 4.0), (-0.015, -0.172, 1.482, 0.048, 0.030, 8.0),
          (-0.100, -0.196, 1.412, 0.040, 0.026, 14.0), (-0.148, -0.168, 1.348, 0.018, 0.014, 16.0)], 14, 0.52),
        ([(0.045, -0.075, 1.530, 0.046, 0.030, 0.0), (0.015, -0.176, 1.472, 0.046, 0.028, -4.0),
          (-0.022, -0.204, 1.398, 0.036, 0.024, 6.0), (-0.038, -0.200, 1.366, 0.016, 0.013, 8.0)], 14, 0.55),
        ([(0.060, -0.080, 1.525, 0.042, 0.028, -4.0), (0.068, -0.172, 1.468, 0.040, 0.026, -8.0),
          (0.052, -0.202, 1.396, 0.032, 0.022, -6.0), (0.025, -0.202, 1.366, 0.015, 0.012, -4.0)], 14, 0.52),
        ([(0.068, -0.065, 1.520, 0.040, 0.028, -6.0), (0.128, -0.142, 1.460, 0.040, 0.026, -12.0),
          (0.155, -0.155, 1.390, 0.030, 0.022, -14.0), (0.145, -0.156, 1.340, 0.015, 0.012, -12.0)], 14, 0.48),
        ([(0.015, -0.020, 1.545, 0.045, 0.030, 0.0), (-0.095, -0.115, 1.490, 0.045, 0.028, 12.0),
          (-0.178, -0.120, 1.392, 0.036, 0.024, 14.0), (-0.184, -0.116, 1.320, 0.016, 0.013, 12.0)], 14, 0.46),
        # Sculpted temple sideburns framing ears (L/R)
        ([(0.165, -0.055, 1.435, 0.036, 0.025, -8.0), (0.196, -0.082, 1.355, 0.034, 0.024, -10.0),
          (0.194, -0.092, 1.292, 0.026, 0.020, -6.0), (0.180, -0.092, 1.248, 0.014, 0.012, 0.0)], 12, 0.45),
        ([(-0.165, -0.055, 1.435, 0.036, 0.025, 8.0), (-0.196, -0.082, 1.355, 0.034, 0.024, 10.0),
          (-0.194, -0.092, 1.292, 0.026, 0.020, 6.0), (-0.180, -0.092, 1.248, 0.014, 0.012, 0.0)], 12, 0.45),
        # Behind-ear transition locks
        ([(0.160, 0.030, 1.430, 0.044, 0.028, 6.0), (0.195, 0.068, 1.330, 0.042, 0.026, 4.0),
          (0.165, 0.085, 1.235, 0.032, 0.022, 0.0), (0.135, 0.088, 1.190, 0.015, 0.012, 0.0)], 12, 0.44),
        ([(-0.160, 0.030, 1.430, 0.044, 0.028, -6.0), (-0.195, 0.068, 1.330, 0.042, 0.026, -4.0),
          (-0.165, 0.085, 1.235, 0.032, 0.022, 0.0), (-0.135, 0.088, 1.190, 0.015, 0.012, 0.0)], 12, 0.44),
    ]
    # 7 feathered overlapping nape locks tapering smoothly onto neck
    for x0, x1, y_peak, z_end, roll in (
        (-0.135, -0.105, 0.148, 1.195, -10.0), (-0.090, -0.070, 0.172, 1.178, -6.0),
        (-0.045, -0.032, 0.186, 1.168, -2.0), (0.000, 0.005, 0.192, 1.164, 0.0),
        (0.045, 0.038, 0.186, 1.168, 2.0), (0.090, 0.072, 0.172, 1.178, 6.0),
        (0.135, 0.105, 0.148, 1.195, 10.0),
    ):
        strands.append((
            [(x0 * 0.72, 0.065, 1.475, 0.044, 0.028, roll), (x0, y_peak, 1.355, 0.046, 0.030, roll * 0.6),
             (x1 * 1.05, y_peak * 0.86, 1.245, 0.034, 0.024, 0.0), (x1, y_peak * 0.64, z_end, 0.015, 0.012, 0.0)],
            14, 0.48,
        ))
    sculpt = _fuse_hair_strands("Hair_Short_Sculpt", ((0.212, 0.196, 0.168), (0.0, 0.014, 1.390), (8.0, 0.0, 0.0)), strands, mats, col)
    parent_to_bone(sculpt, arm_obj, "Head")
    return col


def build_hair_long(arm_obj, mats):
    """Build sculpted flowing long hair with curtain bangs, shoulder wisps, and lush S-curved back cascade."""
    col = get_or_create_collection("Hair_Long")
    strands = [
        # Sleek parted crown drape L/R
        ([(0.010, -0.015, 1.540, 0.048, 0.032, 0.0), (0.110, -0.015, 1.505, 0.056, 0.032, 8.0),
          (0.195, 0.015, 1.385, 0.052, 0.030, 8.0), (0.205, 0.055, 1.245, 0.036, 0.022, 4.0)], 14, 0.40),
        ([(0.010, -0.015, 1.540, 0.048, 0.032, 0.0), (-0.110, -0.015, 1.505, 0.056, 0.032, -8.0),
          (-0.195, 0.015, 1.385, 0.052, 0.030, -8.0), (-0.205, 0.055, 1.245, 0.036, 0.022, -4.0)], 14, 0.40),
    ]
    for sign in (1.0, -1.0):
        # 2 curtain bangs per side sweeping cleanly past eyes & cheekbones
        strands.append((
            [(0.010, -0.090, 1.518, 0.042, 0.028, 0.0), (sign * 0.088, -0.168, 1.462, 0.042, 0.028, -10.0 * sign),
             (sign * 0.148, -0.162, 1.372, 0.034, 0.024, -14.0 * sign), (sign * 0.172, -0.128, 1.255, 0.016, 0.013, -8.0 * sign)],
            14, 0.50,
        ))
        strands.append((
            [(sign * 0.025, -0.055, 1.530, 0.044, 0.028, 0.0), (sign * 0.130, -0.130, 1.455, 0.042, 0.028, -12.0 * sign),
             (sign * 0.188, -0.115, 1.345, 0.036, 0.024, -10.0 * sign), (sign * 0.190, -0.095, 1.215, 0.016, 0.013, -4.0 * sign)],
            14, 0.48,
        ))
        # 2 layered front shoulder-drape locks framing torso cleanly inside arm/chest clearance
        strands.append((
            [(sign * 0.130, -0.030, 1.485, 0.042, 0.028, 0.0), (sign * 0.195, -0.072, 1.345, 0.042, 0.028, -8.0 * sign),
             (sign * 0.180, -0.102, 1.175, 0.038, 0.026, -4.0 * sign), (sign * 0.162, -0.085, 1.015, 0.024, 0.018, 4.0 * sign),
             (sign * 0.170, -0.070, 0.960, 0.014, 0.012, 6.0 * sign)],
            18, 0.46,
        ))
        strands.append((
            [(sign * 0.145, 0.010, 1.465, 0.044, 0.028, 0.0), (sign * 0.206, -0.028, 1.325, 0.044, 0.028, 6.0 * sign),
             (sign * 0.192, -0.045, 1.155, 0.038, 0.026, 8.0 * sign), (sign * 0.172, -0.025, 0.995, 0.024, 0.018, 4.0 * sign),
             (sign * 0.182, 0.000, 0.935, 0.014, 0.012, 0.0)],
            18, 0.44,
        ))
        # Behind-ear side curtain bridge joining front shoulder lock seamlessly to back cascade
        strands.append((
            [(sign * 0.145, 0.035, 1.475, 0.046, 0.030, 0.0), (sign * 0.204, 0.068, 1.320, 0.048, 0.032, 6.0 * sign),
             (sign * 0.192, 0.095, 1.135, 0.044, 0.028, 4.0 * sign), (sign * 0.178, 0.120, 0.965, 0.024, 0.018, 0.0)],
            18, 0.42,
        ))

    # 9 lush layered S-curved back locks (hugging back silhouette cleanly without lateral flare gap)
    back_specs = (
        (-0.168, -0.170, 0.125, 0.162, 0.955, -10.0), (-0.128, -0.132, 0.155, 0.182, 0.925, -8.0),
        (-0.086, -0.090, 0.174, 0.196, 0.895, -5.0), (-0.043, -0.045, 0.184, 0.206, 0.878, -2.0),
        (0.000, 0.000, 0.188, 0.210, 0.870, 0.0), (0.043, 0.045, 0.184, 0.206, 0.878, 2.0),
        (0.086, 0.090, 0.174, 0.196, 0.895, 5.0), (0.128, 0.132, 0.155, 0.182, 0.925, 8.0),
        (0.168, 0.170, 0.125, 0.162, 0.955, 10.0),
    )
    for x0, x1, y_mid, y_low, z_end, roll in back_specs:
        strands.append((
            [(x0 * 0.72, 0.045, 1.495, 0.050, 0.032, roll), (x0, y_mid, 1.330, 0.052, 0.034, roll * 0.5),
             (x1, y_low * 0.92, 1.140, 0.048, 0.032, roll * 0.3), (x1 * 1.02, y_low, 0.985, 0.034, 0.024, 0.0),
             (x1 * 1.05, y_low + 0.022, z_end, 0.015, 0.012, 0.0)],
            20, 0.45,
        ))
    sculpt = _fuse_hair_strands("Hair_Long_Sculpt", ((0.212, 0.196, 0.168), (0.0, 0.012, 1.392), (4.0, 0.0, 0.0)), strands, mats, col)
    parent_to_bone(sculpt, arm_obj, "Head")
    return col


def build_hair_spiky(arm_obj, mats):
    """Build dynamic swept-back heroic crescent-blade spiky hair (no floating cone blobs)."""
    col = get_or_create_collection("Hair_Spiky")
    strands = [
        # 3 top dorsal crest blades curving up/back inside 192x192 ceiling (z <= 1.62)
        ([(0.000, -0.055, 1.505, 0.048, 0.036, 0.0), (0.000, -0.010, 1.585, 0.046, 0.036, 0.0),
          (0.000, 0.090, 1.615, 0.034, 0.028, 0.0), (0.000, 0.175, 1.610, 0.017, 0.014, 0.0)], 16, 0.60),
        ([(0.055, -0.035, 1.498, 0.044, 0.034, -8.0), (0.088, 0.018, 1.568, 0.042, 0.032, -10.0),
          (0.115, 0.115, 1.592, 0.030, 0.024, -10.0), (0.130, 0.190, 1.585, 0.016, 0.013, -8.0)], 15, 0.58),
        ([(-0.055, -0.035, 1.498, 0.044, 0.034, 8.0), (-0.088, 0.018, 1.568, 0.042, 0.032, 10.0),
          (-0.115, 0.115, 1.592, 0.030, 0.024, 10.0), (-0.130, 0.190, 1.585, 0.016, 0.013, 8.0)], 15, 0.58),
        # 4 energetic swept brow spikes clearing eyes (z >= 1.365)
        ([(0.020, -0.095, 1.505, 0.042, 0.030, 4.0), (-0.025, -0.185, 1.472, 0.038, 0.028, 8.0),
          (-0.068, -0.215, 1.402, 0.026, 0.022, 12.0), (-0.090, -0.205, 1.368, 0.015, 0.013, 12.0)], 14, 0.56),
        ([(0.035, -0.085, 1.505, 0.040, 0.030, -4.0), (0.065, -0.178, 1.468, 0.036, 0.026, -8.0),
          (0.088, -0.208, 1.398, 0.026, 0.020, -10.0), (0.098, -0.195, 1.366, 0.015, 0.012, -10.0)], 14, 0.56),
        ([(-0.060, -0.075, 1.498, 0.042, 0.030, 12.0), (-0.135, -0.155, 1.455, 0.038, 0.028, 16.0),
          (-0.182, -0.165, 1.392, 0.026, 0.020, 16.0), (-0.200, -0.145, 1.348, 0.015, 0.012, 12.0)], 14, 0.54),
        ([(0.060, -0.075, 1.498, 0.042, 0.030, -12.0), (0.135, -0.155, 1.455, 0.038, 0.028, -16.0),
          (0.182, -0.165, 1.392, 0.026, 0.020, -16.0), (0.200, -0.145, 1.348, 0.015, 0.012, -12.0)], 14, 0.54),
    ]
    for sign in (1.0, -1.0):
        # Upper lateral wing spikes flaring up/back
        strands.append((
            [(sign * 0.115, -0.020, 1.465, 0.046, 0.034, -10.0 * sign), (sign * 0.195, 0.025, 1.495, 0.042, 0.030, -12.0 * sign),
             (sign * 0.242, 0.105, 1.515, 0.028, 0.022, -10.0 * sign), (sign * 0.258, 0.172, 1.518, 0.016, 0.013, -6.0 * sign)],
            14, 0.58,
        ))
        # Mid-temple swept-back wing spikes
        strands.append((
            [(sign * 0.135, -0.035, 1.405, 0.044, 0.032, -8.0 * sign), (sign * 0.210, 0.012, 1.402, 0.040, 0.028, -8.0 * sign),
             (sign * 0.248, 0.088, 1.405, 0.028, 0.022, -6.0 * sign), (sign * 0.252, 0.155, 1.410, 0.016, 0.013, 0.0)],
            14, 0.56,
        ))
        # Lower cheek / behind-ear flare spikes
        strands.append((
            [(sign * 0.145, -0.015, 1.330, 0.040, 0.028, 0.0), (sign * 0.205, 0.042, 1.315, 0.038, 0.026, 4.0 * sign),
             (sign * 0.222, 0.118, 1.298, 0.026, 0.020, 6.0 * sign), (sign * 0.212, 0.175, 1.288, 0.015, 0.012, 6.0 * sign)],
            13, 0.52,
        ))
    # Back crown & nape kicked-out spikes
    for x0, x1, z_base, z_tip, y_tip in (
        (0.000, 0.000, 1.425, 1.475, 0.275), (-0.085, -0.115, 1.405, 1.445, 0.260),
        (0.085, 0.115, 1.405, 1.445, 0.260), (-0.065, -0.085, 1.285, 1.260, 0.242),
        (0.065, 0.085, 1.285, 1.260, 0.242), (0.000, 0.000, 1.275, 1.230, 0.246),
    ):
        strands.append((
            [(x0 * 0.7, 0.075, z_base + 0.02, 0.044, 0.032, 0.0), (x0, 0.165, z_base + 0.015, 0.040, 0.030, 0.0),
             (x1, (0.165 + y_tip) * 0.54, (z_base + z_tip) * 0.5, 0.028, 0.022, 0.0), (x1, y_tip, z_tip, 0.016, 0.013, 0.0)],
            14, 0.56,
        ))
    sculpt = _fuse_hair_strands(
        "Hair_Spiky_Sculpt", ((0.214, 0.200, 0.168), (0.0, 0.014, 1.388), (6.0, 0.0, 0.0)),
        strands, mats, col, voxel_size=0.0085, smooth_factor=0.30, smooth_iters=3,
    )
    parent_to_bone(sculpt, arm_obj, "Head")
    return col


def build_hair_ponytail(arm_obj, mats):
    """Build pulled-back sculpted hair with bangs, tendrils, gold ring, and 7-strand S-wave ponytail plume."""
    col = get_or_create_collection("Hair_Ponytail")
    gather = (0.0, 0.145, 1.490)
    strands = [
        # 3 soft side-swept forehead bangs clearing eyes
        ([(0.035, -0.085, 1.515, 0.042, 0.028, 4.0), (-0.015, -0.174, 1.472, 0.042, 0.026, 8.0),
          (-0.085, -0.192, 1.404, 0.034, 0.022, 12.0), (-0.125, -0.172, 1.362, 0.015, 0.012, 12.0)], 14, 0.48),
        ([(0.045, -0.075, 1.515, 0.038, 0.026, -6.0), (0.075, -0.168, 1.466, 0.038, 0.024, -10.0),
          (0.118, -0.166, 1.396, 0.028, 0.020, -10.0), (0.136, -0.155, 1.356, 0.014, 0.011, -8.0)], 14, 0.46),
        ([(-0.010, -0.055, 1.525, 0.042, 0.026, 0.0), (-0.105, -0.135, 1.468, 0.040, 0.024, 12.0),
          (-0.168, -0.122, 1.388, 0.030, 0.020, 12.0), (-0.180, -0.110, 1.335, 0.014, 0.011, 10.0)], 13, 0.44),
    ]
    for sign in (1.0, -1.0):
        # Cheek-framing wispy tendrils
        strands.append((
            [(sign * 0.145, -0.055, 1.425, 0.028, 0.020, 0.0), (sign * 0.182, -0.095, 1.335, 0.026, 0.018, -8.0 * sign),
             (sign * 0.168, -0.112, 1.255, 0.020, 0.015, -4.0 * sign), (sign * 0.154, -0.105, 1.215, 0.012, 0.010, 0.0)],
            13, 0.42,
        ))
        # Upper & temple comb-back tension strands sweeping into the ponytail gather
        strands.append((
            [(sign * 0.065, -0.115, 1.480, 0.044, 0.028, 0.0), (sign * 0.075, -0.015, 1.545, 0.046, 0.028, 0.0),
             (sign * 0.032, 0.085, 1.522, 0.038, 0.026, 0.0), (0.0, gather[1], gather[2], 0.024, 0.022, 0.0)],
            14, 0.42,
        ))
        strands.append((
            [(sign * 0.175, -0.045, 1.375, 0.042, 0.026, 0.0), (sign * 0.178, 0.055, 1.415, 0.042, 0.026, 0.0),
             (sign * 0.092, 0.122, 1.462, 0.034, 0.024, 0.0), (0.0, gather[1], gather[2], 0.024, 0.022, 0.0)],
            14, 0.42,
        ))
        # Underside nape comb-up strands sweeping up to the gather
        strands.append((
            [(sign * 0.095, 0.115, 1.235, 0.038, 0.024, 0.0), (sign * 0.092, 0.165, 1.335, 0.040, 0.026, 0.0),
             (sign * 0.048, 0.158, 1.425, 0.034, 0.024, 0.0), (0.0, gather[1], gather[2], 0.022, 0.020, 0.0)],
            13, 0.40,
        ))

    # Central nape sweep into gather
    strands.append((
        [(0.0, 0.125, 1.220, 0.046, 0.028, 0.0), (0.0, 0.178, 1.325, 0.048, 0.030, 0.0),
         (0.0, 0.165, 1.425, 0.038, 0.026, 0.0), (0.0, gather[1], gather[2], 0.024, 0.022, 0.0)],
        13, 0.40,
    ))

    # 7-strand cascading S-wave ponytail plume arcing smoothly from gather (z <= 1.61, y <= 0.34, z >= 1.12)
    plume_offsets = (
        (0.000, 0.000, 0.036, 0.028, 1.115, 0.0), (-0.036, 0.015, 0.034, 0.026, 1.148, -10.0),
        (0.036, 0.015, 0.034, 0.026, 1.148, 10.0), (-0.055, -0.012, 0.032, 0.024, 1.185, -14.0),
        (0.055, -0.012, 0.032, 0.024, 1.185, 14.0), (-0.022, 0.022, 0.032, 0.026, 1.132, -6.0),
        (0.022, 0.022, 0.032, 0.026, 1.132, 6.0),
    )
    for dx, dy, w_mid, t_mid, z_tip, roll in plume_offsets:
        strands.append((
            [(gather[0] + dx * 0.20, gather[1], gather[2], 0.022, 0.020, roll),
             (gather[0] + dx * 0.85, 0.218 + dy * 0.5, 1.568 + dy * 0.6, w_mid, t_mid, roll),
             (gather[0] + dx * 1.15, 0.295 + dy, 1.455, w_mid * 1.05, t_mid, roll * 0.7),
             (gather[0] + dx * 1.05, 0.312 + dy * 0.8, 1.295, w_mid * 0.85, t_mid * 0.85, roll * 0.3),
             (gather[0] + dx * 0.85, 0.275 + dy * 0.5, z_tip, 0.014, 0.011, 0.0)],
            18, 0.50,
        ))

    sculpt = _fuse_hair_strands("Hair_Ponytail_Sculpt", ((0.210, 0.194, 0.164), (0.0, 0.012, 1.390), (6.0, 0.0, 0.0)), strands, mats, col)
    band = create_torus_ring("HairPony_Band", (0.0, 0.148, 1.494), (-52.0, 0.0, 0.0), 0.048, 0.020, mats["gold"], col)
    parent_to_bone(sculpt, arm_obj, "Head")
    parent_to_bone(band, arm_obj, "Head")
    return col


def add_hair_styles(arm_obj, mats):
    """Build 4 high-craft voxel-sculpted 3D hair collections parented to Head."""
    return [
        build_hair_short(arm_obj, mats),
        build_hair_long(arm_obj, mats),
        build_hair_spiky(arm_obj, mats),
        build_hair_ponytail(arm_obj, mats),
    ]


def build_sculpted_tunic_slot(arm_obj, mats, body_obj, female=False):
    """Build ONE solid sculpted leather tunic + long sleeves + cuffs bound via ARMATURE_AUTO."""
    tag = "Female" if female else "Male"
    col_t = get_or_create_collection(f"Armor_Chest_LeatherTunic_{tag}")
    get_or_create_collection(f"Armor_Chest_Sleeves_{tag}")  # Preserved empty for layer-stack compatibility.

    tunic_sections = (
        [(0.0, 0.004, 0.560, 0.172, 0.136), (0.0, 0.002, 0.650, 0.168, 0.134), (0.0, 0.000, 0.725, 0.150, 0.122),
         (0.0, 0.000, 0.795, 0.124, 0.108), (0.0, -0.003, 0.850, 0.138, 0.116), (0.0, -0.006, 0.905, 0.150, 0.122),
         (0.0, -0.010, 0.995, 0.168, 0.124), (0.0, -0.010, 1.072, 0.134, 0.104)]
        if female else
        [(0.0, 0.004, 0.560, 0.180, 0.140), (0.0, 0.002, 0.650, 0.172, 0.134), (0.0, 0.002, 0.725, 0.166, 0.130),
         (0.0, 0.000, 0.795, 0.154, 0.124), (0.0, -0.003, 0.850, 0.160, 0.128), (0.0, -0.006, 0.905, 0.174, 0.136),
         (0.0, -0.010, 0.995, 0.194, 0.144), (0.0, -0.010, 1.075, 0.154, 0.118)]
    )
    parts = [create_loft_mesh(f"Tunic_{tag}_TorsoLoft", tunic_sections, mats["tunic"], col_t, segs=24, flat_chest=not female)]
    sh, el, wr = MALE_ARM_AXES["sh"], MALE_ARM_AXES["el"], MALE_ARM_AXES["wr"]
    cuff_pt = (wr[0] * 0.88 + el[0] * 0.12, wr[1] * 0.88 + el[1] * 0.12, wr[2] * 0.88 + el[2] * 0.12)

    for sign, side in ((1.0, "L"), (-1.0, "R")):
        if female:
            parts.append(create_ellipsoid(
                f"Tunic_FemBust_{side}", (0.084, 0.084, 0.078),
                (sign * 0.064, -0.106, 0.922), mats["tunic"], col_t, segs=14, rings=10,
            ))
        dr = (0.072, 0.070, 0.070) if female else (0.084, 0.080, 0.080)
        parts.append(create_ellipsoid(f"Tunic_ShCap_{tag}_{side}", dr, mirror_pt(sh, sign), mats["tunic"], col_t, segs=12, rings=8))
        parts.append(create_capsule(
            f"Tunic_UA_{tag}_{side}", mirror_pt(sh, sign), mirror_pt(el, sign),
            0.068 if female else 0.078, 0.058 if female else 0.068, mats["tunic"], col_t, extend=0.016,
        ))
        parts.append(create_capsule(
            f"Tunic_FA_{tag}_{side}", mirror_pt(el, sign), mirror_pt(cuff_pt, sign),
            0.058 if female else 0.068, 0.050 if female else 0.058, mats["tunic"], col_t, extend=0.005,
        ))

    tunic_obj = join_remesh_smooth(
        f"Tunic_{tag}_Sculpt", parts, mats["tunic"], col_t, voxel_size=0.012, smooth_factor=0.45, smooth_iters=5
    )
    # Paint dark leather collar band and forearm bracer cuffs cleanly on the single tunic mesh.
    tunic_obj.data.materials.clear()
    tunic_obj.data.materials.append(mats["tunic"])
    tunic_obj.data.materials.append(mats["hood"])
    tunic_obj.data.materials.append(mats["boots"])
    for poly in tunic_obj.data.polygons:
        c = poly.center
        if c.z >= 1.045 and abs(c.x) < 0.165:
            poly.material_index = 1
        elif abs(c.x) > 0.255 and c.z <= 0.720:
            poly.material_index = 2
        else:
            poly.material_index = 0

    bind_automatic_weights(
        tunic_obj, arm_obj, ("Pelvis", "Torso", "Neck", "UpperArm_L", "Forearm_L", "UpperArm_R", "Forearm_R"),
        weight_source=body_obj,
    )

    belt_rx = 0.164 if female else 0.182
    belt_ry = 0.134 if female else 0.144
    belt = create_ellipsoid(f"Tunic_{tag}_Belt", (belt_rx, belt_ry, 0.052), (0.0, 0.0, 0.725), mats["boots"], col_t, segs=22, rings=10)
    buckle = create_taper_slab(f"Tunic_{tag}_Buckle", (0.088, 0.042, 0.082), (0.0, -belt_ry - 0.010, 0.725), mats["gold"], col_t, bevel=0.01, flat=True)
    rigids = [(belt, "Pelvis"), (buckle, "Pelvis")]
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        pad = create_ellipsoid(
            f"Tunic_{tag}_Pauldron_{side}", (0.088, 0.086, 0.068),
            (sign * (sh[0] + 0.005), sh[1], sh[2] + 0.025), mats["hood"], col_t, rot_deg=(0.0, sign * 20.0, 0.0), segs=12, rings=8,
        )
        rigids.append((pad, "Torso"))
    bpy.context.view_layer.update()
    for obj, bone in rigids:
        parent_to_bone(obj, arm_obj, bone)
    return col_t


def build_sculpted_leggings_slot(arm_obj, mats, body_obj, female=False):
    """Build ONE solid sculpted leather leggings mesh bound via ARMATURE_AUTO."""
    tag = "Female" if female else "Male"
    col_l = get_or_create_collection(f"Armor_Legs_LeatherLeggings_{tag}")
    hip, kn, an = MALE_LEG_AXES["hip"], MALE_LEG_AXES["kn"], MALE_LEG_AXES["an"]

    pelvis_sec = (
        [(0.0, 0.005, 0.560, 0.125, 0.106), (0.0, 0.004, 0.650, 0.168, 0.132), (0.0, 0.002, 0.740, 0.145, 0.118)]
        if female else
        [(0.0, 0.005, 0.560, 0.132, 0.112), (0.0, 0.004, 0.650, 0.168, 0.132), (0.0, 0.002, 0.740, 0.162, 0.126)]
    )
    parts = [create_loft_mesh(f"Leggings_{tag}_Pelvis", pelvis_sec, mats["leggings"], col_l, segs=22)]
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        if female:
            parts.append(create_ellipsoid(
                f"Leggings_FemGlute_{side}", (0.094, 0.090, 0.090),
                (sign * 0.062, 0.058, 0.652), mats["leggings"], col_l, segs=14, rings=10,
            ))
        parts.append(create_capsule(
            f"Leggings_{tag}_Th_{side}", mirror_pt(hip, sign), mirror_pt(kn, sign),
            0.096 if female else 0.106, 0.076 if female else 0.086, mats["leggings"], col_l, extend=0.025,
        ))
        shin_mid = (sign * an[0], 0.0, 0.185)
        parts.append(create_capsule(
            f"Leggings_{tag}_Sh_{side}", mirror_pt(kn, sign), shin_mid,
            0.076 if female else 0.086, 0.064 if female else 0.072, mats["leggings"], col_l, extend=0.015,
        ))

    leg_obj = join_remesh_smooth(
        f"Leggings_{tag}_Sculpt", parts, mats["leggings"], col_l, voxel_size=0.012, smooth_factor=0.45, smooth_iters=5
    )
    bind_automatic_weights(
        leg_obj, arm_obj, ("Pelvis", "Thigh_L", "Shin_L", "Thigh_R", "Shin_R"), weight_source=body_obj
    )

    bpy.context.view_layer.update()
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        knee = create_ellipsoid(
            f"Leggings_{tag}_Knee_{side}", (0.046 if female else 0.050, 0.026, 0.042),
            (sign * kn[0], kn[1] - 0.068, kn[2] + 0.008), mats["boots"], col_l, segs=10, rings=8, flat=True,
        )
        parent_to_bone(knee, arm_obj, f"Shin_{side}")
    return col_l


def build_sculpted_boots_slot(arm_obj, mats):
    """Build smooth cuffed Leather Boots bound cleanly via ARMATURE_AUTO."""
    col_boots = get_or_create_collection("Armor_Feet_LeatherBoots")
    an, toe = MALE_LEG_AXES["an"], MALE_LEG_AXES["toe"]
    rigids = []
    for sign, side in ((1.0, "L"), (-1.0, "R")):
        parts = [
            create_capsule(f"BootShaft_{side}", (sign * an[0], -0.006, 0.285), (sign * an[0], 0.012, 0.090), 0.084, 0.076, mats["boots"], col_boots, extend=0.015),
            create_ellipsoid(f"BootHeel_{side}", (0.072, 0.078, 0.058), (sign * an[0], 0.018, 0.062), mats["boots"], col_boots, segs=14, rings=10),
            create_capsule(f"BootVamp_{side}", (sign * an[0], 0.006, 0.062), (sign * toe[0], toe[1], 0.056), 0.070, 0.054, mats["boots"], col_boots, extend=0.012),
        ]
        boot_obj = join_remesh_smooth(
            f"Boot_{side}_Sculpt", parts, mats["boots"], col_boots, voxel_size=0.012, smooth_factor=0.42, smooth_iters=4
        )
        for v in boot_obj.data.vertices:
            if v.co.z < 0.002:
                v.co.z = 0.002
        bind_automatic_weights(boot_obj, arm_obj, (f"Shin_{side}", f"Foot_{side}"))

        cuff = create_ellipsoid(
            f"Boot_Cuff_{side}", (0.094, 0.092, 0.042),
            (sign * an[0], -0.005, 0.290), mats["tunic"], col_boots, segs=16, rings=8,
        )
        rigids.append((cuff, f"Shin_{side}"))

    bpy.context.view_layer.update()
    for obj, bone in rigids:
        parent_to_bone(obj, arm_obj, bone)
    return col_boots


def add_armor_slots(arm_obj, mats, bodies):
    """Build modular 4-slot Leather Armor collections matching sculpted body clearances."""
    col_hood = get_or_create_collection("Armor_Head_LeatherHood")
    hood_parts = [
        (create_ellipsoid("Hood_Crown", (0.244, 0.236, 0.224), (0.0, 0.018, 1.372), mats["hood"], col_hood, segs=18, rings=12), "Head"),
        (create_taper_slab("Hood_Peak", (0.20, 0.18, 0.16), (0.0, 0.170, 1.427), mats["hood"], col_hood, bevel=0.04, rot_deg=(24.0, 0.0, 0.0), taper_top=0.45), "Head"),
        (create_taper_slab("Hood_Brim", (0.31, 0.12, 0.072), (0.0, -0.145, 1.482), mats["hood"], col_hood, bevel=0.022, rot_deg=(-20.0, 0.0, 0.0)), "Head"),
        (create_taper_slab("Hood_Cowl", (0.34, 0.28, 0.14), (0.0, 0.01, 1.112), mats["hood"], col_hood, bevel=0.035, taper_top=0.84), "Torso"),
        (create_taper_slab("Hood_Clasp", (0.075, 0.04, 0.065), (0.0, -0.145, 1.072), mats["gold"], col_hood, bevel=0.01, flat=True), "Torso"),
    ]
    bpy.context.view_layer.update()
    for obj, bone in hood_parts:
        parent_to_bone(obj, arm_obj, bone)

    cols_chest = [
        build_sculpted_tunic_slot(arm_obj, mats, bodies["Male"], female=False),
        bpy.data.collections["Armor_Chest_Sleeves_Male"],
        build_sculpted_tunic_slot(arm_obj, mats, bodies["Female"], female=True),
        bpy.data.collections["Armor_Chest_Sleeves_Female"],
    ]
    cols_legs = [
        build_sculpted_leggings_slot(arm_obj, mats, bodies["Male"], female=False),
        build_sculpted_leggings_slot(arm_obj, mats, bodies["Female"], female=True),
    ]
    col_boots = build_sculpted_boots_slot(arm_obj, mats)
    return [col_hood, *cols_chest, *cols_legs, col_boots]


def build_player_scene(save_blend_path=None):
    """Build complete Stylized Chibi-Heroic Player Blender scene with sculpted Male/Female, 4 Hairs, 4 Armors & 12 Actions."""
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
    male_body = build_sculpted_body(arm_obj, mats, male_core, female=False)

    fem_core = get_or_create_collection("Body_Female_Core")
    fem_arms = get_or_create_collection("Body_Female_Arms")
    female_body = build_sculpted_body(arm_obj, mats, fem_core, female=True)

    hair_cols = add_hair_styles(arm_obj, mats)
    armor_cols = add_armor_slots(arm_obj, mats, {"Male": male_body, "Female": female_body})
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
