import bpy
import bmesh
import math
import os
from mathutils import Vector, Matrix

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLEND_OUT = os.path.join(ROOT, "blender", "mechanical-typewriter.blend")
GLB_OUT = os.path.join(ROOT, "assets", "models", "mechanical-typewriter.glb")


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


def add_beveled_box(name, size, location, rotation=(0, 0, 0), bevel_width=0.03, segments=3, mat=None, parent=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel_width > 0.0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel_width, segments=segments, affect="EDGES", clamp_overlap=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    obj.location = Vector(location)
    obj.rotation_euler = rotation
    set_smooth(obj)
    if mat:
        obj.data.materials.append(mat)
    if parent:
        obj.parent = parent
    return obj


def add_cylinder_axis(name, radius, length, location, axis="X", segments=36, bevel_end=0.015, mat=None, parent=None):
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
    if axis == "X":
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi * 0.5, 3, "Y"), verts=bm.verts)
    elif axis == "Y":
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi * 0.5, 3, "X"), verts=bm.verts)
    if bevel_end > 0.0:
        end_edges = [e for e in bm.edges if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.3]
        if end_edges:
            bmesh.ops.bevel(bm, geom=end_edges, offset=bevel_end, segments=2, affect="EDGES", clamp_overlap=True)
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


def add_knurled_knob(name, radius, length, location, mat_chrome, mat_dark, parent=None):
    """Platen carriage knob along X with radial grip ridges."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = Vector(location)
    if parent:
        root.parent = parent

    mesh = bpy.data.meshes.new(name + "_Body")
    obj = bpy.data.objects.new(name + "_Body", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    flutes = 24
    segs = flutes * 2
    hx = length * 0.5
    ring_l = []
    ring_r = []
    for i in range(segs):
        ang = (2.0 * math.pi * i) / segs
        r = radius if (i % 2 == 0) else (radius - 0.022)
        y = math.cos(ang) * r
        z = math.sin(ang) * r
        ring_l.append(bm.verts.new((-hx, y, z)))
        ring_r.append(bm.verts.new((hx, y, z)))

    for i in range(segs):
        ni = (i + 1) % segs
        bm.faces.new((ring_l[i], ring_r[i], ring_r[ni], ring_l[ni]))

    bm.faces.new(list(reversed(ring_l)))
    bm.faces.new(ring_r)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
    obj.data.materials.append(mat_dark)

    # Chrome end cap disc
    cap_x = -hx - 0.015 if location[0] < 0 else hx + 0.015
    add_cylinder_axis(name + "_Cap", radius * 0.78, 0.04, (cap_x, 0, 0), axis="X", segments=32, bevel_end=0.01, mat=mat_chrome, parent=root)
    return root


def add_curved_paper(name, width, mat_paper, parent=None):
    """Curved cotton bond sheet emerging from platen roller and resting cleanly on the paper table."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")

    # Profile in (y, z) from TOP edge of sheet (v=0) down to platen wrap (v=1)
    # Platen axis is at y=0.32, z=0.82, radius=0.28 -> top of platen is z=1.10
    steps_v = 24
    steps_u = 20
    hx = width * 0.5
    thickness = 0.012

    # Build smooth sheet curve: flat inclined paper table from y=2.68 down to y=0.66, then gentle curve into platen
    profile = []
    for iv in range(steps_v + 1):
        frac = iv / steps_v  # 0 at top of page, 1 at platen contact
        v = 1.0 - frac       # glTF exporter flips Blender V -> v_gltf = frac (0 at top, 1 at bottom)
        if frac <= 0.80:
            t = frac / 0.80  # 0 at top -> 1 near platen top
            y = 2.68 - t * 2.02  # 2.68 down to 0.66
            # Subtle graceful paper curl + slight paper table incline
            z = 1.66 - t * 0.52 + math.sin(t * math.pi) * 0.025
        else:
            t = (frac - 0.80) / 0.20  # 0 -> 1 wrapping smoothly onto platen roller
            ang = (1.0 - t) * 0.42  # angle from top-rear toward top crown of platen
            y = 0.32 + math.sin(ang) * 0.36 + (1.0 - t) * 0.19
            z = 0.82 + math.cos(ang) * 0.315
        profile.append((y, z, v))

    # Top visible face grid + underside grid so sheet has crisp micro paper edge
    top_grid = []
    bot_grid = []
    for y, z, v in profile:
        row_t = []
        row_b = []
        for iu in range(steps_u + 1):
            u = iu / steps_u
            x = -hx + u * width
            vt = bm.verts.new((x, y, z))
            vb = bm.verts.new((x, y, z - thickness))
            row_t.append((vt, u, v))
            row_b.append((vb, u, v))
        top_grid.append(row_t)
        bot_grid.append(row_b)

    # Top faces (facing +Z toward camera; winding CCW when viewed from +Z)
    for iv in range(steps_v):
        for iu in range(steps_u):
            # iv increases as y decreases (top -> bottom), iu increases as x increases (left -> right)
            # Quad (bottom-left, bottom-right, top-right, top-left) has +Z normal
            v_bl, u_bl, w_bl = top_grid[iv + 1][iu]
            v_br, u_br, w_br = top_grid[iv + 1][iu + 1]
            v_tr, u_tr, w_tr = top_grid[iv][iu + 1]
            v_tl, u_tl, w_tl = top_grid[iv][iu]
            face = bm.faces.new((v_bl, v_br, v_tr, v_tl))
            for loop, uv in zip(face.loops, [(u_bl, w_bl), (u_br, w_br), (u_tr, w_tr), (u_tl, w_tl)]):
                loop[uv_layer].uv = uv

            # Underside faces
            b_bl = bot_grid[iv + 1][iu][0]
            b_br = bot_grid[iv + 1][iu + 1][0]
            b_tr = bot_grid[iv][iu + 1][0]
            b_tl = bot_grid[iv][iu][0]
            bm.faces.new((b_tl, b_tr, b_br, b_bl))

    # Stitch thin outer edges
    for iu in range(steps_u):
        # Top edge
        bm.faces.new((top_grid[0][iu][0], top_grid[0][iu + 1][0], bot_grid[0][iu + 1][0], bot_grid[0][iu][0]))
        # Bottom edge
        bm.faces.new((bot_grid[steps_v][iu][0], bot_grid[steps_v][iu + 1][0], top_grid[steps_v][iu + 1][0], top_grid[steps_v][iu][0]))
    for iv in range(steps_v):
        # Left edge
        bm.faces.new((top_grid[iv][0][0], bot_grid[iv][0][0], bot_grid[iv + 1][0][0], top_grid[iv + 1][0][0]))
        # Right edge
        bm.faces.new((top_grid[iv + 1][steps_u][0], bot_grid[iv + 1][steps_u][0], bot_grid[iv][steps_u][0], top_grid[iv][steps_u][0]))

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
    obj.data.materials.append(mat_paper)
    return obj


