import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/discover-identity.blend")
OUT_GLB = os.path.abspath("assets/models/discover-identity.glb")


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


def add_beveled_box(name, size, location, bevel_width=0.04, segments=4, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel_width > 0.0:
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
    if parent:
        obj.parent = parent
    return obj


def add_cylinder_x(name, radius, length, location, segments=32, bevel_end=0.012, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=length,
    )
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=2, affect="EDGES", clamp_overlap=True)
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


def add_cylinder_z(name, radius, height, location, segments=24, bevel_end=0.006, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius,
        radius2=radius,
        depth=height,
    )
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=2, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_stadium_x(name, length_x, width_y, height_z, location, end_bevel=0.015, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    arc_seg = 12

    def make_ring(x_val, w, h):
        r = max(0.002, h * 0.5)
        flat_half = max(0.001, w * 0.5 - r)
        pts = []
        for i in range(arc_seg + 1):
            ang = -math.pi * 0.5 + math.pi * (i / arc_seg)
            pts.append((x_val, flat_half + math.cos(ang) * r, math.sin(ang) * r))
        for i in range(arc_seg + 1):
            ang = math.pi * 0.5 + math.pi * (i / arc_seg)
            pts.append((x_val, -flat_half + math.cos(ang) * r, math.sin(ang) * r))
        return [bm.verts.new(p) for p in pts]

    b = min(end_bevel, length_x * 0.28, height_z * 0.25)
    x0 = -length_x * 0.5
    x1 = length_x * 0.5
    rings = [
        make_ring(x0, width_y - 2.0 * b, height_z - 2.0 * b),
        make_ring(x0 + b, width_y, height_z),
        make_ring(x1 - b, width_y, height_z),
        make_ring(x1, width_y - 2.0 * b, height_z - 2.0 * b),
    ]
    n = len(rings[0])
    for r_idx in range(len(rings) - 1):
        ra = rings[r_idx]
        rb = rings[r_idx + 1]
        for i in range(n):
            ni = (i + 1) % n
            bm.faces.new((ra[i], rb[i], rb[ni], ra[ni]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_uv_plane(name, width, depth, location, mat, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    hw = width * 0.5
    hd = depth * 0.5
    v0 = bm.verts.new((-hw, -hd, 0.0))
    v1 = bm.verts.new((hw, -hd, 0.0))
    v2 = bm.verts.new((hw, hd, 0.0))
    v3 = bm.verts.new((-hw, hd, 0.0))
    face = bm.faces.new((v0, v1, v2, v3))
    uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def build():
    clear_scene()

    mat_term = make_material("TerminalMatteAlu", (0.12, 0.125, 0.132), metallic=0.55, roughness=0.44)
    mat_plug_dark = make_material("PlugMatteBlack", (0.042, 0.044, 0.048), metallic=0.16, roughness=0.62)
    mat_ferrule = make_material("FerruleSilverAlu", (0.70, 0.72, 0.74), metallic=0.88, roughness=0.30)
    mat_steel = make_material("USBC_Steel", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_cable = make_material("CableTPE", (0.036, 0.038, 0.042), metallic=0.0, roughness=0.66)
    mat_seam = make_material("DarkSeam", (0.015, 0.016, 0.018), metallic=0.05, roughness=0.86)
    mat_led_vconn = make_material("LedVconn", (0.95, 0.62, 0.12), metallic=0.0, roughness=0.20)
    mat_screen_0 = make_material("NodeScreen0", (0.02, 0.02, 0.02), metallic=0.0, roughness=0.30)
    mat_screen_1 = make_material("NodeScreen1", (0.02, 0.02, 0.02), metallic=0.0, roughness=0.30)
    mat_screen_2 = make_material("NodeScreen2", (0.02, 0.02, 0.02), metallic=0.0, roughness=0.30)
    mat_term_label = make_material("TerminalLabel", (0.08, 0.08, 0.08), metallic=0.0, roughness=0.50)

    z_mid = 0.26

    # 1. Fixed VCONN Bench Terminal on the far left (-X)
    term_x = -2.85
    add_beveled_box("VconnTerminalBody", (1.28, 1.56, 0.56), (term_x, 0.0, 0.28), bevel_width=0.05, segments=4, mat=mat_term)
    # Recessed USB-C receptacle port on +X face of terminal
    add_stadium_x("VconnPortBezel", 0.06, 0.52, 0.20, (term_x + 0.63, 0.0, z_mid), end_bevel=0.01, mat=mat_steel)
    add_stadium_x("VconnPortCavity", 0.05, 0.45, 0.14, (term_x + 0.65, 0.0, z_mid), end_bevel=0.005, mat=mat_seam)
    # Amber VCONN power indicator LED jewel on top of terminal
    add_cylinder_z("VconnLedRing", 0.075, 0.03, (term_x + 0.28, 0.44, 0.565), segments=24, bevel_end=0.006, mat=mat_steel)
    add_cylinder_z("VconnLed", 0.055, 0.036, (term_x + 0.28, 0.44, 0.574), segments=24, bevel_end=0.01, mat=mat_led_vconn)
    # Subtle terminal etched top label
    add_uv_plane("VconnLabel", 1.04, 1.24, (term_x - 0.04, 0.0, 0.564), mat_term_label)

    # 2. Interactive Cable Assembly (translates along +X when unseated)
    cable_root = bpy.data.objects.new("CableAssembly", None)
    cable_root.location = Vector((0.0, 0.0, 0.0))
    bpy.context.collection.objects.link(cable_root)

    # Male stainless USB-C plug nose that seats into the VCONN terminal
    add_stadium_x("NearPlugSteel", 0.44, 0.44, 0.15, (-2.04, 0.0, z_mid), end_bevel=0.015, mat=mat_steel, parent=cable_root)

    # Node 0: Near Plug (SOP · M)
    n0_x = -1.26
    add_stadium_x("NearPlugBody", 1.40, 1.04, 0.44, (n0_x, 0.0, z_mid), end_bevel=.075, mat=mat_plug_dark, parent=cable_root)
    add_beveled_box("NearPlugBezel", (1.22, 0.84, 0.03), (n0_x, 0.0, z_mid + 0.215), bevel_width=0.01, segments=2, mat=mat_seam, parent=cable_root)
    add_uv_plane("NodeScreen0", 1.16, 0.78, (n0_x, 0.0, z_mid + 0.233), mat_screen_0, parent=cable_root)

    # Cable span 1 between Near Plug & Mid E-Marker Ferrule
    add_cylinder_x("CableSpan1", 0.115, 0.64, (-0.28, 0.0, z_mid), segments=28, bevel_end=0.008, mat=mat_cable, parent=cable_root)
    # Strain relief collars
    add_cylinder_x("Strain0R", 0.165, 0.12, (-0.54, 0.0, z_mid), segments=28, bevel_end=0.015, mat=mat_seam, parent=cable_root)
    add_cylinder_x("Strain1L", 0.165, 0.12, (0.00, 0.0, z_mid), segments=28, bevel_end=0.015, mat=mat_seam, parent=cable_root)

    # Node 1: Mid-Cable Machined Aluminum E-Marker Ferrule (SOP' · C)
    n1_x = 0.72
    add_stadium_x("FerruleBody", 1.40, 1.04, 0.46, (n1_x, 0.0, z_mid), end_bevel=.075, mat=mat_ferrule, parent=cable_root)
    add_beveled_box("FerruleBezel", (1.22, 0.84, 0.03), (n1_x, 0.0, z_mid + 0.225), bevel_width=0.01, segments=2, mat=mat_seam, parent=cable_root)
    add_uv_plane("NodeScreen1", 1.16, 0.78, (n1_x, 0.0, z_mid + 0.243), mat_screen_1, parent=cable_root)

    # Cable span 2 between Mid Ferrule & Far Plug
    add_cylinder_x("CableSpan2", 0.115, 0.64, (1.70, 0.0, z_mid), segments=28, bevel_end=0.008, mat=mat_cable, parent=cable_root)
    add_cylinder_x("Strain1R", 0.165, 0.12, (1.44, 0.0, z_mid), segments=28, bevel_end=0.015, mat=mat_seam, parent=cable_root)
    add_cylinder_x("Strain2L", 0.165, 0.12, (1.98, 0.0, z_mid), segments=28, bevel_end=0.015, mat=mat_seam, parent=cable_root)

    # Flexible molded collars taper into each cable span.
    for i, (origin, direction) in enumerate([(-.57, 1), (.03, -1), (1.41, 1), (2.01, -1)]):
        for step in range(3):
            add_cylinder_x(f"Relief{i}_{step}", .16-.012*step, .052,
                           (origin + direction * (.10+.063*step), 0, z_mid),
                           segments=32, bevel_end=.012, mat=mat_plug_dark, parent=cable_root)

    # Node 2: Far Plug (SOP'' · P)
    n2_x = 2.70
    add_stadium_x("FarPlugBody", 1.40, 1.04, 0.44, (n2_x, 0.0, z_mid), end_bevel=.075, mat=mat_plug_dark, parent=cable_root)
    add_beveled_box("FarPlugBezel", (1.22, 0.84, 0.03), (n2_x, 0.0, z_mid + 0.215), bevel_width=0.01, segments=2, mat=mat_seam, parent=cable_root)
    add_uv_plane("NodeScreen2", 1.16, 0.78, (n2_x, 0.0, z_mid + 0.233), mat_screen_2, parent=cable_root)

    # Stainless male tongue exiting the far plug (+X)
    add_stadium_x("FarPlugSteel", 0.44, 0.44, 0.15, (3.56, 0.0, z_mid), end_bevel=0.015, mat=mat_steel, parent=cable_root)

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
