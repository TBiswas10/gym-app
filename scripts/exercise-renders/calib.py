import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def mk(name, rad, stiff, size):
    mb = bpy.data.metaballs.new(name); mb.resolution = 0.01; mb.render_resolution = 0.01; mb.threshold = 0.6
    e = mb.elements.new(type="ELLIPSOID"); e.radius = rad; e.stiffness = stiff; e.size_x, e.size_y, e.size_z = size
    ob = bpy.data.objects.new(name, mb); sc.collection.objects.link(ob); return ob
for rad, stiff in ((1.0, 3.0), (1.0, 3.5), (1.0, 4.0)):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
    ob = mk("Body", rad, stiff, (0.1, 0.2, 0.3))
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    print("CAL", rad, stiff, "verts", len(me.vertices), "half-extents", round(max(xs), 4), round(max(ys), 4), round(max(zs), 4) if zs else None)
