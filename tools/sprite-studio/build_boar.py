"""Builds the reusable Rig_Quadruped Wild Boar model with all 5 Cainos animation clips."""

import math
import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

from quadruped_actions import apply_quadruped_actions
from studio_core import make_toon_material, setup_pixel_studio


def apply_smooth_mesh(obj):
    """Enable smooth shading across polygons for clean cel-shaded silhouette."""
    for poly in obj.data.polygons:
        poly.use_smooth = True


def create_ellipsoid(name, radius_xyz, center, mat, segs=18, rings=12):
    """Create a smooth rounded ellipsoid volume."""
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


def build_lofted_tube(name, sections, mat, segs=18):
    """Create a smooth continuous lofted body mesh from [(y, z_center, rx, rz), ...] rings."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for y, zc, rx, rz in sections:
        ring = []
        for s in range(segs):
            ang = (2.0 * math.pi * s) / float(segs)
            ring.append(bm.verts.new((math.cos(ang) * rx, y, zc + math.sin(ang) * rz)))
        rings.append(ring)
    for r_idx in range(len(rings) - 1):
        r0, r1 = rings[r_idx], rings[r_idx + 1]
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
    """Weight a continuous trunk mesh cleanly across Pelvis, Spine, and Neck by Y coordinate."""
    obj.parent = arm_obj
    obj.parent_type = "OBJECT"
    mod = obj.modifiers.new(name="Armature", type="ARMATURE")
    mod.object = arm_obj
    vg_pel = obj.vertex_groups.new(name="Pelvis")
    vg_spn = obj.vertex_groups.new(name="Spine")
    vg_nck = obj.vertex_groups.new(name="Neck")
    for v in obj.data.vertices:
        y = v.co.y
        w_pel = max(0.0, min(1.0, (y - 0.02) / 0.24))
        w_nck = max(0.0, min(1.0, (-0.22 - y) / 0.20))
        w_spn = max(0.0, 1.0 - w_pel - w_nck)
        if w_pel > 0.0:
            vg_pel.add([v.index], w_pel, "REPLACE")
        if w_spn > 0.0:
            vg_spn.add([v.index], w_spn, "REPLACE")
        if w_nck > 0.0:
            vg_nck.add([v.index], w_nck, "REPLACE")


def create_bone_capsule(name, head_pt, tail_pt, r_head, r_tail, mat, extend=0.03):
    """Create an overlapping rounded frustum aligned along a bone segment."""
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


def create_curved_tusk(name, side_sign, mat):
    """Create a bold curved ivory boar tusk sweeping outward and upward."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=10,
        radius1=0.044,
        radius2=0.008,
        depth=0.23,
    )
    for v in bm.verts:
        t = max(0.0, min(1.0, (v.co.z + 0.115) / 0.23))
        v.co.x += side_sign * (t ** 1.7) * 0.05
        v.co.y -= (t ** 1.4) * 0.06
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = Vector((side_sign * 0.125, -0.585, 0.385))
    obj.rotation_euler = Euler(
        (math.radians(-22.0), side_sign * math.radians(32.0), side_sign * math.radians(-16.0)),
        "XYZ",
    )
    obj.data.materials.append(mat)
    mod = obj.modifiers.new(name="TuskSmooth", type="SUBSURF")
    mod.levels = 1
    mod.render_levels = 1
    apply_smooth_mesh(obj)
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
        b.head = Vector(head)
        b.tail = Vector(tail)
        if parent:
            b.parent = parent
            b.use_connect = connect
        return b

    pelvis = add_bone("Pelvis", (0.0, 0.30, 0.44), (0.0, 0.04, 0.46))
    spine = add_bone("Spine", (0.0, 0.04, 0.46), (0.0, -0.28, 0.49), pelvis, connect=True)
    neck = add_bone("Neck", (0.0, -0.28, 0.49), (0.0, -0.44, 0.45), spine, connect=True)
    head = add_bone("Head", (0.0, -0.44, 0.45), (0.0, -0.70, 0.37), neck, connect=True)
    add_bone("Tail", (0.0, 0.42, 0.48), (0.0, 0.62, 0.39), pelvis)
    add_bone("Ear_L", (-0.13, -0.42, 0.57), (-0.23, -0.37, 0.72), head)
    add_bone("Ear_R", (0.13, -0.42, 0.57), (0.23, -0.37, 0.72), head)

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
    """Bind rigid mesh part to a bone cleanly keeping world transform."""
    world_m = obj.matrix_world.copy()
    obj.parent = arm_obj
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    bpy.context.view_layer.update()
    obj.matrix_world = world_m


