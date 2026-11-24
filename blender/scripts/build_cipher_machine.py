import math
import os
import bpy
import bmesh
from mathutils import Vector, Matrix

OUT_BLEND = os.path.abspath("blender/cipher-machine.blend")
OUT_GLB = os.path.abspath("assets/models/cipher-machine.glb")


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


def add_beveled_box(name, size, location, bevel_width=0.04, segments=4, mat=None, parent=None, rot_euler=(0, 0, 0)):
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
    obj.rotation_euler = rot_euler
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_cylinder(name, radius, depth, segments, location, rot_euler=(0, 0, 0), bevel_end=0.008, mat=None, parent=None):
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
        depth=depth,
    )
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=2, affect="EDGES", clamp_overlap=True)
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


def add_knurled_rotor(name, radius, width, teeth, location, mat_rim, mat_brass, parent=None):
    """Build a precision knurled cipher rotor rotating around the X axis."""
    root = bpy.data.objects.new(name, None)
    root.location = Vector(location)
    bpy.context.collection.objects.link(root)
    if parent:
        root.parent = parent

    # Precision knurled thumbwheel (axis along X)
    mesh = bpy.data.meshes.new(f"{name}_Wheel")
    obj = bpy.data.objects.new(f"{name}_Wheel", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    steps = teeth * 2
    half_w = width * 0.5
    chamfer = width * 0.16
    r_outer = radius
    r_valley = radius - 0.026

    rings_spec = [
        (-half_w, 0.94),
        (-half_w + chamfer, 1.0),
        (half_w - chamfer, 1.0),
        (half_w, 0.94),
    ]
    rings = []
    for x_pos, scale in rings_spec:
        ring = []
        for i in range(steps):
            ang = (2.0 * math.pi * i) / steps
            r = (r_outer if i % 2 == 0 else r_valley) * scale
            ring.append(bm.verts.new((x_pos, math.cos(ang) * r, math.sin(ang) * r)))
        rings.append(ring)

    n = len(rings[0])
    for r_idx in range(len(rings) - 1):
        ra = rings[r_idx]
        rb = rings[r_idx + 1]
        for i in range(n):
            ni = (i + 1) % n
            bm.faces.new((ra[i], rb[i], rb[ni], ra[ni]))

    # Clean planar side caps
    c_left = bm.verts.new((-half_w, 0.0, 0.0))
    c_right = bm.verts.new((half_w, 0.0, 0.0))
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((rings[0][ni], rings[0][i], c_left))
        bm.faces.new((rings[-1][i], rings[-1][ni], c_right))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    for poly in obj.data.polygons:
        poly.use_smooth = False
    obj.data.materials.append(mat_rim)

    # Brushed brass cipher drum paired beside the knurled wheel
    add_cylinder(
        f"{name}_BrassDrum",
        radius=radius * 0.87,
        depth=width * 1.35,
        segments=40,
        location=(width * 1.18, 0.0, 0.0),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.015,
        mat=mat_brass,
        parent=root,
    )
    # Steel spacer flange between wheel and drum
    add_cylinder(
        f"{name}_Collar",
        radius=radius * 0.91,
        depth=0.036,
        segments=40,
        location=(width * 0.52, 0.0, 0.0),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.006,
        mat=mat_rim,
        parent=root,
    )

    return root


def add_uv_plane(name, width, depth, location, mat, parent=None, curl=False):
    """Create a horizontal plane facing +Z with clean 0..1 UVs (v=1 at +Y/top, v=0 at -Y/bottom)."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    segs_y = 24 if curl else 1
    segs_x = 4 if curl else 1

    grid = []
    for iy in range(segs_y + 1):
        ty = iy / segs_y  # 0 at back (+Y, emerging from slot), 1 at front (-Y, resting on table)
        y = (0.5 - ty) * depth
        if curl:
            s = min(1.0, ty / 0.36)
            smooth_s = s * s * (3.0 - 2.0 * s)
            z = 0.235 * (1.0 - smooth_s) + 0.016 * smooth_s
            if ty > 0.88:
                tip_t = (ty - 0.88) / 0.12
                z += 0.016 * (tip_t * tip_t)
        else:
            z = 0.0

        row = []
        for ix in range(segs_x + 1):
            tx = ix / segs_x
            x = (tx - 0.5) * width
            v = bm.verts.new((x, y, z))
            row.append((v, tx, 1.0 - ty))
        grid.append(row)

    for iy in range(segs_y):
        for ix in range(segs_x):
            v00, u00, w00 = grid[iy][ix]
            v10, u10, w10 = grid[iy][ix + 1]
            v11, u11, w11 = grid[iy + 1][ix + 1]
            v01, u01, w01 = grid[iy + 1][ix]
            face = bm.faces.new((v01, v11, v10, v00))
            uvs = [(u01, w01), (u11, w11), (u10, w10), (u00, w00)]
            for loop, uv in zip(face.loops, uvs):
                loop[uv_layer].uv = uv

    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    set_smooth(obj)
    obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def build():
    clear_scene()

    mat_chassis = make_material("CipherChassis", (0.048, 0.050, 0.055), metallic=0.18, roughness=0.68)
    mat_deck = make_material("CipherDeck", (0.030, 0.032, 0.036), metallic=0.16, roughness=0.62)
    mat_seam = make_material("CipherSeam", (0.012, 0.013, 0.015), metallic=0.06, roughness=0.88)
    mat_steel = make_material("CipherSteel", (0.76, 0.78, 0.80), metallic=0.95, roughness=0.24)
    mat_brass = make_material("CipherBrass", (0.76, 0.62, 0.34), metallic=0.92, roughness=0.28)
    mat_knob = make_material("CipherKnob", (0.11, 0.075, 0.055), metallic=0.05, roughness=0.38)
    mat_faceplate = make_material("CipherFaceplate", (0.08, 0.082, 0.088), metallic=0.2, roughness=0.45)
    mat_paper = make_material("CipherPaper", (0.91, 0.88, 0.81), metallic=0.0, roughness=0.88)

    body_y = 0.65
    add_beveled_box("ChassisBase", (3.56, 2.38, 0.34), (0.0, body_y, 0.20), bevel_width=0.045, segments=4, mat=mat_chassis)
    add_beveled_box("ChassisMidSeam", (3.52, 2.34, 0.05), (0.0, body_y, 0.38), bevel_width=0.01, segments=2, mat=mat_seam)
    add_beveled_box("ChassisUpper", (3.50, 2.30, 0.56), (0.0, body_y, 0.68), bevel_width=0.065, segments=5, mat=mat_chassis)

    for sx in (-1.42, 1.42):
        for sy in (-0.90, 0.90):
            add_cylinder(
                f"Foot_{sx:.1f}_{sy:.1f}",
                radius=0.14,
                depth=0.05,
                segments=24,
                location=(sx, body_y + sy, 0.025),
                bevel_end=0.008,
                mat=mat_seam,
            )

    add_beveled_box("TopDeckPlate", (3.12, 1.92, 0.06), (0.0, body_y, 0.965), bevel_width=0.018, segments=3, mat=mat_deck)

    add_uv_plane(
        "FaceplateDecal",
        width=3.06,
        depth=1.86,
        location=(0.0, body_y, 1.001),
        mat=mat_faceplate,
    )

    for sx in (-1.42, 1.42):
        for sy in (-0.82, 0.82):
            add_cylinder(
                f"DeckScrew_{sx:.1f}_{sy:.1f}",
                radius=0.052,
                depth=0.03,
                segments=20,
                location=(sx, body_y + sy, 0.998),
                bevel_end=0.006,
                mat=mat_steel,
            )

    # 2. Three milled rotor bays & knurled steel/brass rotors (M, C, P)
    rotor_xs = (-0.90, 0.0, 0.90)
    rotor_names = ("RotorM", "RotorC", "RotorP")
    rotor_y = body_y + 0.06
    rotor_z = 0.87

    for rx, rname in zip(rotor_xs, rotor_names):
        # Dark flat slot recess painted flush with top deck (underneath rotor protrusion)
        add_beveled_box(
            f"{rname}_Slot",
            (0.68, 0.94, 0.012),
            (rx + 0.05, rotor_y, 0.997),
            bevel_width=0.004,
            segments=1,
            mat=mat_seam,
        )
        # Machined brass bezel frame bordering each rotor bay
        add_beveled_box(
            f"{rname}_BezelTop",
            (0.72, 0.045, 0.032),
            (rx + 0.05, rotor_y + 0.48, 1.006),
            bevel_width=0.007,
            segments=2,
            mat=mat_brass,
        )
        add_beveled_box(
            f"{rname}_BezelBot",
            (0.72, 0.045, 0.032),
            (rx + 0.05, rotor_y - 0.48, 1.006),
            bevel_width=0.007,
            segments=2,
            mat=mat_brass,
        )
        add_knurled_rotor(
            rname,
            radius=0.41,
            width=0.18,
            teeth=34,
            location=(rx - 0.12, rotor_y, rotor_z),
            mat_rim=mat_steel,
            mat_brass=mat_brass,
        )

    # 3. Brass side crank assembly on +X face
    crank_root = bpy.data.objects.new("CrankAssembly", None)
    crank_root.location = Vector((1.75, body_y + 0.14, 0.58))
    bpy.context.collection.objects.link(crank_root)

    # Machined flange & shaft
    add_cylinder(
        "CrankFlange",
        radius=0.22,
        depth=0.09,
        segments=32,
        location=(0.04, 0.0, 0.0),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.012,
        mat=mat_steel,
        parent=crank_root,
    )
    add_cylinder(
        "CrankShaft",
        radius=0.08,
        depth=0.24,
        segments=24,
        location=(0.14, 0.0, 0.0),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.008,
        mat=mat_brass,
        parent=crank_root,
    )
    # Brass lever arm extending downward-forward at rest
    add_beveled_box(
        "CrankArm",
        (0.08, 0.13, 0.72),
        (0.24, 0.0, 0.28),
        bevel_width=0.022,
        segments=3,
        mat=mat_brass,
        parent=crank_root,
    )
    # Turned handle pin & dark bakelite/walnut grip knob
    add_cylinder(
        "CrankPin",
        radius=0.045,
        depth=0.12,
        segments=20,
        location=(0.30, 0.0, 0.58),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.006,
        mat=mat_brass,
        parent=crank_root,
    )
    add_cylinder(
        "CrankHandle",
        radius=0.105,
        depth=0.38,
        segments=28,
        location=(0.50, 0.0, 0.58),
        rot_euler=(0.0, math.pi * 0.5, 0.0),
        bevel_end=0.028,
        mat=mat_knob,
        parent=crank_root,
    )

    # 4. Front paper-tape exit bezel & serrated brass tear bar (-Y face)
    front_y = body_y - 1.15
    add_beveled_box("PaperSlotFrame", (2.86, 0.12, 0.19), (0.0, front_y - 0.02, 0.25), bevel_width=0.016, segments=3, mat=mat_deck)
    add_beveled_box("PaperSlotCavity", (2.68, 0.14, 0.065), (0.0, front_y - 0.03, 0.245), bevel_width=0.004, segments=1, mat=mat_seam)
    add_beveled_box("PaperTearBar", (2.74, 0.05, 0.028), (0.0, front_y - 0.08, 0.295), bevel_width=0.005, segments=2, mat=mat_brass)

    # 5. Archival paper tape feeding forward out of the slot (-Y in Blender = +Z in Three.js)
    tape_root = bpy.data.objects.new("PaperTapeRoot", None)
    tape_root.location = Vector((0.0, front_y - 0.02, 0.0))
    bpy.context.collection.objects.link(tape_root)

    tape_len = 2.15
    add_uv_plane(
        "PaperTape",
        width=2.56,
        depth=tape_len,
        location=(0.0, -tape_len * 0.5, 0.0),
        mat=mat_paper,
        parent=tape_root,
        curl=True,
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
