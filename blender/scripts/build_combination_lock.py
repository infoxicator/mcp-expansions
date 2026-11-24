import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/combination-lock.blend")
OUT_GLB = os.path.abspath("assets/models/combination-lock.glb")


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


def add_cylinder_x(name, radius, length, location, segments=48, bevel_end=0.018, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=length)
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=3, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    obj.rotation_euler = (0.0, math.pi * 0.5, 0.0)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_uv_tumbler_ring(name, radius, width, location, mat_drum, mat_brass, parent=None):
    """Build a coaxial combination tumbler ring with clean cylindrical UVs (v=0.5 on +Z crown, u=0..1 left..right)."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(location)
    bpy.context.collection.objects.link(root)
    if parent:
        root.parent = parent

    mesh = bpy.data.meshes.new(f"{name}_Drum")
    obj = bpy.data.objects.new(f"{name}_Drum", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    segs_v = 56
    hx = width * 0.5
    chamfer = 0.032

    # 4 axial rings with clean end chamfers; central band carries crisp 0..1 u
    x_profile = [
        (-hx, radius - chamfer * 0.85, 0.0),
        (-hx + chamfer, radius, 0.04),
        (hx - chamfer, radius, 0.96),
        (hx, radius - chamfer * 0.85, 1.0),
    ]

    grid = []
    for x_pos, r_val, u_val in x_profile:
        row = []
        for iv in range(segs_v + 1):
            v = iv / segs_v
            phi = (v - 0.5) * math.pi * 2.0
            y = math.sin(phi) * r_val
            z = math.cos(phi) * r_val
            vert = bm.verts.new((x_pos, y, z))
            row.append((vert, u_val, v))
        grid.append(row)

    for ix in range(len(x_profile) - 1):
        for iv in range(segs_v):
            v00, u00, w00 = grid[ix][iv]
            v10, u10, w10 = grid[ix + 1][iv]
            v11, u11, w11 = grid[ix + 1][iv + 1]
            v01, u01, w01 = grid[ix][iv + 1]
            face = bm.faces.new((v00, v10, v11, v01))
            for loop, uv in zip(face.loops, [(u00, w00), (u10, w10), (u11, w11), (u01, w01)]):
                loop[uv_layer].uv = uv

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
    obj.data.materials.append(mat_drum)

    # Knurled brass grip flutes flanking the left/right edges of each tumbler ring
    for side in (-1.0, 1.0):
        add_cylinder_x(
            f"{name}_BrassRim_{'L' if side < 0 else 'R'}",
            radius=radius + 0.014,
            length=0.052,
            location=(side * (hx - 0.04), 0.0, 0.0),
            segments=48,
            bevel_end=0.008,
            mat=mat_brass,
            parent=root,
        )

    return root


def add_u_shackle(name, mat_chrome, parent=None):
    """Build a solid hardened chrome U-shackle extending leftward (-X) in the XY horizontal plane."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    tube_r = 0.14
    arc_r = 0.50
    # Centerline path: long anchored upper leg -> semicircular bend on -X -> shorter latch lower leg
    pts = []
    # Upper leg (anchored inside collar even when popped open) from x=0.62 to x=-0.76 at y=+arc_r
    for i in range(10):
        t = i / 9.0
        pts.append((0.62 - t * 1.38, arc_r, 0.0))
    # Semicircle centered at (-0.76, 0)
    arc_steps = 24
    for i in range(1, arc_steps):
        ang = math.pi * 0.5 + math.pi * (i / arc_steps)
        pts.append((-0.76 + math.cos(ang) * arc_r, math.sin(ang) * arc_r, 0.0))
    # Shorter lower latch leg from x=-0.76 to x=0.14 at y=-arc_r (pops cleanly free when unlocked)
    for i in range(8):
        t = i / 7.0
        pts.append((-0.76 + t * 0.90, -arc_r, 0.0))

    v_segs = 20
    rings = []
    for idx, p in enumerate(pts):
        p_vec = Vector(p)
        if idx == 0:
            tan = (Vector(pts[1]) - p_vec).normalized()
        elif idx == len(pts) - 1:
            tan = (p_vec - Vector(pts[-2])).normalized()
        else:
            tan = (Vector(pts[idx + 1]) - Vector(pts[idx - 1])).normalized()
        up = Vector((0.0, 0.0, 1.0))
        side = tan.cross(up).normalized()
        ring = []
        for iv in range(v_segs):
            ang = (2.0 * math.pi * iv) / v_segs
            off = side * (math.cos(ang) * tube_r) + up * (math.sin(ang) * tube_r)
            ring.append(bm.verts.new(p_vec + off))
        rings.append(ring)

    for ri in range(len(rings) - 1):
        ra = rings[ri]
        rb = rings[ri + 1]
        for iv in range(v_segs):
            niv = (iv + 1) % v_segs
            bm.faces.new((ra[iv], rb[iv], rb[niv], ra[niv]))

    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
    obj.data.materials.append(mat_chrome)
    if parent:
        obj.parent = parent
    return obj


