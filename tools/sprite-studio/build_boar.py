"""Builds a sculpted Rig_Quadruped Wild Boar with continuous thin mohawk, curved crescent tusks, and smooth-beveled anatomy."""

import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from quadruped_actions import apply_quadruped_actions
from studio_core import make_toon_material, setup_pixel_studio


def apply_shading(obj, smooth=True, subsurf=False):
    """Apply smooth shading and optional Subsurf smoothing for clean sculpted cel bands."""
    if subsurf:
        mod = obj.modifiers.new(name="SmoothSub", type="SUBSURF")
        mod.levels = 1
        mod.render_levels = 1
    for poly in obj.data.polygons:
        poly.use_smooth = smooth


def create_angular_ellipsoid(name, radius_xyz, center, mat, segs=12, rings=8, rot_deg=(0.0, 0.0, 0.0)):
    """Create a smooth sculpted eye, pupil, or nostril ellipsoid."""
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
    apply_shading(obj, smooth=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_boar_body_loft(name, sections, mat):
    """Build sculpted wedge boar body (high broad shoulders, tucked waist, smoothed contours)."""
    segs = 16
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for y, z_bot, z_top, rx in sections:
        zc = (z_bot + z_top) * 0.5
        rz = (z_top - z_bot) * 0.5
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ca, sa = math.cos(ang), math.sin(ang)
            # Keep natural shoulder broadness above midline and clean tucked underbelly taper
            w_mod = 1.04 if sa > 0.15 else (0.88 if sa < -0.25 else 1.0)
            vx = ca * rx * w_mod
            vz = zc + sa * rz * (0.94 if sa < 0.0 else 1.0)
            ring.append(bm.verts.new((vx, y, vz)))
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
    apply_shading(obj, smooth=True, subsurf=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_dorsal_mohawk(name, mat):
    """Build one continuous, thin sculpted spine mohawk ridge strictly along x=0."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    # (y, z_root, z_crest, half_w_root, half_w_crest)
    profile = (
        (-0.46, 0.50, 0.53, 0.014, 0.004),
        (-0.38, 0.57, 0.65, 0.020, 0.007),
        (-0.28, 0.63, 0.74, 0.022, 0.008),
        (-0.18, 0.67, 0.79, 0.022, 0.008),
        (-0.06, 0.64, 0.75, 0.020, 0.008),
        (0.08, 0.59, 0.68, 0.018, 0.007),
        (0.22, 0.54, 0.62, 0.016, 0.006),
        (0.34, 0.50, 0.55, 0.012, 0.004),
    )
    sections = []
    for y, zb, zt, wr, wc in profile:
        zm = (zb + zt) * 0.5
        sections.append([
            bm.verts.new((0.0, y, zb)),
            bm.verts.new((wr, y, zm)),
            bm.verts.new((wc, y, zt)),
            bm.verts.new((-wc, y, zt)),
            bm.verts.new((-wr, y, zm)),
        ])

    n_pts = 5
    for i in range(len(sections) - 1):
        r0, r1 = sections[i], sections[i + 1]
        for j in range(n_pts):
            nj = (j + 1) % n_pts
            bm.faces.new((r0[j], r0[nj], r1[nj], r1[j]))
    bm.faces.new(list(reversed(sections[0])))
    bm.faces.new(sections[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.data.materials.append(mat)
    apply_shading(obj, smooth=True, subsurf=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_boar_head_loft(name, sections, mats):
    """Build smooth-beveled wedge boar skull + sloped snout ending in flat rosy nose disc."""
    segs = 14
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for y, z_bot, z_top, rx in sections:
        zc = (z_bot + z_top) * 0.5
        rz = (z_top - z_bot) * 0.5
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ca, sa = math.cos(ang), math.sin(ang)
            vx = ca * rx * (1.03 if -0.35 < sa < 0.35 else 0.94)
            vz = zc + sa * rz
            ring.append(bm.verts.new((vx, y, vz)))
        rings.append(ring)

    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        mat_idx = 1 if r_i >= len(rings) - 2 else 0
        for s in range(segs):
            ns = (s + 1) % segs
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s])).material_index = mat_idx

    bm.faces.new(list(reversed(rings[0]))).material_index = 0
    bm.faces.new(rings[-1]).material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    for m in mats:
        obj.data.materials.append(m)
    apply_shading(obj, smooth=True, subsurf=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_boar_leg_loft(name, rings_spec, mats):
    """Build sculpted articulated boar leg tapering cleanly into dark cloven hoof."""
    segs = 12
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for cx, cy, z, rx, ry in rings_spec:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ring.append(bm.verts.new((cx + math.cos(ang) * rx, cy + math.sin(ang) * ry, z)))
        rings.append(ring)

    for r_i in range(len(rings) - 1):
        r0, r1 = rings[r_i], rings[r_i + 1]
        mat_idx = 1 if r_i >= len(rings) - 3 else 0
        for s in range(segs):
            ns = (s + 1) % segs
            bm.faces.new((r0[s], r0[ns], r1[ns], r1[s])).material_index = mat_idx

    bm.faces.new(list(reversed(rings[0]))).material_index = 0
    bm.faces.new(rings[-1]).material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    for m in mats:
        obj.data.materials.append(m)
    apply_shading(obj, smooth=True, subsurf=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_curved_tusk_loft(name, side_sign, mat):
    """Build smooth C-curved crescent boar tusk arcing outward, forward, and upward."""
    segs = 10
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    arc = (
        (side_sign * 0.105, -0.545, 0.345, 0.040),
        (side_sign * 0.165, -0.600, 0.352, 0.036),
        (side_sign * 0.212, -0.640, 0.380, 0.030),
        (side_sign * 0.236, -0.648, 0.435, 0.024),
        (side_sign * 0.232, -0.630, 0.498, 0.017),
        (side_sign * 0.210, -0.598, 0.556, 0.011),
        (side_sign * 0.184, -0.562, 0.598, 0.004),
    )
    rings = []
    for idx, (cx, cy, cz, r) in enumerate(arc):
        p_prev = Vector(arc[max(0, idx - 1)][:3])
        p_next = Vector(arc[min(len(arc) - 1, idx + 1)][:3])
        rot_q = (p_next - p_prev).normalized().to_track_quat("Z", "Y")
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            local = Vector((math.cos(ang) * r, math.sin(ang) * r, 0.0))
            ring.append(bm.verts.new(Vector((cx, cy, cz)) + (rot_q @ local)))
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
    apply_shading(obj, smooth=True, subsurf=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def bind_boar_body_weights(obj, arm_obj):
    """Weight continuous boar body and mohawk across Pelvis, Spine, Neck, and Head."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vgs = {n: obj.vertex_groups.new(name=n) for n in ("Pelvis", "Spine", "Neck", "Head")}
    for v in obj.data.vertices:
        y = v.co.y
        w_pel = max(0.0, min(1.0, (y - 0.02) / 0.24))
        w_nck = max(0.0, min(1.0, (-0.24 - y) / 0.18)) * (1.0 - w_pel)
        w_hd = max(0.0, min(0.32, (-0.40 - y) / 0.16))
        w_nck = max(0.0, w_nck - w_hd)
        w_spn = max(0.0, 1.0 - w_pel - w_nck - w_hd)
        for key, val in (("Pelvis", w_pel), ("Spine", w_spn), ("Neck", w_nck), ("Head", w_hd)):
            if val > 0.0:
                vgs[key].add([v.index], val, "REPLACE")


def bind_boar_leg_weights(obj, arm_obj, parent_bone, upper_bone, lower_bone):
    """Weight articulated boar leg smoothly from torso socket through knee/hock down to hoof."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vg_p = obj.vertex_groups.new(name=parent_bone)
    vg_u = obj.vertex_groups.new(name=upper_bone)
    vg_l = obj.vertex_groups.new(name=lower_bone)
    for v in obj.data.vertices:
        z = v.co.z
        w_p = max(0.0, min(0.45, (z - 0.40) / 0.34))
        w_l = max(0.0, min(1.0, (0.27 - z) / 0.12))
        w_u = max(0.0, 1.0 - w_p - w_l)
        if w_p > 0.0:
            vg_p.add([v.index], w_p, "REPLACE")
        if w_u > 0.0:
            vg_u.add([v.index], w_u, "REPLACE")
        if w_l > 0.0:
            vg_l.add([v.index], w_l, "REPLACE")


def create_wedge_detail(name, size_xyz, center, mat, rot_deg=(0.0, 0.0, 0.0), taper_top=1.0, bevel=0.006):
    """Create beveled sculpted detail slab for brow armor, snout ridges, inner ears, tufts, or fetlocks."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size_xyz
    for v in bm.verts:
        tf = taper_top if v.co.z > 0.0 else 1.0
        v.co.x *= sx * tf
        v.co.y *= sy * (0.7 + 0.3 * tf)
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
    apply_shading(obj, smooth=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_taper_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, segs=10):
    """Create smooth tapered ear blade or tail segment between two points."""
    h, t = Vector(head_pt), Vector(tail_pt)
    span = t - h
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_head, radius2=r_tail, depth=span.length)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = (h + t) * 0.5
    obj.rotation_euler = span.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    apply_shading(obj, smooth=True)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_quadruped_armature(root):
    """Build reusable Rig_Quadruped skeleton oriented facing -Y."""
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

    pelvis = add_bone("Pelvis", (0.0, 0.30, 0.44), (0.0, 0.04, 0.46))
    spine = add_bone("Spine", (0.0, 0.04, 0.46), (0.0, -0.28, 0.49), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.28, 0.49), (0.0, -0.44, 0.45), spine, connect=True)
    head = add_bone("Head", (0.0, -0.44, 0.45), (0.0, -0.70, 0.37), neck, connect=True)
    add_bone("Tail", (0.0, 0.42, 0.48), (0.0, 0.62, 0.39), pelvis)
    add_bone("Ear_L", (-0.13, -0.44, 0.56), (-0.23, -0.40, 0.70), head)
    add_bone("Ear_R", (0.13, -0.44, 0.56), (0.23, -0.40, 0.70), head)

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        fu = add_bone(f"FrontUpper_{side}", (sign * 0.17, -0.24, 0.45), (sign * 0.17, -0.24, 0.22), spine)
        add_bone(f"FrontLower_{side}", (sign * 0.17, -0.24, 0.22), (sign * 0.17, -0.25, 0.02), fu, connect=True)
        bu = add_bone(f"BackUpper_{side}", (sign * 0.155, 0.27, 0.44), (sign * 0.155, 0.29, 0.22), pelvis)
        add_bone(f"BackLower_{side}", (sign * 0.155, 0.29, 0.22), (sign * 0.155, 0.27, 0.02), bu, connect=True)

    bpy.ops.object.mode_set(mode="OBJECT")

    for sname, bone_name, lpos in (
        ("Socket_Head", "Head", (0.0, 0.0, 0.12)),
        ("Socket_Back", "Spine", (0.0, 0.12, 0.18)),
        ("Socket_Mouth", "Head", (0.0, 0.0, 0.0)),
    ):
        sock = bpy.data.objects.new(sname, None)
        sock.empty_display_type = "SPHERE"
        sock.empty_display_size = 0.04
        sock.parent = arm_obj
        sock.parent_type = "BONE"
        sock.parent_bone = bone_name
        sock.location = Vector(lpos)
        bpy.context.scene.collection.objects.link(sock)
    return arm_obj


