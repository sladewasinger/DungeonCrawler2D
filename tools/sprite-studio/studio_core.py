"""Reusable Blender orthographic pixel-art studio, toon shaders, and turntable exporter."""

import math
import os
import bpy
from mathutils import Euler, Vector


def set_enum_safely(obj, attr, preferred_values):
    """Assign an enum property using dynamic TypeError discovery if static RNA under-reports."""
    for val in preferred_values:
        try:
            setattr(obj, attr, val)
            return val
        except TypeError as exc:
            msg = str(exc)
            for cand in preferred_values:
                if f"'{cand}'" in msg:
                    setattr(obj, attr, cand)
                    return cand
    return getattr(obj, attr)


def resolve_enum_choice(rna_prop, candidates):
    """Pick the first valid enum identifier from Blender RNA metadata."""
    valid = [item.identifier for item in rna_prop.enum_items]
    for cand in candidates:
        if cand in valid:
            return cand
    return valid[0] if valid else candidates[0]


def set_eevee_engine(scene):
    """Select the active Blender EEVEE render engine safely across 4.x and 5.x."""
    return set_enum_safely(scene.render, "engine", ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"))


def srgb_channel_to_linear(c):
    """Convert one sRGB 0..1 component to scene-referred linear."""
    if c <= 0.04045:
        return c / 12.92
    return ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str):
    """Convert #RRGGBB hex string into a Blender linear RGBA 4-tuple."""
    clean = hex_str.lstrip("#")
    r = srgb_channel_to_linear(int(clean[0:2], 16) / 255.0)
    g = srgb_channel_to_linear(int(clean[2:4], 16) / 255.0)
    b = srgb_channel_to_linear(int(clean[4:6], 16) / 255.0)
    return (r, g, b, 1.0)


def clear_scene():
    """Remove all objects and orphan data blocks for a clean deterministic build."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.actions,
    ):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def configure_color_and_render(scene, cell_px):
    """Configure crisp nearest-edge orthographic transparent rendering."""
    set_eevee_engine(scene)
    r = scene.render
    r.resolution_x = cell_px
    r.resolution_y = cell_px
    r.resolution_percentage = 100
    r.film_transparent = True
    r.filter_size = 0.01

    img_props = r.image_settings
    img_props.file_format = resolve_enum_choice(
        bpy.types.ImageFormatSettings.bl_rna.properties["file_format"], ["PNG"]
    )
    img_props.color_mode = resolve_enum_choice(
        bpy.types.ImageFormatSettings.bl_rna.properties["color_mode"], ["RGBA", "RGB"]
    )

    if hasattr(scene, "eevee"):
        for attr, val in (("taa_render_samples", 1), ("taa_samples", 1), ("use_taa_reprojection", False)):
            if hasattr(scene.eevee, attr):
                setattr(scene.eevee, attr, val)

    vs = scene.view_settings
    set_enum_safely(vs, "view_transform", ("Standard",))
    set_enum_safely(vs, "look", ("None",))
    vs.exposure = 0.0
    vs.gamma = 1.0


def setup_world_black(scene):
    """Zero out ambient world bounce so cel ramps stay crisp and pure."""
    if not scene.world:
        scene.world = bpy.data.worlds.new("StudioWorld")
    world = scene.world
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (0.0, 0.0, 0.0, 1.0)
        bg.inputs[1].default_value = 0.0


def look_at(obj, target_vec):
    """Aim an object's -Z axis at target with +Z world up."""
    direction = Vector(target_vec) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_pixel_studio(cell_px=64, px_per_meter=32, pitch_deg=38.0, target_z=0.50):
    """Reset the scene and build locked orthographic cam, key sun, and CharacterRoot."""
    clear_scene()
    scene = bpy.context.scene
    configure_color_and_render(scene, cell_px)
    setup_world_black(scene)

    cam_data = bpy.data.cameras.new("StudioCam")
    cam_data.type = resolve_enum_choice(
        bpy.types.Camera.bl_rna.properties["type"], ["ORTHO"]
    )
    cam_data.ortho_scale = cell_px / float(px_per_meter)
    cam_data.clip_start = 0.1
    cam_data.clip_end = 50.0
    cam_obj = bpy.data.objects.new("StudioCam", cam_data)
    scene.collection.objects.link(cam_obj)

    pitch_rad = math.radians(pitch_deg)
    dist = 10.0
    cam_obj.location = (0.0, -dist * math.cos(pitch_rad), target_z + dist * math.sin(pitch_rad))
    look_at(cam_obj, (0.0, 0.0, target_z))
    scene.camera = cam_obj

    sun_data = bpy.data.lights.new(
        "StudioSun",
        type=resolve_enum_choice(bpy.types.Light.bl_rna.properties["type"], ["SUN"]),
    )
    sun_data.energy = 2.6
    sun_data.use_shadow = False
    sun_obj = bpy.data.objects.new("StudioSun", sun_data)
    scene.collection.objects.link(sun_obj)
    # Upper-left-front RPG lighting matching top-down pixel conventions
    sun_obj.location = (-3.5, -4.5, 6.0)
    look_at(sun_obj, (0.0, 0.0, target_z))

    root = bpy.data.objects.new("CharacterRoot", None)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.35
    scene.collection.objects.link(root)

    make_depth_override_material(near_dist=dist - 1.4, far_dist=dist + 1.4)
    return {"scene": scene, "camera": cam_obj, "sun": sun_obj, "root": root}


