"""
@file blender/bench.py
@description Measures what a Blender hero shot costs on the machine it runs on, so the budget for hero shots
  (docs/blender.md) rests on numbers. Builds a small technical scene: a ground, a dozen box-like parts (a base, a thin bar and a
  metallic cap each, with PBR materials), a sun and an area light, a camera that tracks the centre.
  1. Stills at 1920x1080 per engine, rendered twice: the first includes shader or kernel compilation, the second is
     the steady cost of one frame.
  2. With EEVEE in the list: a 24-frame camera move at 1920x1080 and at 640x360 (the preview size), timed whole,
     which is the real cost per frame of a shot.
@usage tools/blender/blender.exe -b --factory-startup -P blender/bench.py -- <out_dir> [BLENDER_EEVEE,CYCLES]
"""
import math
import sys
import time

import bpy

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = argv[0] if argv else "."
engines = argv[1].split(",") if len(argv) > 1 else ["BLENDER_EEVEE", "CYCLES"]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def material(name, color, metal=0.0, rough=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


def box(name, loc, scale, mat):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.data.materials.append(mat)
    return o


bpy.ops.mesh.primitive_plane_add(size=40)
bpy.context.active_object.data.materials.append(material("ground", (0.05, 0.06, 0.07), rough=0.9))
base = material("base", (0.0, 0.55, 0.12))
bar = material("bar", (0.75, 0.25, 0.15), rough=0.45)
cap = material("cap", (0.25, 0.5, 0.9), metal=0.85, rough=0.28)
for i in range(12):
    x = -5.5 + i
    box(f"base{i}", (x, 0, 0.1), (0.3, 1.5, 0.1), base)
    box(f"bar{i}", (x, 0, 0.3), (0.08, 1.8, 0.08), bar)
    box(f"cap{i}", (x, 0, 0.6), (0.25, 1.3, 0.06), cap)

bpy.ops.object.light_add(type="SUN", location=(5, -5, 10))
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
bpy.ops.object.light_add(type="AREA", location=(-4, 4, 6))
area = bpy.context.active_object
area.data.energy = 400
area.data.size = 5

bpy.ops.object.empty_add(location=(0, 0, 0.3))
target = bpy.context.active_object
bpy.ops.object.camera_add(location=(9, -9, 6))
cam = bpy.context.active_object
track = cam.constraints.new("TRACK_TO")
track.target = target
track.track_axis = "TRACK_NEGATIVE_Z"
track.up_axis = "UP_Y"
scene.camera = cam

world = bpy.data.worlds.new("world")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.02, 0.025, 0.03, 1)

scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
scene.view_settings.view_transform = "Standard"  # keeps a design palette's colours as given
scene.render.image_settings.file_format = "PNG"

devices = []
results = {}
for eng in engines:
    scene.render.engine = eng
    if eng == "CYCLES":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "OPTIX"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = d.type == "OPTIX"
        devices = [(d.name, d.type, d.use) for d in prefs.devices]
        scene.cycles.device = "GPU"
        scene.cycles.samples = 128
        scene.cycles.use_denoising = True
    times = []
    for k in range(2):
        scene.render.filepath = f"{out}/still-{eng.lower()}-{k + 1}.png"
        t0 = time.time()
        bpy.ops.render.render(write_still=True)
        times.append(round(time.time() - t0, 2))
    results[eng] = {"first_s": times[0], "steady_s": times[1]}

if "BLENDER_EEVEE" in engines:
    scene.render.engine = "BLENDER_EEVEE"
    scene.frame_start, scene.frame_end = 1, 24
    cam.location = (9, -9, 6)
    cam.keyframe_insert("location", frame=1)
    cam.location = (3, -11, 3.5)
    cam.keyframe_insert("location", frame=24)
    for w, h in ((1920, 1080), (640, 360)):
        scene.render.resolution_x, scene.render.resolution_y = w, h
        scene.render.filepath = f"{out}/anim{h}/f_####"
        t0 = time.time()
        bpy.ops.render.render(animation=True)
        total = time.time() - t0
        results[f"EEVEE_anim24_{h}p"] = {"total_s": round(total, 2), "per_frame_s": round(total / 24, 2)}
    results["eevee_taa_render_samples"] = scene.eevee.taa_render_samples

print("BENCH", results)
print("DEVICES", devices)
print("VERSION", bpy.app.version_string)