def add_beveled_box(name, size, location, bevel_width=0.02, segments=2, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel_width > 0.0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel_width, segments=segments, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def build():
    clear_scene()

    mat_steel = make_material("LockBrushedSteel", (0.76, 0.78, 0.80), metallic=0.94, roughness=0.26)
    mat_chrome = make_material("LockChromeShackle", (0.86, 0.88, 0.90), metallic=0.98, roughness=0.14)
    mat_brass = make_material("LockBrassTrim", (0.78, 0.62, 0.30), metallic=0.92, roughness=0.25)
    mat_endcap = make_material("LockAnodizedCap", (0.048, 0.050, 0.056), metallic=0.24, roughness=0.62)

    z_axis = 0.88
    ring_r = 0.84

    # Central solid brass core axle visible subtly when shackle opens
    add_cylinder_x("LockCoreAxle", 0.56, 3.80, (0.45, 0.0, z_axis), segments=36, bevel_end=0.015, mat=mat_brass)

    # Left machined steel shackle collar housing
    add_cylinder_x("LeftCollar", ring_r + 0.02, 0.62, (-1.42, 0.0, z_axis), segments=48, bevel_end=0.04, mat=mat_endcap)
    add_cylinder_x("LeftCollarTrim", ring_r + 0.035, 0.08, (-1.12, 0.0, z_axis), segments=48, bevel_end=0.012, mat=mat_steel)

    # Right machined end-cap housing
    add_cylinder_x("RightCap", ring_r + 0.02, 0.66, (2.34, 0.0, z_axis), segments=48, bevel_end=0.045, mat=mat_endcap)
    add_cylinder_x("RightCapTrim", ring_r + 0.035, 0.08, (2.02, 0.0, z_axis), segments=48, bevel_end=0.012, mat=mat_steel)

    # Brass alignment sight bars mounted along top crown of LeftCollar & RightCap pointing toward the 3 rings
    add_beveled_box("IndexMarkerL", (0.26, 0.07, 0.06), (-1.22, 0.0, z_axis + ring_r + 0.03), bevel_width=0.01, segments=2, mat=mat_brass)
    add_beveled_box("IndexMarkerR", (0.26, 0.07, 0.06), (2.14, 0.0, z_axis + ring_r + 0.03), bevel_width=0.01, segments=2, mat=mat_brass)

    # Three chunky coaxial word-combination tumbler rings (M, C, P)
    ring_xs = (-0.54, 0.46, 1.46)
    for idx, rx in enumerate(ring_xs):
        mat_drum = make_material(f"TumblerDrum{idx}", (0.08, 0.085, 0.092), metallic=0.35, roughness=0.45)
        add_uv_tumbler_ring(
            f"TumblerRing{idx}",
            radius=ring_r,
            width=0.94,
            location=(rx, 0.0, z_axis),
            mat_drum=mat_drum,
            mat_brass=mat_brass,
        )

    # Sliding hardened chrome U-shackle assembly (translates along -X when unlocked!)
    shackle_root = bpy.data.objects.new("ShackleRoot", None)
    shackle_root.location = Vector((-1.72, 0.0, z_axis))
    bpy.context.collection.objects.link(shackle_root)
    add_u_shackle("ChromeShackle", mat_chrome, parent=shackle_root)

    os.makedirs(os.path.dirname(OUT_BLEND), exist_ok=True)
    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

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
