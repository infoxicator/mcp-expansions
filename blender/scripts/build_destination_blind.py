import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/destination-blind.blend")
OUT_GLB = os.path.abspath("assets/models/destination-blind.glb")


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


def add_beveled_box(name, size, location, bevel_width=0.03, segments=3, mat=None, parent=None, rot_euler=(0, 0, 0)):
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
    obj.rotation_euler = rot_euler
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_cylinder_x(name, radius, length, location, segments=24, mat=None, parent=None):
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


def add_cylinder_y(name, radius, length, location, segments=20, bevel_end=0.004, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius, radius2=radius, depth=length)
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=2, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    obj.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_front_uv_plane(name, width, height, location, mat, parent=None):
    """Vertical plane facing -Y in Blender (+Z in Three.js) with v=1 at top (+Z) and v=0 at bottom (-Z)."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    hw = width * 0.5
    hh = height * 0.5
    v0 = bm.verts.new((-hw, 0.0, -hh))
    v1 = bm.verts.new((hw, 0.0, -hh))
    v2 = bm.verts.new((hw, 0.0, hh))
    v3 = bm.verts.new((-hw, 0.0, hh))
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

    mat_steel_case = make_material("SolariFoldedSteel", (0.044, 0.046, 0.050), metallic=0.22, roughness=0.66)
    mat_cavity = make_material("SolariCavity", (0.012, 0.013, 0.015), metallic=0.04, roughness=0.90)
    mat_chrome = make_material("SolariChrome", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_brass = make_material("SolariBrass", (0.78, 0.64, 0.34), metallic=0.90, roughness=0.28)
    mat_bezel_decal = make_material("SolariBezelDecal", (0.08, 0.08, 0.08), metallic=0.0, roughness=0.5)

    # Outer folded-steel Solari housing resting on desktop plinth feet
    case_w = 4.66
    case_h = 3.36
    case_d = 1.04
    base_z = 0.14

    # Heavy low-profile folded steel stand/plinth
    add_beveled_box("StandFootL", (0.44, 1.12, 0.14), (-1.75, 0.0, 0.07), bevel_width=0.025, segments=3, mat=mat_steel_case)
    add_beveled_box("StandFootR", (0.44, 1.12, 0.14), (1.75, 0.0, 0.07), bevel_width=0.025, segments=3, mat=mat_steel_case)

    # Main back enclosure box
    add_beveled_box("CaseBack", (case_w, case_d - 0.14, case_h), (0.0, 0.07, base_z + case_h * 0.5), bevel_width=0.045, segments=4, mat=mat_steel_case)

    # Front folded perimeter bezel framing the 3 split-flap bays (leaves deep cavity open at front -Y)
    front_y = -case_d * 0.5 + 0.06
    bezel_d = 0.22
    # Top header bezel rail
    add_beveled_box("BezelTop", (case_w, bezel_d, 0.42), (0.0, front_y, base_z + case_h - 0.21), bevel_width=0.024, segments=3, mat=mat_steel_case)
    # Bottom bezel rail
    add_beveled_box("BezelBot", (case_w, bezel_d, 0.24), (0.0, front_y, base_z + 0.12), bevel_width=0.024, segments=3, mat=mat_steel_case)
    # Left channel index bezel rail (wider to hold M / C / P labels cleanly)
    add_beveled_box("BezelLeft", (0.58, bezel_d, case_h), (-case_w * 0.5 + 0.29, front_y, base_z + case_h * 0.5), bevel_width=0.024, segments=3, mat=mat_steel_case)
    # Right bezel rail
    add_beveled_box("BezelRight", (0.28, bezel_d, case_h), (case_w * 0.5 - 0.14, front_y, base_z + case_h * 0.5), bevel_width=0.024, segments=3, mat=mat_steel_case)

    # Recessed dark backplate behind the flaps
    add_beveled_box("CavityBack", (3.86, 0.06, 2.74), (0.15, -0.22, base_z + 1.60), bevel_width=0.005, segments=1, mat=mat_cavity)

    # Two horizontal structural mullions separating the 3 split-flap rows
    row_zs = (base_z + 2.46, base_z + 1.56, base_z + 0.66)
    for div_z in (base_z + 2.01, base_z + 1.11):
        add_beveled_box(f"Mullion_{div_z:.2f}", (3.92, 0.18, 0.095), (0.15, front_y + 0.02, div_z), bevel_width=0.012, segments=2, mat=mat_steel_case)

    # Visible chrome hinge axles & side pins for each of the 3 split-flap drums
    for idx, rz in enumerate(row_zs):
        add_cylinder_x(f"FlapAxle_{idx}", radius=0.022, length=3.86, location=(0.15, -0.375, rz), segments=20, mat=mat_chrome)
        # Machined brass side hinge bushings
        add_cylinder_x(f"FlapBushingL_{idx}", radius=0.044, length=0.07, location=(-1.74, -0.375, rz), segments=20, mat=mat_brass)
        add_cylinder_x(f"FlapBushingR_{idx}", radius=0.044, length=0.07, location=(2.04, -0.375, rz), segments=20, mat=mat_brass)

    # Corner machined hex bezel bolts on the front steel housing
    for sx in (-case_w * 0.5 + 0.15, case_w * 0.5 - 0.14):
        for sz in (base_z + 0.12, base_z + case_h - 0.14):
            add_cylinder_y(f"Bolt_{sx:.2f}_{sz:.2f}", radius=0.042, length=0.04, location=(sx, -case_d * 0.5 - 0.04, sz), mat=mat_chrome)

    # Front header & left index UV bezel overlay decal
    add_front_uv_plane(
        "FrontBezelDecal",
        width=case_w - 0.16,
        height=case_h - 0.10,
        location=(0.0, -case_d * 0.5 - 0.055, base_z + case_h * 0.5),
        mat=mat_bezel_decal,
    )

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