def make_toon_material(name, shadow_hex, base_hex, highlight_hex, t_mid=0.30, t_hi=0.72):
    """Create a crisp 3-band flat Cainos toon shader using node types cleanly."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    ramp = nodes.new("ShaderNodeValToRGB")
    bw = nodes.new("ShaderNodeRGBToBW")
    s2rgb = nodes.new("ShaderNodeShaderToRGB")
    diff = nodes.new("ShaderNodeBsdfDiffuse")

    diff.inputs["Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    diff.inputs["Roughness"].default_value = 1.0

    cr = ramp.color_ramp
    cr.interpolation = resolve_enum_choice(
        bpy.types.ColorRamp.bl_rna.properties["interpolation"], ["CONSTANT"]
    )
    cr.elements[0].position = 0.0
    cr.elements[0].color = hex_to_linear_rgba(shadow_hex)
    cr.elements[1].position = t_mid
    cr.elements[1].color = hex_to_linear_rgba(base_hex)
    hi_stop = cr.elements.new(t_hi)
    hi_stop.color = hex_to_linear_rgba(highlight_hex)

    emit.inputs["Strength"].default_value = 1.0

    links.new(diff.outputs["BSDF"], s2rgb.inputs["Shader"])
    links.new(s2rgb.outputs["Color"], bw.inputs["Color"])
    links.new(bw.outputs["Val"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def make_depth_override_material(near_dist=8.6, far_dist=11.4):
    """Create a linear normalized camera-depth emission material for crease detection."""
    mat = bpy.data.materials.get("StudioDepthMat")
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(name="StudioDepthMat")
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    cam_data = nodes.new("ShaderNodeCameraData")
    map_range = nodes.new("ShaderNodeMapRange")
    emit = nodes.new("ShaderNodeEmission")
    out = nodes.new("ShaderNodeOutputMaterial")

    map_range.clamp = True
    map_range.inputs["From Min"].default_value = near_dist
    map_range.inputs["From Max"].default_value = far_dist
    map_range.inputs["To Min"].default_value = 0.0
    map_range.inputs["To Max"].default_value = 1.0

    links.new(cam_data.outputs["View Z Depth"], map_range.inputs["Value"])
    links.new(map_range.outputs["Result"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def render_turntable_clip(out_dir, clip_name, frames, directions=(("south", 0.0), ("side", 90.0), ("north", 180.0))):
    """Render RGBA color and linear depth frames across directions by rotating CharacterRoot."""
    os.makedirs(out_dir, exist_ok=True)
    scene = bpy.context.scene
    root = bpy.data.objects["CharacterRoot"]
    depth_mat = bpy.data.materials["StudioDepthMat"]
    view_layer = scene.view_layers[0]
    rendered = []

    try:
        for dir_name, yaw_deg in directions:
            root.rotation_euler = Euler((0.0, 0.0, math.radians(yaw_deg)), "XYZ")
            for idx, frame in enumerate(frames, start=1):
                scene.frame_set(frame)
                color_path = os.path.join(out_dir, f"{dir_name}_{clip_name}_f{idx}.png")
                depth_path = os.path.join(out_dir, f"{dir_name}_{clip_name}_f{idx}_depth.png")

                view_layer.material_override = None
                scene.render.filepath = color_path
                bpy.ops.render.render(write_still=True)

                view_layer.material_override = depth_mat
                scene.render.filepath = depth_path
                bpy.ops.render.render(write_still=True)

                rendered.append({"dir": dir_name, "frame": idx, "color": color_path, "depth": depth_path})
    finally:
        view_layer.material_override = None
        root.rotation_euler = Euler((0.0, 0.0, 0.0), "XYZ")
    return rendered
