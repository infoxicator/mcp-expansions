import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/jacket-legend.blend")
OUT_GLB = os.path.abspath("assets/models/jacket-legend.glb")


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


def add_stadium_extrude_x(name, length_x, width_y, height_z, location, end_bevel=0.018, mat=None, parent=None):
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
        make_ring(x0 + b * 0.45, width_y - 0.7 * b, height_z - 0.7 * b),
        make_ring(x0 + b, width_y, height_z),
        make_ring(x1 - b, width_y, height_z),
        make_ring(x1 - b * 0.45, width_y - 0.7 * b, height_z - 0.7 * b),
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


def add_usbc_plug(name, direction, mat_overmold, mat_strain, mat_alu, mat_steel):
    """Create a tactile macro USB-C plug centered at origin where cable exits along +X*direction and steel nose points along -X*direction."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)

    # Anodized aluminum housing body (macro thick Thunderbolt/USB4 proportions)
    add_stadium_extrude_x(
        f"{name}_Housing",
        length_x=1.22,
        width_y=0.72,
        height_z=0.46,
        location=(0.0, 0.0, 0.0),
        end_bevel=0.045,
        mat=mat_alu,
        parent=root,
    )
    # Matte black collar ring on the plug grip
    add_stadium_extrude_x(
        f"{name}_GripBand",
        length_x=0.38,
        width_y=0.74,
        height_z=0.48,
        location=(direction * 0.24, 0.0, 0.0),
        end_bevel=0.025,
        mat=mat_overmold,
        parent=root,
    )
    # Flex strain-relief ribs exiting toward the cable (+direction)
    for idx in range(4):
        t = idx / 3.0
        add_stadium_extrude_x(
            f"{name}_Rib_{idx}",
            length_x=0.095,
            width_y=0.60 - t * 0.14,
            height_z=0.42 - t * 0.08,
            location=(direction * (0.68 + idx * 0.12), 0.0, 0.0),
            end_bevel=0.016,
            mat=mat_strain,
            parent=root,
        )
    # Core inside strain relief
    add_stadium_extrude_x(
        f"{name}_StrainCore",
        length_x=0.52,
        width_y=0.42,
        height_z=0.36,
        location=(direction * 0.86, 0.0, 0.0),
        end_bevel=0.02,
        mat=mat_strain,
        parent=root,
    )
    # Stainless steel USB-C male tongue pointing outward (-direction)
    add_stadium_extrude_x(
        f"{name}_Neck",
        length_x=0.08,
        width_y=0.54,
        height_z=0.28,
        location=(-direction * 0.64, 0.0, 0.0),
        end_bevel=0.014,
        mat=mat_strain,
        parent=root,
    )
    add_stadium_extrude_x(
        f"{name}_SteelShell",
        length_x=0.56,
        width_y=0.48,
        height_z=0.19,
        location=(-direction * 0.94, 0.0, 0.0),
        end_bevel=0.022,
        mat=mat_steel,
        parent=root,
    )
    return root


def add_cable_reference_mesh(name, mat_jacket):
    """Reference straight cable cylinder in the .blend so the file is self-contained (replaced dynamically in Three.js)."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=32,
        radius1=0.22,
        radius2=0.22,
        depth=4.6,
    )
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector((0.0, 0.0, 0.24))
    obj.rotation_euler = (0.0, math.pi * 0.5, 0.0)
    set_smooth(obj)
    obj.data.materials.append(mat_jacket)
    return obj


def build():
    clear_scene()

    mat_alu = make_material("PlugAnodizedAlu", (0.14, 0.145, 0.155), metallic=0.82, roughness=0.34)
    mat_overmold = make_material("PlugMatteTPE", (0.04, 0.042, 0.045), metallic=0.02, roughness=0.68)
    mat_strain = make_material("PlugStrainTPE", (0.055, 0.057, 0.06), metallic=0.02, roughness=0.72)
    mat_steel = make_material("USBC_Steel", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_jacket = make_material("CableJacketRef", (0.032, 0.034, 0.038), metallic=0.0, roughness=0.64)

    plug_l = add_usbc_plug("PlugLeft", direction=1.0, mat_overmold=mat_overmold, mat_strain=mat_strain, mat_alu=mat_alu, mat_steel=mat_steel)
    plug_l.location = Vector((-3.25, 0.0, 0.24))

    plug_r = add_usbc_plug("PlugRight", direction=-1.0, mat_overmold=mat_overmold, mat_strain=mat_strain, mat_alu=mat_alu, mat_steel=mat_steel)
    plug_r.location = Vector((3.25, 0.0, 0.24))

    add_cable_reference_mesh("CableJacketRef", mat_jacket)

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
