import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/dymo-embosser.blend")
OUT_GLB = os.path.abspath("assets/models/dymo-embosser.glb")


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


def add_cylinder_z(name, radius, height, location, segments=36, bevel_end=0.012, mat=None, parent=None):
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


def add_scalloped_wheel(name, radius, height, notches, location, mat, parent=None):
    """Build a scalloped Dymo Tapewriter rotary character wheel rotating around Z."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    steps = notches * 2
    hz = height * 0.5
    chamfer = height * 0.16
    r_outer = radius
    r_inner = radius - 0.045

    rings_spec = [
        (-hz, 0.96),
        (-hz + chamfer, 1.0),
        (hz - chamfer, 1.0),
        (hz, 0.96),
    ]
    rings = []
    for z_val, sc in rings_spec:
        ring = []
        for i in range(steps):
            ang = (2.0 * math.pi * i) / steps
            r = (r_outer if i % 2 == 0 else r_inner) * sc
            ring.append(bm.verts.new((math.cos(ang) * r, math.sin(ang) * r, z_val)))
        rings.append(ring)

    n = len(rings[0])
    for ri in range(len(rings) - 1):
        ra = rings[ri]
        rb = rings[ri + 1]
        for i in range(n):
            ni = (i + 1) % n
            bm.faces.new((ra[i], rb[i], rb[ni], ra[ni]))

    c_bot = bm.verts.new((0.0, 0.0, -hz))
    c_top = bm.verts.new((0.0, 0.0, hz))
    for i in range(n):
        ni = (i + 1) % n
        bm.faces.new((rings[0][ni], rings[0][i], c_bot))
        bm.faces.new((rings[-1][i], rings[-1][ni], c_top))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
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

    mat_body = make_material("DymoMatteBlack", (0.044, 0.046, 0.050), metallic=0.18, roughness=0.66)
    mat_chrome = make_material("DymoChrome", (0.80, 0.82, 0.84), metallic=0.96, roughness=0.18)
    mat_wheel = make_material("DymoWheelCharcoal", (0.06, 0.064, 0.070), metallic=0.15, roughness=0.46)
    mat_brass = make_material("DymoBrassPointer", (0.80, 0.64, 0.30), metallic=0.92, roughness=0.24)
    mat_wheel_face = make_material("DymoWheelDecal", (0.08, 0.08, 0.08), metallic=0.0, roughness=0.5)
    mat_vinyl_base = make_material("DymoVinylBase", (0.025, 0.026, 0.030), metallic=0.0, roughness=0.18)

    # 1. Left: Vintage Cast-Aluminum & Crinkle-Black Dymo M-22 Embossing Head
    hx = -1.68
    # One-piece die-cast body, with a narrower grip under the thumbwheel.
    contour = [(1.00,.56),(.64,1.02),(.03,1.16),(-.68,.96),(-1.01,.47),
               (-1.04,-.30),(-.77,-.86),(-.79,-1.43),(-.85,-1.97),
               (-.70,-2.20),(-.22,-2.19),(-.08,-1.95),(-.04,-1.23),
               (.13,-.87),(.61,-.66),(.98,-.47)]
    profile = bpy.data.curves.new('Cast silhouette', 'CURVE')
    profile.dimensions = '2D'
    profile.fill_mode = 'BOTH'
    profile.extrude = .195
    profile.bevel_depth = .066
    profile.bevel_resolution = 5
    spline = profile.splines.new('BEZIER')
    spline.bezier_points.add(len(contour)-1)
    for point, (x,y) in zip(spline.bezier_points, contour):
        point.co = (x,y,0)
        point.handle_left_type = point.handle_right_type = 'AUTO'
    spline.use_cyclic_u = True
    body = bpy.data.objects.new('EmbosserBody',profile)
    bpy.context.collection.objects.link(body)
    body.location = (hx,0,.304)
    body.data.materials.append(mat_body)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.convert(target='MESH')
    body.select_set(False)
    # Brushed chrome top deck collar & tape guide exit nozzle pointing +X
    add_beveled_box("ChromeGuideRail", (0.72, 1.98, 0.36), (hx + 0.92, 0.0, 0.24), bevel_width=0.035, segments=3, mat=mat_chrome)
    add_beveled_box("ChromeCutGate", (0.14, 2.08, 0.42), (hx + 1.24, 0.0, 0.26), bevel_width=0.02, segments=2, mat=mat_body)

    # Squeezable machined chrome trigger handle extending below (-Y)
    trig_root = bpy.data.objects.new("TriggerLever", None)
    trig_root.location = Vector((hx + .15, -.90, .26))
    bpy.context.collection.objects.link(trig_root)
    add_beveled_box("TriggerArm", (0.25, 1.12, 0.28), (0.0, -0.34, 0.0), bevel_width=0.045, segments=4, mat=mat_chrome, parent=trig_root)
    add_beveled_box("TriggerGrip", (0.33, 0.73, 0.31), (0.0, -0.56, 0.0), bevel_width=0.05, segments=4, mat=mat_body, parent=trig_root)

    # Rotating scalloped rotary character wheel centered on top of embossing head
    wheel_root = bpy.data.objects.new("EmbossWheel", None)
    wheel_root.location = Vector((hx - 0.04, 0.08, 0.68))
    bpy.context.collection.objects.link(wheel_root)

    add_scalloped_wheel("WheelRim", radius=0.96, height=0.20, notches=36, location=(0.0, 0.0, 0.0), mat=mat_wheel, parent=wheel_root)
    add_uv_plane("WheelDialFace", 1.76, 1.76, (0.0, 0.0, 0.104), mat_wheel_face, parent=wheel_root)
    # Machined chrome center cap nut
    add_cylinder_z("WheelHub", radius=0.22, height=0.25, location=(0.0, 0.0, 0.02), mat=mat_chrome, parent=wheel_root)

    # Fixed brass index pointer pointing at the active character notch on +X edge of dial
    add_beveled_box("BrassIndex", (0.28, 0.10, 0.08), (hx + 0.96, 0.08, 0.78), bevel_width=0.014, segments=2, mat=mat_brass)

    # 2. Right: Three Glossy Embossed Vinyl Dymo Label Strips (M, C, P)
    strip_ys = (0.82, 0.0, -0.82)
    for idx, sy in enumerate(strip_ys):
        s_root = bpy.data.objects.new(f"DymoStrip{idx}", None)
        s_root.location = Vector((1.06, sy, 0.0))
        bpy.context.collection.objects.link(s_root)

        # A strip cut off a spool retains a little of its winding radius.
        # Model the curl continuously so the softbox reflection follows the vinyl.
        root_angle = [-.011, .018, -.028][idx]
        s_root.rotation_euler.z = root_angle
        sections = 36
        verts, faces = [], []
        for j in range(sections+1):
            u = j / sections
            for k in range(3):
                v = k/2
                cut = .023 * v * (1 if idx == 1 else -1)
                x = 3.16 * (u-.5) + cut * u**8
                y = (v-.5)*.59
                lift = [.11,.05,.16][idx] * u**5 + .040*(1-u)**6
                z = .029 + lift + .014*(2*v-1)**2 + .021*u**4*(v-.5)
                verts.append((x,y,z))
        for j in range(sections):
            for k in range(2):
                a = j*3+k
                faces.append((a,a+3,a+4,a+1))
        mesh = bpy.data.meshes.new("Cut tape")
        mesh.from_pydata(verts,[],faces)
        mesh.update()
        uv = mesh.uv_layers.new(name="UVMap")
        for loop in mesh.loops:
            j,k = divmod(loop.vertex_index,3)
            uv.data[loop.index].uv = (j/sections, k/2)
        strip = bpy.data.objects.new(f"StripFace{idx}",mesh)
        bpy.context.collection.objects.link(strip)
        strip.parent = s_root
        ink = make_material(f"DymoStripFace{idx}", (.018,.02,.022), roughness=.28)
        mesh.materials.append(ink)
        mesh.materials.append(mat_vinyl_base)
        for face in mesh.polygons:
            face.use_smooth = True
        backing = strip.modifiers.new("Adhesive backing","SOLIDIFY")
        backing.thickness = .012
        backing.material_offset = 1
        backing.material_offset_rim = 1
        bpy.context.view_layer.objects.active = strip
        bpy.ops.object.modifier_apply(modifier=backing.name)
        # The sheared PVC edge is square. A smooth rim would pull the face
        # normals sideways and give this flat strip a cylindrical reflection.
        for face in strip.data.polygons:
            if abs(face.normal.z) < .55:
                face.use_smooth = False

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
