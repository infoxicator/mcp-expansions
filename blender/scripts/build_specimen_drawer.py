import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/specimen-drawer.blend")
OUT_GLB = os.path.abspath("assets/models/specimen-drawer.glb")


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


def add_beveled_box(name, size, location, bevel_width=0.03, segments=3, mat=None, parent=None):
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


def add_oval_coil(name, rx, ry, tube_r, z_base, mat, parent=None):
    """Create a tidy coiled oval cable loop lying flat inside an archival drawer bay."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    u_segs = 56
    v_segs = 14
    rings = []

    for iu in range(u_segs):
        t = (iu / u_segs) * math.pi * 2.0
        # Superellipse-like neat coiled bundle loop
        cx = math.cos(t) * rx
        cy = math.sin(t) * ry
        tx = -math.sin(t) * rx
        ty = math.cos(t) * ry
        tlen = math.hypot(tx, ty) or 1.0
        tx /= tlen
        ty /= tlen
        # Outward radial normal in XY
        nx = ty
        ny = -tx

        ring = []
        for iv in range(v_segs):
            phi = (iv / v_segs) * math.pi * 2.0
            c = math.cos(phi) * tube_r
            s = math.sin(phi) * tube_r
            ring.append(bm.verts.new((cx + nx * c, cy + ny * c, z_base + s)))
        rings.append(ring)

    for iu in range(u_segs):
        ra = rings[iu]
        rb = rings[(iu + 1) % u_segs]
        for iv in range(v_segs):
            niv = (iv + 1) % v_segs
            bm.faces.new((ra[iv], rb[iv], rb[niv], ra[niv]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
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

    mat_tray = make_material("DrawerMatteCharcoal", (0.046, 0.048, 0.052), metallic=0.14, roughness=0.72)
    mat_felt = make_material("DrawerFeltLiner", (0.025, 0.026, 0.029), metallic=0.0, roughness=0.92)
    mat_divider = make_material("DrawerDivider", (0.068, 0.070, 0.075), metallic=0.18, roughness=0.64)
    mat_cable = make_material("SpecimenCable", (0.032, 0.034, 0.038), metallic=0.0, roughness=0.62)
    mat_steel = make_material("USBC_Steel", (0.78, 0.80, 0.82), metallic=0.96, roughness=0.20)
    mat_collar = make_material("SpecimenCollarAlu", (0.72, 0.74, 0.76), metallic=0.86, roughness=0.28)
    mat_readout = make_material("DrawerReadoutMat", (0.02, 0.02, 0.025), metallic=0.0, roughness=0.28)
    mat_header = make_material("DrawerHeaderMat", (0.08, 0.08, 0.08), metallic=0.0, roughness=0.5)

    # 1. Archival Matte-Charcoal Divided Drawer Frame
    # Back bays sit at +Y (0.62), front wide readout console sits at -Y (-1.38)
    tray_w = 5.40
    tray_d = 4.30
    add_beveled_box("TrayFloor", (tray_w, tray_d, 0.14), (0.0, 0.0, 0.08), bevel_width=0.03, segments=3, mat=mat_tray)
    # Recessed dark felt bottom liner inside the 5 specimen compartments
    add_beveled_box("TrayFelt", (tray_w - 0.34, 2.38, 0.04), (0.0, 0.66, 0.16), bevel_width=0.008, segments=1, mat=mat_felt)

    # Perimeter walls
    wall_h = 0.56
    wall_z = 0.34
    add_beveled_box("WallBack", (tray_w, 0.18, wall_h), (0.0, tray_d * 0.5 - 0.09, wall_z), bevel_width=0.025, segments=3, mat=mat_tray)
    add_beveled_box("WallLeft", (0.18, tray_d, wall_h), (-tray_w * 0.5 + 0.09, 0.0, wall_z), bevel_width=0.025, segments=3, mat=mat_tray)
    add_beveled_box("WallRight", (0.18, tray_d, wall_h), (tray_w * 0.5 - 0.09, 0.0, wall_z), bevel_width=0.025, segments=3, mat=mat_tray)

    # Front wide specimen diagnostic bench deck (-Y side)
    add_beveled_box("FrontDeck", (tray_w, 1.56, wall_h), (0.0, -tray_d * 0.5 + 0.78, wall_z), bevel_width=0.032, segments=4, mat=mat_tray)
    # Recessed OLED/diagnostic strip on FrontDeck
    add_beveled_box("ReadoutBezel", (4.92, 1.24, 0.03), (0.0, -1.36, 0.618), bevel_width=0.012, segments=2, mat=mat_felt)
    add_uv_plane("DrawerReadout", 4.82, 1.14, (0.0, -1.36, 0.636), mat_readout)

    # Top archival index header bar along back wall (01 | 02 | 03 | 04 | 05)
    add_uv_plane("BayHeaderStrip", 4.96, 0.16, (0.0, tray_d * 0.5 - 0.09, 0.624), mat_header)

    # 4 internal vertical dividers creating 5 crisp specimen compartments
    bay_span = 5.00
    bay_w = bay_span / 5.0
    for i in range(1, 5):
        dx = -bay_span * 0.5 + i * bay_w
        add_beveled_box(f"Divider_{i}", (0.075, 2.52, 0.44), (dx, 0.70, 0.36), bevel_width=0.014, segments=2, mat=mat_divider)

    # 2. Five Identical-Looking Coiled USB-C Cable Specimens with Brushed-Metal Collars & LEDs
    for idx in range(5):
        bx = -bay_span * 0.5 + (idx + 0.5) * bay_w
        spec_root = bpy.data.objects.new(f"Specimen{idx}", None)
        spec_root.location = Vector((bx, 0.72, 0.0))
        bpy.context.collection.objects.link(spec_root)

        # Two stacked neat oval cable loops per coiled specimen
        add_oval_coil(f"Spec{idx}_CoilA", rx=0.31, ry=0.86, tube_r=0.068, z_base=0.25, mat=mat_cable, parent=spec_root)
        add_oval_coil(f"Spec{idx}_CoilB", rx=0.25, ry=0.77, tube_r=0.064, z_base=0.33, mat=mat_cable, parent=spec_root)

        # Brushed-metal archival collar clasping the center of the coiled cable
        add_beveled_box(f"Spec{idx}_Collar", (0.76, 0.34, 0.24), (0.0, 0.0, 0.36), bevel_width=0.032, segments=3, mat=mat_collar, parent=spec_root)

        # Tiny stainless USB-C plug tips peeking neatly out of the top of the coil
        add_beveled_box(f"Spec{idx}_PlugL", (0.14, 0.24, 0.09), (-0.12, 0.78, 0.39), bevel_width=0.018, segments=2, mat=mat_steel, parent=spec_root)
        add_beveled_box(f"Spec{idx}_PlugR", (0.14, 0.24, 0.09), (0.12, 0.78, 0.39), bevel_width=0.018, segments=2, mat=mat_steel, parent=spec_root)

        # Individual collar indicator jewel LED (separate material per specimen so only active live one glows!)
        mat_led = make_material(f"SpecLed{idx}", (0.10, 0.12, 0.11), metallic=0.0, roughness=0.22)
        add_cylinder_z(f"Spec{idx}_LedRing", 0.068, 0.025, (0.0, 0.0, 0.482), mat=mat_steel, parent=spec_root)
        add_cylinder_z(f"Spec{idx}_Led", 0.048, 0.032, (0.0, 0.0, 0.490), mat=mat_led, parent=spec_root)

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
