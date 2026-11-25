"""Photograph stationary hardware; browser-rendered mechanisms fit the same camera.
Run inside Blender from the project root. Pass instrument IDs after -- to select poses.
"""
import json
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector


LIVE_ASSEMBLIES = {
    "Ball_C", "Ball_M", "Ball_P", "RightPlugRoot", "PaperTapeRoot",
    "CrankAssembly", "RotorM", "RotorC", "RotorP", "CableAssembly",
    "FlipPlugRoot", "PlugLeft", "PlugRight", "CableJacketRef", "ShackleRoot",
    "ProofSheetRoot", "EmbossWheel", "TriggerLever", "CarriageRoot", "ActiveTypebarPivot",
    *(f"Specimen{i}" for i in range(5)),
    *(f"{base}{i}" for base in ["TumblerRing", "LeadSlug", "BrassQuoin", "DymoStrip","TypeKey"]
      for i in range(3)),
}
LIVE_MATERIALS = {
    "CipherFaceplate","OledScreenMat","OledCoverGlass","LedVconn","TerminalLabel",
    "LegendPlateMat","LedCC1","LedCC2","DrawerHeaderMat","DrawerReadoutMat","SolariBezelDecal",
}
PAPER = {'cipher-machine': '868775', 'combination-lock': 'ba9b68', 'destination-blind': '87969d', 'discover-identity': 'b29a7c', 'dymo-embosser': '8baca0', 'flip-contract': 'bb7453', 'jacket-legend': '9caac4', 'letterpress-lockup': 'b7a59e', 'mechanical-typewriter': 'a2a59a', 'newton-protocol': 'c2b29a', 'specimen-drawer': 'a69887', 'the-contract': '81949a'}

FINISH = {
    "MeterMatteBlack": ("292b2d", .14, .56), "MeterBezel": ("151619", .28, .36),
    "CablePaleGreyOvermold": ("bdbdbb", 0, .61), "CablePaleGreyJacket": ("b9bab8", 0, .66),
    "CablePaleGreyStrain": ("afb0ae", 0, .68), "MicroButton": ("333536", .72, .36),
    "CipherChassis": ("343a34", .28, .52), "CipherDeck": ("232925", .4, .39),
    "MatteAnodizedBlack": ("2b2c2b", .64, .50), "FrameMatteBlack": ("242626", .45, .48),
    "BaseGraphiteInset": ("363836", .40, .56), "GunmetalCollar": ("4d5152", .85, .32),
    "BlockMatteBlack": ("394247", .36, .55), "TerminalMatteAlu": ("303332", .6, .51),
    "DrawerMatteCharcoal": ("72766e", .35, .53), "DrawerFeltLiner": ("403e37", 0, .94),
    "DrawerDivider": ("67695e", .27, .52), "SolariFoldedSteel": ("31413e", .40, .46),
    "IronPressBed": ("343735", .6, .57), "CherryFurniture": ("a36e45", 0, .44),
    "DymoMatteBlack": ("a54431", .10, .39), "TypeChassisMatte": ("66877b", .29, .44),
    "LockAnodizedCap": ("29302f", .67, .40),
}


def rgb(value):
    s = [int(value[i:i+2], 16) / 255 for i in (0,2,4)]
    return tuple(x/12.92 if x < .04045 else ((x+.055)/1.055)**2.4 for x in s)


