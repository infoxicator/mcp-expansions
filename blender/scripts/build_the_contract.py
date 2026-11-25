import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix

OUT_BLEND = os.path.abspath("blender/the-contract.blend")
OUT_GLB = os.path.abspath("assets/models/the-contract.glb")


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


def molded_shell(name, size, center, radius, lip, material):
    width, depth, height = size
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    vertices, faces = [], []
    profiles = [(-height/2, lip), (-height/2 + lip*.28, lip*.30),
                (-height/2 + lip, 0), (height/2 - lip, 0),
                (height/2 - lip*.28, lip*.30), (height/2, lip)]
    for z, inset in profiles:
        for corner, (sx, sy) in enumerate([(1,1), (-1,1), (-1,-1), (1,-1)]):
            for n in range(13):
                angle = (corner + n/12) * math.pi/2
                vertices.append((sx*(width/2-radius) + (radius-inset)*math.cos(angle),
                                 sy*(depth/2-radius) + (radius-inset)*math.sin(angle), z))
    count = 52
    faces.append(tuple(reversed(range(count))))
    for level in range(len(profiles)-1):
        for n in range(count):
            a = level*count + n
            b = level*count + (n+1)%count
            faces.append((a,b,b+count,a+count))
    faces.append(tuple(range(len(vertices)-count,len(vertices))))
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj.location = center
    set_smooth(obj)
    obj.data.materials.append(material)
    return obj