def parent_to_bone(obj, arm_obj, bone_name):
    """Bind rigid mesh part cleanly to a bone preserving world transform."""
    world_m = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world_m


def build_boar_materials():
    """Create chestnut coat, hide shade accent, dark bristle mane, rosy snout, tusk, hoof, and eyes."""
    return {
        "fur": make_toon_material("Mat_BoarFur", "#47292a", "#7d4a34", "#b0744d", t_mid=0.22, t_hi=0.68),
        "shade": make_toon_material("Mat_BoarFurShade", "#331b1d", "#5e3426", "#8c563c", t_mid=0.25, t_hi=0.70),
        "mane": make_toon_material("Mat_BoarMane", "#261822", "#452b2a", "#69453c", t_mid=0.32, t_hi=0.75),
        "snout": make_toon_material("Mat_BoarSnout", "#8c4c4f", "#c97b74", "#eba79b", t_mid=0.28, t_hi=0.72),
        "tusk": make_toon_material("Mat_BoarTusk", "#b8a47c", "#ede0bd", "#fff9e3", t_mid=0.26, t_hi=0.68),
        "hoof": make_toon_material("Mat_BoarHoof", "#221722", "#3b2c35", "#56434d", t_mid=0.35, t_hi=0.76),
        "eye": make_toon_material("Mat_BoarEye", "#cbb15b", "#f7e58b", "#fffad4", t_mid=0.22, t_hi=0.68),
        "pupil": make_toon_material("Mat_BoarPupil", "#1d1426", "#251a30", "#392948", t_mid=0.50, t_hi=0.90),
    }