def add_keycap(name, location, mat_chrome, mat_cap_tex, parent=None):
    """Iconic vintage Olivetti/Hermes round typewriter keycap with chrome bezel and UV top face."""
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.location = Vector(location)
    if parent:
        root.parent = parent

    # Steel key stem
    add_cylinder_axis(name + "_Stem", 0.048, 0.34, (0, 0, -0.18), axis="Z", segments=18, bevel_end=0.004, mat=mat_chrome, parent=root)
    # Brushed chrome outer bezel ring
    add_cylinder_axis(name + "_Bezel", 0.255, 0.11, (0, 0, 0.0), axis="Z", segments=36, bevel_end=0.018, mat=mat_chrome, parent=root)

    # Top circular UV disc for M / C / P legend
    mesh = bpy.data.meshes.new(name + "_Top")
    obj = bpy.data.objects.new(name + "_Top", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    segs = 36
    r = 0.218
    center = bm.verts.new((0.0, 0.0, 0.060))
    ring = []
    for i in range(segs):
        ang = (2.0 * math.pi * i) / segs
        x = math.cos(ang) * r
        y = math.sin(ang) * r
        ring.append(bm.verts.new((x, y, 0.068)))

    for i in range(segs):
        ni = (i + 1) % segs
        v1 = ring[i]
        v2 = ring[ni]
        face = bm.faces.new((center, v1, v2))
        for loop in face.loops:
            vx, vy = loop.vert.co.x, loop.vert.co.y
            u = 0.5 + (vx / (2.0 * r))
            v = 0.5 + (vy / (2.0 * r))  # glTF flips Blender V -> +Y becomes v_gltf=0 (top of canvas)
            loop[uv_layer].uv = (u, v)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    set_smooth(obj)
    obj.data.materials.append(mat_cap_tex)
    return root


def add_return_lever(name, mat_chrome, mat_accent, parent=None):
    """Curved brushed-chrome carriage return lever extending forward from left carriage cheek."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    if parent:
        obj.parent = parent

    bm = bmesh.new()
    pts = [
        (-2.22, 0.30, 0.92),
        (-2.26, 0.10, 1.05),
        (-2.18, -0.35, 1.12),
        (-2.00, -0.82, 1.06),
        (-1.72, -1.04, 1.02),
    ]
    tube_r = 0.036
    v_segs = 14
    rings = []
    for idx, p in enumerate(pts):
        p_vec = Vector(p)
        if idx == 0:
            tan = (Vector(pts[1]) - p_vec).normalized()
        elif idx == len(pts) - 1:
            tan = (p_vec - Vector(pts[-2])).normalized()
        else:
            tan = (Vector(pts[idx + 1]) - Vector(pts[idx - 1])).normalized()
        up = Vector((0, 0, 1))
        side = tan.cross(up)
        if side.length < 1e-4:
            side = Vector((1, 0, 0))
        side.normalize()
        up = side.cross(tan).normalized()
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

    # Sculpted vermilion-accent lever paddle
    add_beveled_box(name + "_Paddle", (0.34, 0.14, 0.055), (-1.58, -1.08, 1.02), rotation=(0.0, 0.0, -0.35), bevel_width=0.018, segments=2, mat=mat_accent, parent=parent)
    return obj


def build():
    clear_scene()

    mat_chassis = make_material("TypeChassisMatte", (0.06, 0.064, 0.072), metallic=0.22, roughness=0.62)
    mat_rubber = make_material("TypeRubberPlaten", (0.04, 0.042, 0.046), metallic=0.02, roughness=0.82)
    mat_chrome = make_material("TypeBrushedChrome", (0.84, 0.86, 0.88), metallic=0.96, roughness=0.18)
    mat_steel = make_material("TypeMachinedSteel", (0.66, 0.69, 0.72), metallic=0.92, roughness=0.28)
    mat_brass = make_material("TypeBrassAccent", (0.78, 0.62, 0.30), metallic=0.92, roughness=0.24)
    mat_vermilion = make_material("TypeVermilionFelt", (0.62, 0.12, 0.09), metallic=0.05, roughness=0.72)
    mat_paper = make_material("TypePaperSheet", (0.95, 0.93, 0.88), metallic=0.0, roughness=0.88)

    # ── 1. Machined Matte-Charcoal Typewriter Deck Chassis ──
    # Main upper deck base housing (stops cleanly at y = -1.35 behind the stepped keyboard shelf)
    add_beveled_box("ChassisBase", (4.70, 2.24, 0.62), (0.0, -0.23, 0.32), bevel_width=0.07, segments=3, mat=mat_chassis)
    # Recessed inner dark floor beneath typebar basket
    add_beveled_box("BasketWell", (3.60, 1.48, 0.12), (0.0, -0.50, 0.56), bevel_width=0.02, segments=2, mat=mat_rubber)
    # Left & right sculpted shoulder cowls (classic Olivetti Lettera silhouette)
    add_beveled_box("ShoulderLeft", (0.72, 1.88, 0.42), (-2.04, -0.44, 0.74), bevel_width=0.06, segments=3, mat=mat_chassis)
    add_beveled_box("ShoulderRight", (0.72, 1.88, 0.42), (2.04, -0.44, 0.74), bevel_width=0.06, segments=3, mat=mat_chassis)
    # Lower stepped front keyboard well housing the 3 round vintage M / C / P keys
    add_beveled_box("KeyboardDeck", (4.54, 2.14, 0.36), (0.0, -2.26, 0.19), bevel_width=0.12, segments=3, mat=mat_chassis)
    # Subtle front brushed-chrome trim rail separating upper cowl from key well
    add_beveled_box("FrontTrimBar", (4.42, 0.055, 0.048), (0.0, -1.32, 0.63), bevel_width=0.008, segments=2, mat=mat_chrome)

    # Ribbon spools nestled inside left and right ribbon wells
    for sx, side in ((-1.42, "L"), (1.42, "R")):
        add_cylinder_axis(f"RibbonSpoolBase_{side}", 0.34, 0.06, (sx, -0.62, 0.66), axis="Z", segments=32, bevel_end=0.008, mat=mat_steel)
        add_cylinder_axis(f"RibbonSpoolHub_{side}", 0.11, 0.11, (sx, -0.62, 0.69), axis="Z", segments=24, bevel_end=0.01, mat=mat_brass)
        add_cylinder_axis(f"RibbonTape_{side}", 0.28, 0.04, (sx, -0.62, 0.68), axis="Z", segments=32, bevel_end=0.004, mat=mat_rubber)

    # Vermilion felt arc cushion supporting the resting typebar fan
    felt_segs = 16
    for i in range(felt_segs):
        t = (i / (felt_segs - 1)) - 0.5
        ang = t * 1.65
        fx = math.sin(ang) * 0.98
        fy = 0.05 - math.cos(ang) * 0.98
        add_beveled_box(
            f"FeltSeg_{i}",
            (0.18, 0.08, 0.06),
            (fx, fy, 0.68),
            rotation=(0.0, 0.0, ang),
            bevel_width=0.012,
            segments=2,
            mat=mat_vermilion,
        )

    # ── 2. Fanned Brushed-Steel Typebar Basket + Pivoting Strike Bar ──
    # 13 resting typebars fanned cleanly in semicircular arc toward the strike point (0, 0.04, 0.82)
    bar_count = 13
    for i in range(bar_count):
        if i == bar_count // 2:
            continue  # center bar is ActiveTypebar so it animates cleanly
        frac = (i / (bar_count - 1)) - 0.5
        ang = frac * 1.48
        bx = math.sin(ang) * 0.56
        by = 0.02 - math.cos(ang) * 0.56
        add_beveled_box(
            f"Typebar_{i}",
            (0.032, 0.88, 0.024),
            (bx, by, 0.72),
            rotation=(0.14, 0.0, ang),
            bevel_width=0.004,
            segments=1,
            mat=mat_steel,
        )
        # Miniature embossed steel type slug at resting tip
        sx = math.sin(ang) * 0.94
        sy = 0.02 - math.cos(ang) * 0.94
        add_beveled_box(
            f"TypeSlug_{i}",
            (0.068, 0.095, 0.052),
            (sx, sy, 0.78),
            rotation=(0.14, 0.0, ang),
            bevel_width=0.006,
            segments=1,
            mat=mat_chrome,
        )

    # Animated central striking typebar pivoted at (0, -0.05, 0.66)
    active_pivot = bpy.data.objects.new("ActiveTypebarPivot", None)
    bpy.context.collection.objects.link(active_pivot)
    active_pivot.location = Vector((0.0, -0.06, 0.66))
    add_beveled_box("ActiveTypebarArm", (0.038, 0.88, 0.026), (0.0, -0.46, 0.05), bevel_width=0.005, segments=1, mat=mat_chrome, parent=active_pivot)
    add_beveled_box("ActiveTypebarSlug", (0.085, 0.11, 0.065), (0.0, -0.88, 0.11), bevel_width=0.008, segments=1, mat=mat_brass, parent=active_pivot)

    # Chrome ribbon vibrator fork + subtle ink ribbon strip right in front of platen strike zone
    add_beveled_box("RibbonGuideL", (0.05, 0.04, 0.24), (-0.18, 0.02, 0.86), bevel_width=0.006, segments=1, mat=mat_chrome)
    add_beveled_box("RibbonGuideR", (0.05, 0.04, 0.24), (0.18, 0.02, 0.86), bevel_width=0.006, segments=1, mat=mat_chrome)
    add_beveled_box("InkRibbonStrip", (2.82, 0.012, 0.09), (0.0, -0.18, 0.78), bevel_width=0.002, segments=1, mat=mat_rubber)

    # Stepped keyboard. M, C and P have separate stems for the live action.
    ivory = make_material('KeyEnamel', (.64,.61,.50), metallic=.03, roughness=.32)
    ink = make_material('KeyInk', (.034,.031,.026), roughness=.55)
    for row, keys in enumerate(["1234567890", "QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM,."]):
        for column, letter in enumerate(keys):
            x = (column-(len(keys)-1)/2)*.407 + [.0,-.035,.04,.09][row]
            y = -1.48 - row*.395
            z = .70 - row*.061
            if letter in 'MCP':
                idx = 'MCP'.index(letter)
                cap = make_material(f"TypeKeyCap{idx}", (.055,.06,.055), roughness=.48)
                root = add_keycap(f"TypeKey{idx}", (x,y,z), mat_chrome, cap)
            else:
                root = add_keycap(f"Key_{row}_{column}", (x,y,z), mat_chrome, ivory)
                glyph = bpy.data.curves.new('Key legend','FONT')
                glyph.body = letter
                glyph.align_x, glyph.align_y = 'CENTER','CENTER'
                glyph.size = .25
                glyph.resolution_u = 4
                label = bpy.data.objects.new(f'Legend_{row}_{column}', glyph)
                bpy.context.collection.objects.link(label)
                label.parent = root
                label.location = (0,0,.069)
                label.data.materials.append(ink)
                bpy.context.view_layer.objects.active = label
                label.select_set(True)
                bpy.ops.object.convert(target='MESH')
                label.select_set(False)
            root.scale = (.73,.73,.85)
    add_beveled_box("SpaceBar", (2.72,.26,.15), (0,-3.07,.46),
                    bevel_width=.055, segments=5, mat=mat_rubber)

    # ── 4. Sliding Carriage Assembly (Platen + Knobs + Paper Bail + Paper Table + Paper Sheet) ──
    carriage_root = bpy.data.objects.new("CarriageRoot", None)
    bpy.context.collection.objects.link(carriage_root)
    carriage_root.location = Vector((0.0, 0.0, 0.0))

    # Brushed steel carriage rail bed
    add_beveled_box("CarriageRail", (4.55, 0.52, 0.22), (0.0, 0.42, 0.62), bevel_width=0.03, segments=2, mat=mat_steel, parent=carriage_root)
    # Matte black rubber platen roller along X at (y=0.32, z=0.82)
    add_cylinder_axis("PlatenRoller", 0.275, 4.18, (0.0, 0.32, 0.82), axis="X", segments=48, bevel_end=0.015, mat=mat_rubber, parent=carriage_root)
    # Steel platen axle rod extending through cheeks to knobs
    add_cylinder_axis("PlatenAxle", 0.068, 5.15, (0.0, 0.32, 0.82), axis="X", segments=24, bevel_end=0.008, mat=mat_chrome, parent=carriage_root)
    # Brushed chrome carriage end cheeks
    add_beveled_box("CarriageCheekL", (0.14, 0.76, 0.66), (-2.16, 0.38, 0.84), bevel_width=0.025, segments=2, mat=mat_chrome, parent=carriage_root)
    add_beveled_box("CarriageCheekR", (0.14, 0.76, 0.66), (2.16, 0.38, 0.84), bevel_width=0.025, segments=2, mat=mat_chrome, parent=carriage_root)
    # Twin knurled platen carriage knobs
    add_knurled_knob("PlatenKnobL", 0.23, 0.32, (-2.54, 0.32, 0.82), mat_chrome, mat_chassis, parent=carriage_root)
    add_knurled_knob("PlatenKnobR", 0.23, 0.32, (2.54, 0.32, 0.82), mat_chrome, mat_chassis, parent=carriage_root)

    # Brushed chrome paper bail bar + dual miniature rubber pinch rollers + red scale ticks
    add_cylinder_axis("PaperBailBar", 0.028, 4.16, (0.0, 0.28, 1.17), axis="X", segments=20, bevel_end=0.004, mat=mat_chrome, parent=carriage_root)
    add_cylinder_axis("PinchRollerL", 0.062, 0.22, (-1.18, 0.28, 1.17), axis="X", segments=24, bevel_end=0.008, mat=mat_rubber, parent=carriage_root)
    add_cylinder_axis("PinchRollerR", 0.062, 0.22, (1.18, 0.28, 1.17), axis="X", segments=24, bevel_end=0.008, mat=mat_rubber, parent=carriage_root)
    # Chrome bail arms connecting to cheeks
    add_beveled_box("BailArmL", (0.04, 0.16, 0.22), (-2.06, 0.30, 1.07), bevel_width=0.008, segments=1, mat=mat_chrome, parent=carriage_root)
    add_beveled_box("BailArmR", (0.04, 0.16, 0.22), (2.06, 0.30, 1.07), bevel_width=0.008, segments=1, mat=mat_chrome, parent=carriage_root)

    # Angled matte-charcoal + chrome-rimmed rear paper table supporting the archival sheet
    add_beveled_box(
        "PaperTableBacking",
        (3.88, 1.65, 0.08),
        (0.0, 1.48, 1.24),
        rotation=(0.255, 0.0, 0.0),
        bevel_width=0.02,
        segments=2,
        mat=mat_chassis,
        parent=carriage_root,
    )
    add_beveled_box(
        "PaperTableLip",
        (3.88, 0.08, 0.095),
        (0.0, 2.27, 1.45),
        rotation=(0.255, 0.0, 0.0),
        bevel_width=0.015,
        segments=2,
        mat=mat_chrome,
        parent=carriage_root,
    )

    # Curved chrome carriage return lever on the left side
    add_return_lever("ReturnLever", mat_chrome, mat_vermilion, parent=carriage_root)

    # Archival cream cotton bond sheet emerging from platen
    add_curved_paper("PaperSheet", width=3.36, mat_paper=mat_paper, parent=carriage_root)

    # Save .blend and export Draco-compressed .glb
    os.makedirs(os.path.dirname(BLEND_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(GLB_OUT), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND_OUT)
    bpy.ops.export_scene.gltf(
        filepath=GLB_OUT,
        export_format="GLB",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_apply=True,
    )
    print(f"Saved {BLEND_OUT} and {GLB_OUT}")


if __name__ == "__main__":
    build()