def build_boar_meshes(arm_obj):
    """Assemble heavy-shouldered Cainos Wild Boar parts on Rig_Quadruped."""
    fur = make_toon_material("Mat_BoarFur", "#47292a", "#7d4a34", "#b0744d", t_mid=0.22, t_hi=0.68)
    mane = make_toon_material("Mat_BoarMane", "#261822", "#452b2a", "#69453c", t_mid=0.32, t_hi=0.75)
    snout_mat = make_toon_material("Mat_BoarSnout", "#8c4c4f", "#c97b74", "#eba79b", t_mid=0.28, t_hi=0.72)
    tusk_mat = make_toon_material("Mat_BoarTusk", "#b8a47c", "#ede0bd", "#fff9e3", t_mid=0.26, t_hi=0.68)
    hoof_mat = make_toon_material("Mat_BoarHoof", "#221722", "#3b2c35", "#56434d", t_mid=0.35, t_hi=0.76)
    eye_mat = make_toon_material("Mat_BoarEye", "#cbb15b", "#f7e58b", "#fffad4", t_mid=0.22, t_hi=0.68)
    pupil_mat = make_toon_material("Mat_BoarPupil", "#1d1426", "#251a30", "#392948", t_mid=0.50, t_hi=0.90)

    parts = []

    # Single continuous muscular boar trunk + bristle ridge (zero flank cel-band seams!)
    trunk = build_lofted_tube(
        "Boar_Trunk",
        (
            (0.49, 0.45, 0.08, 0.08),
            (0.40, 0.44, 0.20, 0.19),
            (0.24, 0.44, 0.25, 0.235),
            (0.04, 0.46, 0.275, 0.255),
            (-0.18, 0.485, 0.30, 0.285),
            (-0.36, 0.465, 0.24, 0.23),
            (-0.46, 0.45, 0.16, 0.16),
        ),
        fur,
        segs=18,
    )
    mane_crest = build_lofted_tube(
        "Boar_ManeCrest",
        (
            (0.38, 0.57, 0.03, 0.04),
            (0.24, 0.65, 0.062, 0.075),
            (0.04, 0.70, 0.078, 0.095),
            (-0.18, 0.745, 0.088, 0.115),
            (-0.36, 0.68, 0.076, 0.095),
            (-0.46, 0.62, 0.055, 0.065),
        ),
        mane,
        segs=12,
    )
    bind_trunk_armature(trunk, arm_obj)
    bind_trunk_armature(mane_crest, arm_obj)
    smooth_parts = [trunk, mane_crest]

    # Broad hunched skull + angled snout cone + flat rosy nose disc + dark nostrils
    head = create_ellipsoid("Boar_Head", (0.225, 0.215, 0.205), (0.0, -0.45, 0.47), fur)
    muzzle = create_bone_capsule("Boar_Muzzle", (0.0, -0.52, 0.44), (0.0, -0.68, 0.39), 0.135, 0.095, fur, extend=0.015)
    snout_disc = create_ellipsoid("Boar_SnoutDisc", (0.092, 0.042, 0.078), (0.0, -0.695, 0.395), snout_mat, segs=14, rings=10)
    parts += [(head, "Head"), (muzzle, "Head"), (snout_disc, "Head")]

    # Curly tail
    tail_stem = create_bone_capsule("Boar_Tail", (0.0, 0.44, 0.49), (0.0, 0.60, 0.41), 0.036, 0.022, fur, extend=0.01)
    tail_tuft = create_ellipsoid("Boar_TailTuft", (0.045, 0.045, 0.052), (0.0, 0.61, 0.395), mane, segs=12, rings=8)
    parts += [(tail_stem, "Tail"), (tail_tuft, "Tail")]

    for sign, side in ((-1.0, "L"), (1.0, "R")):
        # Nostrils, fierce furrowed brows, glowing amber eyes, ivory tusks & perky ears
        nostril = create_ellipsoid(f"Boar_Nostril_{side}", (0.022, 0.018, 0.026), (sign * 0.036, -0.732, 0.395), hoof_mat, segs=10, rings=8)
        eye_w = create_ellipsoid(f"Boar_Eye_{side}", (0.038, 0.044, 0.046), (sign * 0.135, -0.565, 0.515), eye_mat, segs=12, rings=8)
        eye_p = create_ellipsoid(f"Boar_Pupil_{side}", (0.022, 0.026, 0.030), (sign * 0.148, -0.590, 0.514), pupil_mat, segs=10, rings=8)
        brow = create_ellipsoid(f"Boar_Brow_{side}", (0.056, 0.048, 0.026), (sign * 0.125, -0.555, 0.562), mane, segs=10, rings=8)
        brow.rotation_euler = Euler((math.radians(14.0), sign * math.radians(-18.0), sign * math.radians(12.0)), "XYZ")

        tusk = create_curved_tusk(f"Boar_Tusk_{side}", sign, tusk_mat)
        ear = create_bone_capsule(
            f"Boar_Ear_{side}",
            (sign * 0.135, -0.42, 0.57),
            (sign * 0.23, -0.37, 0.72),
            0.068,
            0.012,
            mane,
            extend=0.015,
        )
        parts += [
            (nostril, "Head"), (eye_w, "Head"), (eye_p, "Head"), (brow, "Head"),
            (tusk, "Head"), (ear, f"Ear_{side}"),
        ]

        # Sturdy overlapping quadruped legs & hooves resting at z = 0.0
        fu = create_bone_capsule(f"Boar_FrontUp_{side}", (sign * 0.17, -0.24, 0.45), (sign * 0.17, -0.24, 0.22), 0.088, 0.068, fur, extend=0.035)
        fl = create_bone_capsule(f"Boar_FrontLo_{side}", (sign * 0.17, -0.24, 0.22), (sign * 0.17, -0.25, 0.05), 0.064, 0.054, fur, extend=0.025)
        f_hoof = create_ellipsoid(f"Boar_FrontHoof_{side}", (0.060, 0.068, 0.042), (sign * 0.17, -0.26, 0.042), hoof_mat, segs=12, rings=8)

        bu = create_bone_capsule(f"Boar_BackUp_{side}", (sign * 0.155, 0.27, 0.44), (sign * 0.155, 0.29, 0.22), 0.090, 0.068, fur, extend=0.035)
        bl = create_bone_capsule(f"Boar_BackLo_{side}", (sign * 0.155, 0.29, 0.22), (sign * 0.155, 0.27, 0.05), 0.062, 0.052, fur, extend=0.025)
        b_hoof = create_ellipsoid(f"Boar_BackHoof_{side}", (0.058, 0.066, 0.042), (sign * 0.155, 0.26, 0.042), hoof_mat, segs=12, rings=8)

        parts += [
            (fu, f"FrontUpper_{side}"), (fl, f"FrontLower_{side}"), (f_hoof, f"FrontLower_{side}"),
            (bu, f"BackUpper_{side}"), (bl, f"BackLower_{side}"), (b_hoof, f"BackLower_{side}"),
        ]

    bpy.context.view_layer.update()
    for obj, bone_name in parts:
        parent_to_bone(obj, arm_obj, bone_name)
    return smooth_parts + [p[0] for p in parts]


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
    """Build complete 80x80 Blender pixel studio scene with Wild Boar + Rig_Quadruped + 5 clips."""
    studio = setup_pixel_studio(cell_px=80, px_per_meter=32, pitch_deg=38.0, target_z=0.44)
    studio["scene"]["sprite_ground_y"] = 64
    arm_obj = build_quadruped_armature(studio["root"])
    meshes = build_boar_meshes(arm_obj)
    actions = apply_quadruped_actions("Boar", arm_obj.name)
    bounds = compute_combined_bounds(meshes)
    if save_blend_path:
        bpy.ops.wm.save_as_mainfile(filepath=save_blend_path)
    return {"bounds": bounds, "mesh_count": len(meshes), "armature": arm_obj.name, "actions": actions}
