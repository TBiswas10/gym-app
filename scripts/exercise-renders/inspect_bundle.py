import bpy, sys
p = sys.argv[sys.argv.index("--") + 1]
want = ["Body Male - Realistic", "Body Male - Primitve (Realistic)"]
with bpy.data.libraries.load(p, link=False) as (src, dst):
    dst.collections = [c for c in src.collections if c in want]
for c in dst.collections:
    objs = list(c.all_objects)
    print("COLL", c.name, len(objs))
    for o in objs[:60]:
        n = len(o.data.vertices) if o.type == "MESH" else 0
        print("  OBJ", o.name, o.type, n, tuple(round(x, 2) for x in o.dimensions), "mods:", [m.type for m in o.modifiers], "vg:", len(o.vertex_groups), "parent:", o.parent.name if o.parent else None)
