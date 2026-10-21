import bpy, time, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
print("ENGINES", [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items])
bpy.ops.mesh.primitive_uv_sphere_add(radius=1)
bpy.ops.object.shade_smooth()
cam = bpy.data.cameras.new("c"); co = bpy.data.objects.new("c", cam); sc.collection.objects.link(co); sc.camera = co
co.location = (0, -6, 0); co.rotation_euler = (1.5708, 0, 0)
l = bpy.data.lights.new("l", "AREA"); l.energy = 500; lo = bpy.data.objects.new("l", l); sc.collection.objects.link(lo); lo.location = (2, -4, 3)
sc.render.film_transparent = True
sc.render.resolution_x = sc.render.resolution_y = 400
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = sys.argv[sys.argv.index("--") + 1]
for eng in ("BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "CYCLES"):
    try:
        sc.render.engine = eng
        if eng == "CYCLES": sc.cycles.samples = 24; sc.cycles.device = "CPU"
        t = time.time(); bpy.ops.render.render(write_still=True); print("ENGINE_OK", eng, round(time.time() - t, 2), "s"); break
    except Exception as e:
        print("ENGINE_FAIL", eng, e)
