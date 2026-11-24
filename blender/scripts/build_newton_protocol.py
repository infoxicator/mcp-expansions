import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/newton-protocol.blend")
OUT_GLB = os.path.abspath("assets/models/newton-protocol.glb")


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name, base_color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return mat


def set_smooth(obj):
    if obj.type != "MESH":
        return
    for poly in obj.data.polygons:
        poly.use_smooth = True


def add_beveled_box(name, size, location, bevel_width=0.02, segments=4, mat=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=bevel_width,
        segments=segments,
        affect="EDGES",
        clamp_overlap=True,
    )
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_cylinder(name, radius, depth, location, vertices=36, bevel=0.0, mat=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=vertices,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    if bevel > 0.0:
        cap_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        bmesh.ops.bevel(
            bm,
            geom=cap_edges,
            offset=bevel,
            segments=3,
            affect="EDGES",
            clamp_overlap=True,
        )
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    return obj


def add_arch_tube(name, y_pos, half_span, z_bottom, z_top, bend_r, tube_r, mat=None):
    """Build a crisp inverted-U tubular arch in the X-Z plane at y=y_pos."""
    pts = []
    # Left upright up to bend start
    pts.append(Vector((-half_span, y_pos, z_bottom)))
    # Left 90-deg corner arc
    cx_l = -half_span + bend_r
    cz = z_top - bend_r
    arc_steps = 16
    for i in range(arc_steps + 1):
        ang = math.pi - (math.pi / 2.0) * (i / arc_steps)
        pts.append(Vector((cx_l + math.cos(ang) * bend_r, y_pos, cz + math.sin(ang) * bend_r)))
    # Right 90-deg corner arc
    cx_r = half_span - bend_r
    for i in range(arc_steps + 1):
        ang = (math.pi / 2.0) - (math.pi / 2.0) * (i / arc_steps)
        pts.append(Vector((cx_r + math.cos(ang) * bend_r, y_pos, cz + math.sin(ang) * bend_r)))
    # Right upright down to base
    pts.append(Vector((half_span, y_pos, z_bottom)))

    curve_data = bpy.data.curves.new(name + "_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = tube_r
    curve_data.bevel_resolution = 8
    curve_data.use_fill_caps = True

    spline = curve_data.splines.new("POLY")
    spline.points.add(len(pts) - 1)
    for idx, p in enumerate(pts):
        spline.points[idx].co = (p.x, p.y, p.z, 1.0)

    curve_obj = bpy.data.objects.new(name, curve_data)
    bpy.context.collection.objects.link(curve_obj)

    bpy.context.view_layer.objects.active = curve_obj
    curve_obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    mesh_obj = bpy.context.active_object
    mesh_obj.name = name
    set_smooth(mesh_obj)
    if mat:
        mesh_obj.data.materials.append(mat)
    mesh_obj.select_set(False)
    return mesh_obj


def add_chrome_ball_with_bail(name, x_pos, z_center, radius, mat_chrome, mat_bail):
    """Create a high-res chrome sphere with planar front-facing UVs + machined top bail."""
    parent = bpy.data.objects.new(name, None)
    parent.location = Vector((x_pos, 0.0, z_center))
    bpy.context.collection.objects.link(parent)

    # Sphere mesh
    mesh = bpy.data.meshes.new(name + "_SphereMesh")
    sphere_obj = bpy.data.objects.new(name + "_Sphere", mesh)
    bpy.context.collection.objects.link(sphere_obj)

    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=48, radius=radius)
    uv_layer = bm.loops.layers.uv.verify()

    # Custom spherical front-centered UV projection so the engraved letter on -Y (front in Blender -> +Z in glTF) is undistorted!
    for face in bm.faces:
        for loop in face.loops:
            v = loop.vert.co.normalized()
            # Front is -Y in Blender; right is +X; up is +Z
            lon = math.atan2(v.x, -v.y)  # [-pi, pi], 0 at front (-Y)
            lat = math.asin(max(-1.0, min(1.0, v.z)))  # [-pi/2, pi/2]
            u = 0.5 + lon / (2.0 * math.pi)
            w = 0.5 + lat / math.pi
            loop[uv_layer].uv = (u, w)

    bm.to_mesh(mesh)
    bm.free()
    set_smooth(sphere_obj)
    sphere_obj.data.materials.append(mat_chrome)
    sphere_obj.parent = parent

    # Machined top collar + bail pin
    collar = add_cylinder(
        name + "_Collar",
        radius=0.055,
        depth=0.04,
        location=(0.0, 0.0, radius - 0.005),
        vertices=24,
        bevel=0.008,
        mat=mat_bail,
    )
    collar.parent = parent

    # Micro suspension eyelet ring on top of collar
    mesh_ring = bpy.data.meshes.new(name + "_RingMesh")
    ring_obj = bpy.data.objects.new(name + "_Ring", mesh_ring)
    bpy.context.collection.objects.link(ring_obj)
    bm = bmesh.new()
    major_r = 0.032
    minor_r = 0.011
    seg_maj = 20
    seg_min = 10
    verts_grid = []
    for i in range(seg_maj):
        theta = (2.0 * math.pi * i) / seg_maj
        ring_v = []
        for j in range(seg_min):
            phi = (2.0 * math.pi * j) / seg_min
            # Torus lying in X-Z plane (hole along Y so V-threads pass cleanly)
            r = major_r + minor_r * math.cos(phi)
            x = r * math.cos(theta)
            z = r * math.sin(theta)
            y = minor_r * math.sin(phi)
            ring_v.append(bm.verts.new((x, y, z)))
        verts_grid.append(ring_v)
    for i in range(seg_maj):
        ni = (i + 1) % seg_maj
        for j in range(seg_min):
            nj = (j + 1) % seg_min
            bm.faces.new((verts_grid[i][j], verts_grid[ni][j], verts_grid[ni][nj], verts_grid[i][nj]))
    bm.to_mesh(mesh_ring)
    bm.free()
    set_smooth(ring_obj)
    ring_obj.location = Vector((0.0, 0.0, radius + 0.036))
    ring_obj.data.materials.append(mat_bail)
    ring_obj.parent = parent

    return parent


def build():
    clear_scene()

    mat_matte_black = make_material("MatteAnodizedBlack", (0.042, 0.042, 0.044), metallic=0.18, roughness=0.44)
    mat_frame_tube = make_material("FrameMatteBlack", (0.035, 0.035, 0.037), metallic=0.35, roughness=0.36)
    mat_inset = make_material("BaseGraphiteInset", (0.062, 0.062, 0.066), metallic=0.32, roughness=0.52)
    mat_collar = make_material("GunmetalCollar", (0.09, 0.092, 0.098), metallic=0.82, roughness=0.28)
    mat_rubber = make_material("RubberFoot", (0.025, 0.025, 0.026), metallic=0.0, roughness=0.85)
    mat_chrome_m = make_material("ChromeBall_M", (0.95, 0.96, 0.97), metallic=1.0, roughness=0.04)
    mat_chrome_c = make_material("ChromeBall_C", (0.95, 0.96, 0.97), metallic=1.0, roughness=0.04)
    mat_chrome_p = make_material("ChromeBall_P", (0.95, 0.96, 0.97), metallic=1.0, roughness=0.04)
    mat_bail = make_material("ChromeBail", (0.82, 0.84, 0.86), metallic=0.98, roughness=0.14)

    # 1. Plinth base + inset + 4 feet
    add_beveled_box("BasePlinth", (3.76, 1.72, 0.24), (0.0, 0.0, 0.14), bevel_width=0.024, segments=4, mat=mat_matte_black)
    add_beveled_box("BaseInset", (3.46, 1.42, 0.024), (0.0, 0.0, 0.258), bevel_width=0.008, segments=2, mat=mat_inset)

    for idx, (fx, fy) in enumerate([(-1.62, -0.64), (1.62, -0.64), (-1.62, 0.64), (1.62, 0.64)]):
        add_cylinder(f"Foot_{idx}", radius=0.11, depth=0.024, location=(fx, fy, 0.012), vertices=24, bevel=0.005, mat=mat_rubber)

    # 2. Front and back matte-black inverted-U tubular arches
    arch_y = 0.58
    arch_half_span = 1.54
    arch_z_top = 2.94
    add_arch_tube("ArchFront", -arch_y, arch_half_span, 0.25, arch_z_top, bend_r=0.22, tube_r=0.046, mat=mat_frame_tube)
    add_arch_tube("ArchBack", arch_y, arch_half_span, 0.25, arch_z_top, bend_r=0.22, tube_r=0.046, mat=mat_frame_tube)

    # Subtle lower cross-tie struts connecting front & back legs just above base
    for side, sx in [("Left", -arch_half_span), ("Right", arch_half_span)]:
        strut = add_cylinder(f"TieStrut_{side}", radius=0.026, depth=arch_y * 2.0, location=(sx, 0.0, 0.42), vertices=20, mat=mat_frame_tube)
        strut.rotation_euler = (math.pi / 2.0, 0.0, 0.0)

    # Machined base collars where arches enter plinth
    for idx, (cx, cy) in enumerate([
        (-arch_half_span, -arch_y),
        (arch_half_span, -arch_y),
        (-arch_half_span, arch_y),
        (arch_half_span, arch_y),
    ]):
        add_cylinder(f"Collar_{idx}", radius=0.088, depth=0.07, location=(cx, cy, 0.285), vertices=32, bevel=0.012, mat=mat_collar)

    # 3. Six machined suspension anchor ferrules on the top bars for M, C, P
    ball_radius = 0.415
    spacing = ball_radius * 2.0  # 0.830 exact kissing tangent
    ball_xs = [-spacing, 0.0, spacing]
    for b_idx, bx in enumerate(ball_xs):
        for s_idx, sy in enumerate([-arch_y, arch_y]):
            ferrule = add_cylinder(
                f"Anchor_{b_idx}_{s_idx}",
                radius=0.058,
                depth=0.065,
                location=(bx, sy, arch_z_top),
                vertices=24,
                bevel=0.008,
                mat=mat_collar,
            )
            ferrule.rotation_euler = (0.0, math.pi / 2.0, 0.0)

    # 4. Three chrome spheres (M, C, P) hanging at rest
    ball_z = 1.06
    add_chrome_ball_with_bail("Ball_M", ball_xs[0], ball_z, ball_radius, mat_chrome_m, mat_bail)
    add_chrome_ball_with_bail("Ball_C", ball_xs[1], ball_z, ball_radius, mat_chrome_c, mat_bail)
    add_chrome_ball_with_bail("Ball_P", ball_xs[2], ball_z, ball_radius, mat_chrome_p, mat_bail)

    # Save .blend source
    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    # Export Draco-compressed GLB
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    print(f"Saved {OUT_BLEND} and {OUT_GLB}")


if __name__ == "__main__":
    build()