def cover_screw(x, y, metal, recess):
    # Machine the conical seat, annular crown and six-lobed security drive.
    rings = [(.066, .648), (.062, .650), (.055, .656), (.049, .659),
             (.025, .659), (.022, .655), (.021, .650)]
    count = 72
    vertices, faces = [], []
    for level, (radius, height) in enumerate(rings):
        for n in range(count):
            theta = 2 * math.pi * n / count
            profile = 1 - .16 * math.cos(6 * theta + x + y) if level >= 4 else 1
            vertices.append((radius * profile * math.cos(theta),
                             radius * profile * math.sin(theta), height))
    for k in range(len(rings)-1):
        for n in range(count):
            nxt = (n+1) % count
            faces.append((k*count+n, k*count+nxt, (k+1)*count+nxt, (k+1)*count+n))
    faces.append(tuple(range((len(rings)-1)*count, len(vertices))))
    mesh = bpy.data.meshes.new("Recessed drive")
    mesh.from_pydata(vertices, [], faces)
    obj = bpy.data.objects.new("CoverFastener", mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = (x, y, 0)
    mesh.materials.append(metal)
    mesh.materials.append(recess)
    for face in mesh.polygons:
        face.material_index = int(face.index < count or face.index >= 5*count)
        face.use_smooth = face.index < 5*count


def add_stadium_extrude_x(name, length_x, width_y, height_z, location, end_bevel=0.015, mat=None, parent=None):
    """Create a smooth rounded-stadium (pill cross-section in Y-Z) extruded along X with clean chamfered ends."""
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

    if b > 0.001:
        rings = [
            make_ring(x0, width_y - 2.0 * b, height_z - 2.0 * b),
            make_ring(x0 + b * 0.45, width_y - 0.7 * b, height_z - 0.7 * b),
            make_ring(x0 + b, width_y, height_z),
            make_ring(x1 - b, width_y, height_z),
            make_ring(x1 - b * 0.45, width_y - 0.7 * b, height_z - 0.7 * b),
            make_ring(x1, width_y - 2.0 * b, height_z - 2.0 * b),
        ]
    else:
        rings = [
            make_ring(x0, width_y, height_z),
            make_ring(x1, width_y, height_z),
        ]

    n = len(rings[0])
    for r_idx in range(len(rings) - 1):
        ra = rings[r_idx]
        rb = rings[r_idx + 1]
        for i in range(n):
            ni = (i + 1) % n
            bm.faces.new((ra[i], rb[i], rb[ni], ra[ni]))

    # Clean end caps
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
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


def add_cable_curve(name, points, radius=0.102, mat=None, parent=None):
    curve_data = bpy.data.curves.new(name + "_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 16
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 10
    curve_data.use_fill_caps = True

    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for idx, p in enumerate(points):
        bp = spline.bezier_points[idx]
        bp.co = Vector(p)
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"

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
    if parent:
        mesh_obj.parent = parent
    mesh_obj.select_set(False)
    return mesh_obj


def add_oled_quad(name, width_x, height_y, z_pos, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    hx = width_x * 0.5
    hy = height_y * 0.5
    # Facing +Z in Blender -> +Y (up) in glTF
    # In Three.js looking from +Y down toward origin with +X right and +Z forward (bottom of screen):
    # Blender -Y becomes glTF +Z (bottom of screen), Blender +Y becomes glTF -Z (top of screen)!
    v0 = bm.verts.new((-hx, -hy, 0.0))  # bottom-left (u=0, v=0)
    v1 = bm.verts.new((hx, -hy, 0.0))   # bottom-right (u=1, v=0)
    v2 = bm.verts.new((hx, hy, 0.0))    # top-right (u=1, v=1)
    v3 = bm.verts.new((-hx, hy, 0.0))   # top-left (u=0, v=1)
    face = bm.faces.new((v0, v1, v2, v3))

    uv_layer = bm.loops.layers.uv.verify()
    uvs = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
    for loop, uv in zip(face.loops, uvs):
        loop[uv_layer].uv = uv

    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector((0.0, 0.0, z_pos))
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_plug_and_cable(prefix, direction, base_x, z_mid, mat_overmold, mat_strain, mat_cable, mat_steel, include_male_tongue=False, parent=None):
    """Build an authentic USB-C overmold + stepped strain relief + cable extending along `direction` (-1 or +1)."""
    # Overmold body (stadium pill cross-section)
    overmold_len = 0.90
    overmold_x = base_x + direction * (overmold_len * 0.5)
    add_stadium_extrude_x(
        f"{prefix}_Overmold",
        length_x=overmold_len,
        width_y=0.64,
        height_z=0.35,
        location=(overmold_x, 0.0, z_mid),
        end_bevel=0.042,
        mat=mat_overmold,
        parent=parent,
    )

    # Fine grip flutes molded into the thumb end, continuous with the overmold.
    for i in range(4):
        ridge = molded_shell(f"{prefix}_Grip_{i}", (.033, .27, .013),
                             (overmold_x + direction * (.16 + .052*i), 0, z_mid+.173),
                             .015, .004, mat_overmold)
        ridge.parent = parent

    # Stepped strain-relief ribs (4 crisp tapered rings)
    rib_start = base_x + direction * (overmold_len + 0.03)
    for i in range(4):
        t = i / 3.0
        rx = rib_start + direction * (i * 0.105)
        w = 0.44 * (1.0 - 0.34 * t)
        h = 0.27 * (1.0 - 0.24 * t)
        add_stadium_extrude_x(
            f"{prefix}_Rib_{i}",
            length_x=0.072,
            width_y=w,
            height_z=h,
            location=(rx, 0.0, z_mid),
            end_bevel=0.015,
            mat=mat_strain,
            parent=parent,
        )

    # Inner flexible core joining the strain-relief ribs
    core_start = base_x + direction * overmold_len
    core_len = 0.48
    add_stadium_extrude_x(
        f"{prefix}_StrainCore",
        length_x=core_len,
        width_y=0.22,
        height_z=0.19,
        location=(core_start + direction * (core_len * 0.5), 0.0, z_mid),
        end_bevel=0.01,
        mat=mat_strain,
        parent=parent,
    )

    # Stainless steel USB-C male plug shell (for the interactive right-hand cable)
    if include_male_tongue:
        # Neck step collar
        add_stadium_extrude_x(
            f"{prefix}_CollarStep",
            length_x=0.06,
            width_y=0.54,
            height_z=0.22,
            location=(base_x - direction * 0.02, 0.0, z_mid),
            end_bevel=0.012,
            mat=mat_strain,
            parent=parent,
        )
        # A folded stainless sleeve, open at the nose. The insert and contacts
        # sit behind the front lip and become visible when the plug withdraws.
        nose = base_x - direction * .54
        shell = add_stadium_extrude_x(f"{prefix}_USBC_Steel", .52, .49, .16,
                    (base_x-direction*.28, 0, z_mid), end_bevel=.012,
                    mat=mat_steel, parent=parent)
        bm = bmesh.new()
        bm.from_mesh(shell.data)
        front = min(bm.faces, key=lambda f: direction * f.calc_center_median().x)
        bm.faces.remove(front)
        bm.to_mesh(shell.data)
        bm.free()
        wall = shell.modifiers.new("Rolled sheet", "SOLIDIFY")
        wall.thickness = .010
        bpy.context.view_layer.objects.active = shell
        bpy.ops.object.modifier_apply(modifier=wall.name)
        insert = make_material("PlugInsert", (.018,.019,.021), roughness=.62)
        contact = make_material("ConnectorContact", (.78,.57,.23), metallic=.9, roughness=.32)
        add_stadium_extrude_x(f"{prefix}_Insert", .12, .45, .12,
                      (nose+direction*.105,0,z_mid), end_bevel=.007, mat=insert, parent=parent)
        for lane in range(12):
            add_beveled_box(f"{prefix}_Contact{lane}", (.045,.012,.007),
                       (nose+direction*.079,(lane-5.5)*.03,z_mid+.061),
                       bevel_width=.002,segments=2,mat=contact,parent=parent)
        # Two shallow witness marks where the metal crimps onto the insert.
        for side in (-1,1):
            add_beveled_box(f"{prefix}_Stake{side}", (.026,.079,.002),
                       (base_x-direction*.126,.098*side,z_mid+.081),
                       bevel_width=.001,segments=2,mat=insert,parent=parent)

    # Pale grey matte silicone/TPE cable sweeping gently off frame
    c0 = base_x + direction * (overmold_len + 0.42)
    pts = [
        (c0, 0.0, z_mid),
        (c0 + direction * 0.90, 0.0, z_mid - 0.05),
        (c0 + direction * 2.10, -0.10 * direction, 0.11),
        (c0 + direction * 3.80, -0.14 * direction, 0.11),
        (c0 + direction * 6.50, -0.05 * direction, 0.11),
    ]
    add_cable_curve(f"{prefix}_Cable", pts, radius=0.108, mat=mat_cable, parent=parent)


def build():
    clear_scene()

    mat_meter_body = make_material("MeterMatteBlack", (0.045, 0.046, 0.049), metallic=0.16, roughness=0.46)
    mat_meter_seam = make_material("MeterDarkSeam", (0.02, 0.02, 0.022), metallic=0.1, roughness=0.65)
    mat_bezel = make_material("MeterBezel", (0.026, 0.027, 0.03), metallic=0.25, roughness=0.24)
    mat_oled = make_material("OledScreenMat", (0.02, 0.025, 0.03), metallic=0.0, roughness=0.22)
    mat_glass = make_material("OledCoverGlass", (0.04, 0.045, 0.055), metallic=0.0, roughness=0.05)
    mat_port_steel = make_material("USBC_Stainless", (0.76, 0.78, 0.80), metallic=0.96, roughness=0.22)
    mat_port_dark = make_material("USBC_Cavity", (0.015, 0.015, 0.018), metallic=0.0, roughness=0.85)
    mat_overmold = make_material("CablePaleGreyOvermold", (0.80, 0.79, 0.765), metallic=0.0, roughness=0.48)
    mat_strain = make_material("CablePaleGreyStrain", (0.74, 0.73, 0.705), metallic=0.0, roughness=0.58)
    mat_cable = make_material("CablePaleGreyJacket", (0.78, 0.77, 0.745), metallic=0.0, roughness=0.52)
    mat_button = make_material("MicroButton", (0.09, 0.092, 0.098), metallic=0.45, roughness=0.35)

    # 1. Matchbox inline USB-C power meter housing
    meter_w = 3.24
    meter_d = 2.02
    meter_h = 0.62
    z_mid = 0.33

    # Main upper & lower halves with a delicate real CNC parting seam
    molded_shell("MeterLower", (meter_w-.025, meter_d-.025, .23), (0,0,.135), .19, .045, mat_meter_body)
    molded_shell("MeterSeamCore", (meter_w-.040, meter_d-.040, .018), (0,0,.259), .18, .005, mat_meter_seam)
    molded_shell("MeterUpper", (meter_w, meter_d, .378), (0,0,.457), .195, .046, mat_meter_body)
    for x in [-1.43, 1.43]:
        for y in [-.82, .82]:
            cover_screw(x, y, mat_button, mat_port_dark)

    # Subtle bottom rubber feet rails
    add_beveled_box("FootRail_F", (2.60, 0.14, 0.024), (0.0, -0.78, 0.012), bevel_width=0.008, segments=2, mat=mat_meter_seam)
    add_beveled_box("FootRail_B", (2.60, 0.14, 0.024), (0.0, 0.78, 0.012), bevel_width=0.008, segments=2, mat=mat_meter_seam)

    # Recessed glossy black bezel surround on top face
    molded_shell("OledBezel", (2.78, 1.60, .036), (0, 0, .635), .11, .012, mat_bezel)

    # Monochrome OLED active emitter quad (UV-mapped 0..1)
    add_oled_quad("OledScreen", width_x=2.50, height_y=1.38, z_pos=0.654, mat=mat_oled)

    # Thin protective smoked glass cover above OLED
    molded_shell("OledGlass", (2.68, 1.50, .010), (0, 0, .660), .078, .003, mat_glass)

    # Two subtle micro tactile buttons along the top back edge (like Power-Z / FNB meters)
    add_beveled_box("Btn_Back", (0.28, 0.07, 0.11), (-0.72, 1.02, 0.36), bevel_width=0.015, segments=2, mat=mat_button)
    add_beveled_box("Btn_Menu", (0.28, 0.07, 0.11), (-0.28, 1.02, 0.36), bevel_width=0.015, segments=2, mat=mat_button)

    # 2. Recessed stainless USB-C receptacles on both left (-X) and right (+X) ends
    for side, sx in [("Left", -meter_w * 0.5), ("Right", meter_w * 0.5)]:
        # Outer stainless bezel flange
        add_stadium_extrude_x(
            f"PortFlange_{side}",
            length_x=0.06,
            width_y=0.58,
            height_z=0.24,
            location=(sx, 0.0, z_mid),
            end_bevel=0.014,
            mat=mat_port_steel,
        )
        # Dark recessed interior cavity
        add_stadium_extrude_x(
            f"PortCavity_{side}",
            length_x=0.08,
            width_y=0.50,
            height_z=0.17,
            location=(sx + (0.01 if sx > 0 else -0.01), 0.0, z_mid),
            end_bevel=0.004,
            mat=mat_port_dark,
        )
        # Central USB-C PCB tongue inside the right cavity (visible when unplugged)
        if side == "Right":
            add_beveled_box(
                "PortTongue_Right",
                (0.14, 0.36, 0.036),
                (sx - 0.02, 0.0, z_mid),
                bevel_width=0.006,
                segments=2,
                mat=mat_button,
            )

    # 3. Left cable assembly (fixed, seated into left port)
    left_root = bpy.data.objects.new("LeftCableRoot", None)
    left_root.location = Vector((0.0, 0.0, 0.0))
    bpy.context.collection.objects.link(left_root)
    add_plug_and_cable(
        "LeftPlug",
        direction=-1.0,
        base_x=-meter_w * 0.5 - 0.01,
        z_mid=z_mid,
        mat_overmold=mat_overmold,
        mat_strain=mat_strain,
        mat_cable=mat_cable,
        mat_steel=mat_port_steel,
        include_male_tongue=False,
        parent=left_root,
    )

    # 4. Right cable assembly (interactive, translates along +X when unplugged)
    right_root = bpy.data.objects.new("RightPlugRoot", None)
    right_root.location = Vector((0.0, 0.0, 0.0))
    bpy.context.collection.objects.link(right_root)
    add_plug_and_cable(
        "RightPlug",
        direction=1.0,
        base_x=meter_w * 0.5 + 0.01,
        z_mid=z_mid,
        mat_overmold=mat_overmold,
        mat_strain=mat_strain,
        mat_cable=mat_cable,
        mat_steel=mat_port_steel,
        include_male_tongue=True,
        parent=right_root,
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