def finish(mat):
    if not mat.use_nodes:
        return
    nodes, link = mat.node_tree.nodes, mat.node_tree.links.new
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        return
    if mat.name in FINISH:
        color, metal, rough = FINISH[mat.name]
        bsdf.inputs["Base Color"].default_value = (*rgb(color), 1)
        bsdf.inputs["Metallic"].default_value = metal
        bsdf.inputs["Roughness"].default_value = rough
    coord = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 245
    noise.inputs["Detail"].default_value = 2
    link(coord.outputs["Object"], noise.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = .0016
    bump.inputs["Strength"].default_value = .29
    link(noise.outputs["Fac"], bump.inputs["Height"])
    link(bump.outputs[0], bsdf.inputs["Normal"])
    roughness = bsdf.inputs["Roughness"].default_value
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = max(.08, roughness-.12)
    ramp.inputs["To Max"].default_value = min(1, roughness+.12)
    link(noise.outputs["Fac"], ramp.inputs["Value"])
    link(ramp.outputs["Result"], bsdf.inputs["Roughness"])
    if mat.name == "CherryFurniture":
        mapping = nodes.new("ShaderNodeVectorMath")
        mapping.operation = "MULTIPLY"
        mapping.inputs[1].default_value = (1, 37, 13)
        link(coord.outputs["Object"], mapping.inputs[0])
        grain = nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 2.3
        grain.inputs["Distortion"].default_value = .24
        link(mapping.outputs[0], grain.inputs[0])
        rings = nodes.new("ShaderNodeValToRGB")
        rings.color_ramp.elements[0].color = (*rgb("774627"),1)
        rings.color_ramp.elements[1].color = (*rgb("c79f77"),1)
        link(grain.outputs["Fac"], rings.inputs[0])
        link(rings.outputs[0], bsdf.inputs["Base Color"])


def is_live(obj):
    if obj.name.startswith(("FlapAxle", "FlapBushing")):
        return True
    if any(m and m.name in LIVE_MATERIALS for m in obj.data.materials):
        return True
    while obj:
        if obj.name in LIVE_ASSEMBLIES:
            return True
        obj = obj.parent
    return False


def vector(js, method):
    values = [float(x) for x in re.search(r'camera\.' + method + r'\(([^)]+)\)', js).group(1).split(',')]
    x,y,z = values
    return Vector((x,-z,y))


def area(name, pos, power, width, height, color):
    light = bpy.data.lights.new(name, 'AREA')
    obj = bpy.data.objects.new(name, light)
    bpy.context.collection.objects.link(obj)
    obj.location = pos
    obj.rotation_euler = (-Vector(pos)).to_track_quat('-Z','Y').to_euler()
    light.shape, light.size, light.size_y = 'RECTANGLE', width, height
    light.energy, light.color = power, color
    return light


def photograph(source):
    name = source.stem
    bpy.ops.wm.open_mainfile(filepath=str(source.resolve()))
    scene = bpy.context.scene
    js = (Path('src/instruments') / (name + '.js')).read_text()
    fixed = []
    for obj in scene.objects:
        if obj.type != "MESH":
            continue
        if is_live(obj):
            obj.hide_render = True
        else:
            fixed.append(obj.name)
    for mat in list(bpy.data.materials):
        finish(mat)

    # Continuous paper sweep with a real bend so the low cradle camera sees no horizon.
    section = [(-50, 0), (5, 0)]
    for i in range(1, 33):
        angle = math.pi/2*i/32
        section.append((5+5*math.sin(angle), 5-5*math.cos(angle)))
    section.append((10,30))
    verts = [(x,y,-.01+z) for y,z in section for x in (-40,40)]
    quads = [(i,i+1,i+3,i+2) for i in range(0,len(verts)-2,2)]
    mesh = bpy.data.meshes.new('Seamless paper')
    mesh.from_pydata(verts,[],quads)
    sweep = bpy.data.objects.new('Paper sweep',mesh)
    bpy.context.collection.objects.link(sweep)
    for f in mesh.polygons: f.use_smooth = True
    paper = bpy.data.materials.new("Uncoated paper")
    paper.use_nodes = True
    finish(paper)
    bsdf = paper.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Specular IOR Level"].default_value = .14
    mesh.materials.append(paper)
    stock = PAPER[name]
    camera = bpy.data.cameras.new('Product lens')
    camera.sensor_fit = 'HORIZONTAL'
    camera.angle = math.radians(float(re.search(r'PerspectiveCamera\(([\d.]+)',js).group(1)))
    pose = bpy.data.objects.new('Product lens',camera)
    bpy.context.collection.objects.link(pose)
    pose.location = vector(js, 'position.set')
    rotation = (vector(js, 'lookAt')-pose.location).to_track_quat('-Z','Y').to_euler()
    roll = re.search(r'camera.rotateZ\(THREE.MathUtils.degToRad\(([-\d.]+)',js)
    if roll: rotation.rotate_axis('Z',math.radians(float(roll.group(1))))
    pose.rotation_euler = rotation
    camera.dof.use_dof = True
    camera.dof.focus_distance = (vector(js,'lookAt')-pose.location).length-.35
    camera.dof.aperture_fstop = 2.8
    scene.camera = pose
    scene.world = bpy.data.worlds.new('Measured studio')
    scene.world.use_nodes = True
    world = scene.world.node_tree
    env = world.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(str(Path('assets/lighting/studio.hdr').resolve()))
    world.links.new(env.outputs[0],world.nodes["Background"].inputs["Color"])
    world.nodes["Background"].inputs["Strength"].default_value = .48
    key = area('Diffusion frame', (-4,-3,7), 790, 5.2, 4.4, (1,.93,.84))
    fill = area('White card', (4.2,-1,3.8), 210, 2.2, 6.2, (.82,.9,1))
    area('Overhead strip', (.3,3,5.8), 375, 5.5, 1.3, (1,.97,.91))
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .035
    scene.cycles.max_bounces = 5
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        devices = prefs.get_devices_for_type('METAL')
        for d in devices: d.use = d.type == 'METAL'
        if any(d.use for d in devices): scene.cycles.device = 'GPU'
    except (TypeError, RuntimeError):
        pass
    scene.render.resolution_x = scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.quality = 94
    scene.view_settings.view_transform = 'AgX'
    dest = Path('assets/plates') / name
    dest.mkdir(parents=True,exist_ok=True)
    (dest / 'hardware.json').write_text(json.dumps(sorted(fixed), separators=(',',':'))+'\n')
    probes = '--probes' in sys.argv
    if probes:
        # A chrome surface sees the diffusion cloth itself. Sample the actual
        # photographic set, including the paper bounce and the measured room.
        for obj in list(scene.objects):
            if obj.type == 'MESH' and obj != sweep:
                obj.hide_render = True
            if obj.type != 'LIGHT':
                continue
            lamp = obj.data
            bpy.ops.mesh.primitive_plane_add(size=1)
            cloth = bpy.context.object
            cloth.matrix_world = obj.matrix_world.copy()
            cloth.scale = (lamp.size, lamp.size_y, 1)
            material = bpy.data.materials.new('Diffuser')
            material.use_nodes = True
            emission = material.node_tree.nodes.new('ShaderNodeEmission')
            emission.inputs['Color'].default_value = (*lamp.color, 1)
            emission.inputs['Strength'].default_value = lamp.energy/(lamp.size*lamp.size_y*3)
            material.node_tree.links.new(emission.outputs[0], material.node_tree.nodes.get('Material Output').inputs[0])
            cloth.data.materials.append(material)
            cloth.visible_diffuse = False
            cloth.visible_shadow = False
        pose.location = (0,0,1.06)
        pose.rotation_euler = (math.pi/2,0,0)
        camera.type = 'PANO'
        camera.panorama_type = 'EQUIRECTANGULAR'
        camera.dof.use_dof = False
        scene.render.resolution_x, scene.render.resolution_y = 512, 256
        scene.render.image_settings.file_format = 'HDR'
        scene.view_settings.view_transform = 'Raw'
    for mode in ['light','dark']:
        bsdf.inputs["Base Color"].default_value = tuple(v*(1 if mode=='light' else .055) for v in rgb(stock))+(1,)
        key.energy = 790 if mode=='light' else 585
        fill.energy = 210 if mode=='light' else 155
        scene.render.filepath = str((dest/(mode+'.webp')).resolve())
        if probes: scene.render.filepath = str((Path('assets/lighting')/(mode+'.hdr')).resolve())
        bpy.ops.render.render(write_still=True)
        print('Photographed', name, mode, flush=True)


targets = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for source in sorted(Path('blender').glob('*.blend')):
    if not targets or source.stem in targets: photograph(source)
