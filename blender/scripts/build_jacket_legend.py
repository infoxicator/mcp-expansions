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
    for side in (-1,1):
        add_stadium_extrude_x(f"{name}_Stake{side}", .026, .080, .004,
                     (-direction*.83,side*.105,.0955), .001, mat_overmold, root)
    add_stadium_extrude_x(f"{name}_Insert", .004, .414, .126,
                     (-direction*1.220,0,0), .001, mat_overmold, root)
    return root


def add_free_end(mat):
    path = bpy.data.curves.new("Free cable end","CURVE")
    path.dimensions = "3D"
    path.bevel_depth, path.bevel_resolution = .15, 6
    line = path.splines.new('POLY')
    line.points.add(32)
    for i, point in enumerate(line.points):
        t = i/32
        point.co = (-1.13+2.60*t, -(.9+.055*t+.105*t*t),.158+.029*t,1)
    obj = bpy.data.objects.new("CableJacketRef",path)
    bpy.context.collection.objects.link(obj)
    path.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')


def build():
    clear_scene()

    mat_alu = make_material("PlugAnodizedAlu", (0.14, 0.145, 0.155), metallic=0.82, roughness=0.34)
    mat_overmold = make_material("PlugMatteTPE", (0.04, 0.042, 0.045), metallic=0.02, roughness=0.68)
    mat_strain = make_material("PlugStrainTPE", (0.055, 0.057, 0.06), metallic=0.02, roughness=0.72)
    mat_steel = make_material("USBC_Steel", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_jacket = make_material("CableJacketRef", (0.032, 0.034, 0.038), metallic=0.0, roughness=0.64)

    # One continuous wound lead with a tangent free end for the printed legend.
    stock = make_material("CoilStock", (.60,.59,.54), roughness=.54)
    curve = bpy.data.curves.new("Wound jacket","CURVE")
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = .15
    curve.bevel_resolution = 6
    spline = curve.splines.new('BEZIER')
    count = 100
    lead = [Vector((-.58,.44,.158)), Vector((-.93,.44,.158)), Vector((-1.31,.23,.158)),
            Vector((-1.31,.03,.158)), Vector((-1.14,-.12,.158))]
    points = list(lead)
    for i in range(count+1):
        u = i/count
        angle = -math.pi/2 - 4*math.pi*(1-u)
        rx, ry = 1.18+.92*u,.66+.73*u
        points.append(Vector((-.60+rx*math.cos(angle)-.53*u**4,
              .49+ry*math.sin(angle),.158+.012*math.sin(angle*2)**2)))
    spline.bezier_points.add(len(points)-1)
    for point,coord in zip(spline.bezier_points, points):
        point.co = coord
        point.handle_left_type = point.handle_right_type = 'AUTO'
    coil = bpy.data.objects.new("CoilStock",curve)
    bpy.context.collection.objects.link(coil)
    curve.materials.append(stock)
    bpy.ops.object.select_all(action='DESELECT')
    coil.select_set(True)
    bpy.context.view_layer.objects.active = coil
    bpy.ops.object.convert(target='MESH')
    plug_l = add_usbc_plug("RearTerminal", direction=1, mat_overmold=mat_overmold, mat_strain=mat_strain, mat_alu=mat_alu, mat_steel=mat_steel)
    tangent = (points[1]-points[0]).normalized()
    plug_l.location = points[0] - tangent*.61
    plug_l.rotation_euler.z = math.atan2(tangent.y,tangent.x)
    plug_l.scale = (.57,)*3
    plug_r = add_usbc_plug("PlugRight", direction=-1, mat_overmold=mat_overmold, mat_strain=mat_strain, mat_alu=mat_alu, mat_steel=mat_steel)
    plug_r.scale = (.78,)*3
    plug_r.location = (2.276,-1.142,.187)
    plug_r.rotation_euler.z = -.101
    add_free_end(stock)

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
