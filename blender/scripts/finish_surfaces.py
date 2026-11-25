"""Rebuild studio shading from the original meshes. Run from the repository root:
blender -b -P blender/scripts/finish_surfaces.py [-- instrument-id ...]
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def prepare_mesh(obj):
    mesh = obj.data
    if not mesh.uv_layers:
        uv = mesh.uv_layers.new(name="Surface")
        for face in mesh.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            directions = [i for i in range(3) if i != axis]
            for index in face.loop_indices:
                pos = mesh.vertices[mesh.loops[index].vertex_index].co
                uv.data[index].uv = tuple(pos[k] for k in directions)

    # Preserve the tangent across a fillet while keeping adjacent milled faces flat.
    if any(len(face.vertices) > 4 for face in mesh.polygons):
        modifier = obj.modifiers.get("Machined face normals") or obj.modifiers.new(
            "Machined face normals", 'WEIGHTED_NORMAL')
        modifier.mode = 'FACE_AREA_WITH_ANGLE'
        modifier.weight = 65


def bake_contact(objects):
    points, faces = [], []
    for obj in objects:
        base = len(points)
        points.extend(obj.matrix_world @ v.co for v in obj.data.vertices)
        faces.extend([[base + n for n in f.vertices] for f in obj.data.polygons])
    bvh = BVHTree.FromPolygons(points, faces)
    rays = []
    for i in range(20):
        radius = math.sqrt((i + 0.5) / 20)
        angle = i * 2.39996323
        rays.append(Vector((radius * math.cos(angle), radius * math.sin(angle),
                            math.sqrt(1 - radius * radius))))
    up = Vector((0, 0, 1))
    for obj in objects:
        mesh = obj.data
        colors = mesh.color_attributes.get("Contact") or mesh.color_attributes.new(
            name="Contact", type='BYTE_COLOR', domain='POINT')
        mesh.color_attributes.active_color = colors
        basis = obj.matrix_world.to_3x3().inverted_safe().transposed()
        for vertex in mesh.vertices:
            normal = (basis @ vertex.normal).normalized()
            if not normal.length_squared:
                colors.data[vertex.index].color = (1, 1, 1, 1)
                continue
            origin = obj.matrix_world @ vertex.co + normal * 0.005
            rotation = up.rotation_difference(normal)
            visibility = 1.0
            for ray in rays:
                _, _, _, distance = bvh.ray_cast(origin, rotation @ ray, 0.24)
                if distance is not None:
                    visibility -= (1 - distance / 0.24) * 0.48 / len(rays)
            colors.data[vertex.index].color = (visibility, visibility, visibility, 1)


def finish(source):
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.context.view_layer.update()
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for obj in objects:
        prepare_mesh(obj)
    bake_contact(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(source.resolve()))
    target = Path('assets/models') / source.with_suffix('.glb').name
    bpy.ops.export_scene.gltf(filepath=str(target.resolve()), export_format='GLB',
        export_apply=True, export_vertex_color='NAME', export_vertex_color_name='Contact',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12)
    print("Finished", source.stem, flush=True)


if __name__ == '__main__':
    targets = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for source in sorted(Path('blender').glob('*.blend')):
        if not targets or source.stem in targets:
            finish(source)
