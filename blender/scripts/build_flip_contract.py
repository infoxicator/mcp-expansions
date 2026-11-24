import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/flip-contract.blend")
OUT_GLB = os.path.abspath("assets/models/flip-contract.glb")


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


def add_stadium_x(name, length_x, width_y, height_z, location, end_bevel=0.015, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    arc_seg = 14

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


def add_cylinder_z(name, radius, height, location, segments=24, bevel_end=0.005, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=height)
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


def add_cylinder_x(name, radius, length, location, segments=28, bevel_end=0.008, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=length)
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
    for loop, uv in zip(face.loops, [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]):
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

    mat_block = make_material("BlockMatteBlack", (0.042, 0.044, 0.048), metallic=0.16, roughness=0.68)
    mat_seam = make_material("BlockSeam", (0.014, 0.015, 0.017), metallic=0.05, roughness=0.88)
    mat_steel = make_material("USBC_Steel", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_alu_plate = make_material("LegendPlateMat", (0.80, 0.81, 0.82), metallic=0.72, roughness=0.34)
    mat_plug_alu = make_material("PlugPaleAlu", (0.76, 0.77, 0.78), metallic=0.84, roughness=0.28)
    mat_plug_strain = make_material("PlugPaleStrain", (0.72, 0.71, 0.69), metallic=0.0, roughness=0.62)
    mat_dot_a = make_material("SideADotBrass", (0.82, 0.64, 0.28), metallic=0.90, roughness=0.24)
    mat_stripe_b = make_material("SideBStripeDark", (0.08, 0.085, 0.095), metallic=0.2, roughness=0.50)
    mat_led1 = make_material("LedCC1", (0.95, 0.68, 0.18), metallic=0.0, roughness=0.22)
    mat_led2 = make_material("LedCC2", (0.35, 0.72, 0.95), metallic=0.0, roughness=0.22)

    z_mid = 0.36
    block_x = -0.82

    # 1. Machined Matte-Black Desktop USB-C Receptacle Block
    add_beveled_box("BlockLower", (3.24, 2.48, 0.34), (block_x, 0.0, 0.18), bevel_width=0.045, segments=4, mat=mat_block)
    add_beveled_box("BlockSeam", (3.20, 2.44, 0.05), (block_x, 0.0, 0.36), bevel_width=0.01, segments=2, mat=mat_seam)
    add_beveled_box("BlockUpper", (3.22, 2.46, 0.36), (block_x, 0.0, 0.56), bevel_width=0.055, segments=5, mat=mat_block)

    # Recessed brushed-aluminum I/O legend strip seated cleanly on top of the block
    add_beveled_box("LegendBezel", (2.86, 2.10, 0.03), (block_x, 0.0, 0.735), bevel_width=0.012, segments=2, mat=mat_seam)
    add_uv_plane("LegendPlate", 2.78, 2.02, (block_x, 0.0, 0.754), mat_alu_plate)

    # CC1 / CC2 jewel LED indicators along right edge of the top face
    add_cylinder_z("LedCC1Bezel", 0.068, 0.025, (block_x + 1.24, 0.68, 0.742), mat=mat_steel)
    add_cylinder_z("LedCC1", 0.048, 0.032, (block_x + 1.24, 0.68, 0.750), mat=mat_led1)
    add_cylinder_z("LedCC2Bezel", 0.068, 0.025, (block_x + 1.24, -0.68, 0.742), mat=mat_steel)
    add_cylinder_z("LedCC2", 0.048, 0.032, (block_x + 1.24, -0.68, 0.750), mat=mat_led2)

    # Stainless USB-C female receptacle port on +X wall of block
    port_x = block_x + 1.61
    add_stadium_x("PortRim", 0.06, 0.62, 0.24, (port_x, 0.0, z_mid), end_bevel=0.012, mat=mat_steel)
    add_stadium_x("PortCavity", 0.05, 0.54, 0.17, (port_x + 0.02, 0.0, z_mid), end_bevel=0.005, mat=mat_seam)

    # 2. Reversible Pale-Anodized USB-C Plug (pivots around its axial X centerline for 180° flip!)
    plug_root = bpy.data.objects.new("FlipPlugRoot", None)
    plug_root.location = Vector((port_x + 0.02, 0.0, z_mid))
    bpy.context.collection.objects.link(plug_root)

    # Stainless steel male shell entering receptacle (-X local)
    add_stadium_x("PlugSteelShell", 0.56, 0.50, 0.165, (-0.24, 0.0, 0.0), end_bevel=0.018, mat=mat_steel, parent=plug_root)
    add_stadium_x("PlugCollar", 0.08, 0.58, 0.24, (0.04, 0.0, 0.0), end_bevel=0.012, mat=mat_plug_strain, parent=plug_root)

    # Pale brushed-aluminum plug overmold body (+X local)
    add_stadium_x("PlugBody", 1.18, 0.72, 0.36, (0.66, 0.0, 0.0), end_bevel=0.042, mat=mat_plug_alu, parent=plug_root)

    # Distinct visual orientation markers so the 180° flip is physically unmistakable:
    # Side A (+Z top): inlaid brass tactile orientation dot
    add_cylinder_z("PlugSideADot", 0.085, 0.025, (0.58, 0.0, 0.180), mat=mat_dot_a, parent=plug_root)
    # Side B (-Z underside): machined dark charcoal recessed bar
    add_beveled_box("PlugSideBStripe", (0.58, 0.14, 0.024), (0.62, 0.0, -0.180), bevel_width=0.008, segments=2, mat=mat_stripe_b, parent=plug_root)

    # Strain relief ribs & smooth cable exiting rightward (+X)
    for idx in range(4):
        t = idx / 3.0
        add_stadium_x(
            f"PlugRib_{idx}",
            0.09,
            0.54 - t * 0.16,
            0.30 - t * 0.08,
            (1.30 + idx * 0.11, 0.0, 0.0),
            end_bevel=0.014,
            mat=mat_plug_strain,
            parent=plug_root,
        )
    add_cylinder_x("PlugCableTail", 0.115, 4.4, (3.80, 0.0, 0.0), segments=28, mat=mat_plug_strain, parent=plug_root)

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