def add_boar_legs_and_head_details(arm_obj, mats, meshes, parts):
    """Assemble sculpted hocked legs, fetlock tufts, jowl bristles, curved tusks, and head details."""
    for sign, side in ((-1.0, "L"), (1.0, "R")):
        front_rings = (
            (sign * 0.14, -0.24, 0.56, 0.125, 0.145),
            (sign * 0.17, -0.24, 0.39, 0.095, 0.105),
            (sign * 0.175, -0.245, 0.23, 0.072, 0.080),
            (sign * 0.175, -0.25, 0.10, 0.056, 0.064),
            (sign * 0.175, -0.258, 0.04, 0.062, 0.074),
            (sign * 0.175, -0.265, 0.00, 0.048, 0.058),
        )
        back_rings = (
            (sign * 0.12, 0.27, 0.52, 0.115, 0.135),
            (sign * 0.155, 0.28, 0.38, 0.092, 0.105),
            (sign * 0.16, 0.335, 0.23, 0.066, 0.078),
            (sign * 0.16, 0.275, 0.09, 0.052, 0.060),
            (sign * 0.16, 0.268, 0.04, 0.058, 0.070),
            (sign * 0.16, 0.262, 0.00, 0.046, 0.056),
        )
        f_leg = create_boar_leg_loft(f"Boar_FrontLeg_{side}", front_rings, [mats["fur"], mats["hoof"]])
        bind_boar_leg_weights(f_leg, arm_obj, "Spine", f"FrontUpper_{side}", f"FrontLower_{side}")
        b_leg = create_boar_leg_loft(f"Boar_BackLeg_{side}", back_rings, [mats["fur"], mats["hoof"]])
        bind_boar_leg_weights(b_leg, arm_obj, "Pelvis", f"BackUpper_{side}", f"BackLower_{side}")
        meshes += [f_leg, b_leg]

        fet_f = create_wedge_detail(f"Boar_FetlockF_{side}", (0.040, 0.052, 0.044), (sign * 0.175, -0.21, 0.115), mats["mane"], rot_deg=(28.0, 0.0, 0.0), taper_top=0.45)
        fet_b = create_wedge_detail(f"Boar_FetlockB_{side}", (0.038, 0.052, 0.044), (sign * 0.16, 0.318, 0.11), mats["mane"], rot_deg=(28.0, 0.0, 0.0), taper_top=0.45)
        nostril = create_angular_ellipsoid(f"Boar_Nostril_{side}", (0.018, 0.015, 0.022), (sign * 0.036, -0.742, 0.392), mats["hoof"], segs=8, rings=5)
        eye_w = create_angular_ellipsoid(f"Boar_Eye_{side}", (0.032, 0.036, 0.038), (sign * 0.135, -0.578, 0.498), mats["eye"], segs=10, rings=6)
        eye_p = create_angular_ellipsoid(f"Boar_Pupil_{side}", (0.018, 0.020, 0.024), (sign * 0.148, -0.600, 0.498), mats["pupil"], segs=8, rings=5)
        brow = create_wedge_detail(f"Boar_Brow_{side}", (0.080, 0.050, 0.024), (sign * 0.125, -0.570, 0.542), mats["mane"], rot_deg=(12.0, -sign * 18.0, sign * 12.0), taper_top=0.75)
        cheek_tuft = create_wedge_detail(f"Boar_JowlTuft_{side}", (0.055, 0.080, 0.046), (sign * 0.185, -0.51, 0.36), mats["mane"], rot_deg=(-12.0, sign * 24.0, sign * 18.0), taper_top=0.40)
        tusk = create_curved_tusk_loft(f"Boar_Tusk_{side}", sign, mats["tusk"])
        ear = create_taper_capsule(f"Boar_Ear_{side}", (sign * 0.135, -0.44, 0.56), (sign * 0.23, -0.40, 0.70), 0.056, 0.012, mats["mane"])
        ear_in = create_wedge_detail(f"Boar_EarIn_{side}", (0.032, 0.018, 0.055), (sign * 0.165, -0.445, 0.60), mats["snout"], rot_deg=(-14.0, sign * 30.0, 0.0), taper_top=0.40, bevel=0.004)
        parts += [
            (fet_f, f"FrontLower_{side}"), (fet_b, f"BackLower_{side}"),
            (nostril, "Head"), (eye_w, "Head"), (eye_p, "Head"),
            (brow, "Head"), (cheek_tuft, "Head"), (tusk, "Head"),
            (ear, f"Ear_{side}"), (ear_in, f"Ear_{side}"),
        ]


