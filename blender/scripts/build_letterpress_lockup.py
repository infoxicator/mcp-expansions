import math
import os
import bpy
import bmesh
from mathutils import Vector

OUT_BLEND = os.path.abspath("blender/letterpress-lockup.blend")
OUT_GLB = os.path.abspath("assets/models/letterpress-lockup.glb")


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


def add_beveled_box(name, size, location, bevel_width=0.025, segments=3, mat=None, parent=None):
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


def add_cylinder_z(name, radius, height, location, segments=28, bevel_end=0.008, mat=None, parent=None):
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

    mat_chase = make_material("BluedSteelChase", (0.06, 0.065, 0.075), metallic=0.72, roughness=0.42)
    mat_bed = make_material("IronPressBed", (0.028, 0.030, 0.034), metallic=0.35, roughness=0.72)
    mat_wood = make_material("CherryFurniture", (0.34, 0.16, 0.08), metallic=0.0, roughness=0.52)
    mat_brass = make_material("QuoinBrass", (0.78, 0.63, 0.32), metallic=0.92, roughness=0.26)
    mat_lead = make_material("CastLeadType", (0.48, 0.50, 0.54), metallic=0.88, roughness=0.34)
    mat_slug_face = make_material("LeadSlugFace", (0.32, 0.34, 0.36), metallic=0.8, roughness=0.32)
    mat_cotton = make_material("CottonProofSheet", (0.94, 0.91, 0.85), metallic=0.0, roughness=0.90)

    # 1. Left side: Cast-Iron / Blued-Steel Letterpress Chase Frame
    cx = -1.42
    chase_w = 2.46
    chase_d = 3.24
    chase_h = 0.44
    frame_t = 0.24

    # Dark cast-iron press bed beneath the chase
    add_beveled_box("PressBed", (chase_w - 0.14, chase_d - 0.14, 0.08), (cx, 0.0, 0.04), bevel_width=0.01, segments=1, mat=mat_bed)

    # 4 heavy perimeter steel chase bars
    add_beveled_box("ChaseTop", (chase_w, frame_t, chase_h), (cx, chase_d * 0.5 - frame_t * 0.5, chase_h * 0.5), bevel_width=0.022, segments=3, mat=mat_chase)
    add_beveled_box("ChaseBot", (chase_w, frame_t, chase_h), (cx, -chase_d * 0.5 + frame_t * 0.5, chase_h * 0.5), bevel_width=0.022, segments=3, mat=mat_chase)
    add_beveled_box("ChaseLeft", (frame_t, chase_d, chase_h), (cx - chase_w * 0.5 + frame_t * 0.5, 0.0, chase_h * 0.5), bevel_width=0.022, segments=3, mat=mat_chase)
    add_beveled_box("ChaseRight", (frame_t, chase_d, chase_h), (cx + chase_w * 0.5 - frame_t * 0.5, 0.0, chase_h * 0.5), bevel_width=0.022, segments=3, mat=mat_chase)

    # Oiled hardwood letterpress furniture blocks packing the chase
    add_beveled_box("WoodTop", (1.92, 0.42, 0.34), (cx, 1.12, 0.25), bevel_width=0.016, segments=2, mat=mat_wood)
    add_beveled_box("WoodBot", (1.92, 0.42, 0.34), (cx, -1.12, 0.25), bevel_width=0.016, segments=2, mat=mat_wood)
    add_beveled_box("WoodLeft", (0.28, 1.76, 0.34), (cx - 0.82, 0.0, 0.25), bevel_width=0.016, segments=2, mat=mat_wood)

    # Two machined expanding brass quoins on the right interior margin (rotatable cams!)
    for q_idx, qy in enumerate((0.52, -0.52)):
        q_root = bpy.data.objects.new(f"BrassQuoin{q_idx}", None)
        q_root.location = Vector((cx + 0.78, qy, 0.28))
        bpy.context.collection.objects.link(q_root)
        add_beveled_box(f"QuoinBody{q_idx}", (0.28, 0.68, 0.34), (0.0, 0.0, 0.0), bevel_width=0.02, segments=3, mat=mat_brass, parent=q_root)
        add_cylinder_z(f"QuoinCam{q_idx}", 0.085, 0.38, (0.0, 0.0, 0.02), mat=mat_chase, parent=q_root)

    # Three locked-up movable cast-lead Linotype/Monotype slugs (M, C, P)
    slug_ys = (0.56, 0.0, -0.56)
    for idx, sy in enumerate(slug_ys):
        s_root = bpy.data.objects.new(f"LeadSlug{idx}", None)
        s_root.location = Vector((cx - 0.06, sy, 0.0))
        bpy.context.collection.objects.link(s_root)
        add_beveled_box(f"SlugBar{idx}", (1.18, 0.44, 0.42), (0.0, 0.0, 0.29), bevel_width=0.018, segments=2, mat=mat_lead, parent=s_root)
        add_uv_plane(f"SlugFace{idx}", 1.12, 0.38, (0.0, 0.0, 0.504), make_material(f"LeadSlugFace{idx}", (0.25, 0.26, 0.28), 0.7, 0.35), parent=s_root)

    # 2. Right side: Heavy Cotton-Rag Letterpress Proof Sheet resting cleanly on the studio sweep
    proof_root = bpy.data.objects.new("ProofSheetRoot", None)
    proof_root.location = Vector((1.42, 0.0, 0.0))
    bpy.context.collection.objects.link(proof_root)

    # Subtle thick 600gsm cotton cardstock base
    add_beveled_box("CottonCardBase", (2.52, 3.26, 0.045), (0.0, 0.0, 0.024), bevel_width=0.008, segments=2, mat=mat_cotton, parent=proof_root)
    add_uv_plane("CottonProofFace", 2.50, 3.24, (0.0, 0.0, 0.049), mat_cotton, parent=proof_root)

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