def build_boar_meshes(arm_obj):
    """Assemble sculpted wedge Wild Boar with continuous thin mohawk, curved tusks, and details."""
    mats = build_boar_materials()

    # Smooth-subdivided muscular wedge body (high chest & shoulder taper, tucked lean waist)
    body_sections = (
        (0.50, 0.36, 0.49, 0.08),
        (0.40, 0.32, 0.56, 0.18),
        (0.24, 0.33, 0.58, 0.205),
        (0.04, 0.26, 0.65, 0.26),
        (-0.18, 0.21, 0.74, 0.30),
        (-0.34, 0.23, 0.70, 0.27),
        (-0.46, 0.29, 0.60, 0.20),
        (-0.54, 0.33, 0.55, 0.13),
    )
    body = create_boar_body_loft("Boar_Body", body_sections, mats["fur"])
    mohawk = create_dorsal_mohawk("Boar_DorsalMohawk", mats["mane"])
    bind_boar_body_weights(body, arm_obj)
    bind_boar_body_weights(mohawk, arm_obj)

    head_sections = (
        (-0.44, 0.32, 0.57, 0.17),
        (-0.52, 0.28, 0.63, 0.22),
        (-0.60, 0.30, 0.53, 0.155),
        (-0.68, 0.32, 0.455, 0.105),
        (-0.735, 0.33, 0.45, 0.090),
    )
    head_mesh = create_boar_head_loft("Boar_Head", head_sections, [mats["fur"], mats["snout"]])

    meshes = [body, mohawk]
    parts = [(head_mesh, "Head")]

    # Subtle snout bridge folds & kinked bristle tail
    snout_ridge1 = create_wedge_detail("Boar_SnoutRidge1", (0.11, 0.026, 0.020), (0.0, -0.615, 0.505), mats["shade"], rot_deg=(-28.0, 0.0, 0.0), taper_top=0.70, bevel=0.005)
    snout_ridge2 = create_wedge_detail("Boar_SnoutRidge2", (0.090, 0.022, 0.018), (0.0, -0.665, 0.470), mats["shade"], rot_deg=(-22.0, 0.0, 0.0), taper_top=0.70, bevel=0.005)
    tail_stem = create_taper_capsule("Boar_TailStem", (0.0, 0.44, 0.47), (0.0, 0.55, 0.49), 0.026, 0.018, mats["fur"])
    tail_tip = create_taper_capsule("Boar_TailKink", (0.0, 0.55, 0.49), (0.0, 0.63, 0.40), 0.018, 0.012, mats["fur"])
    tail_tuft = create_wedge_detail("Boar_TailTuft", (0.042, 0.068, 0.048), (0.0, 0.65, 0.38), mats["mane"], rot_deg=(-35.0, 0.0, 0.0), taper_top=0.35, bevel=0.005)
    parts += [
        (snout_ridge1, "Head"), (snout_ridge2, "Head"),
        (tail_stem, "Tail"), (tail_tip, "Tail"), (tail_tuft, "Tail"),
    ]

    add_boar_legs_and_head_details(arm_obj, mats, meshes, parts)

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return meshes + [p[0] for p in parts]


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


def build_boar_scene(save_blend_path=None):
    """Build complete 80x80 base (120px @ 48 px/m) sculpted Wild Boar Blender scene."""
    studio = setup_pixel_studio(cell_px=80, px_per_meter=32, pitch_deg=38.0, target_z=0.44)
    studio["scene"]["sprite_ground_y"] = 64
    arm_obj = build_quadruped_armature(studio["root"])
    meshes = build_boar_meshes(arm_obj)
    actions = apply_quadruped_actions("Boar", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
