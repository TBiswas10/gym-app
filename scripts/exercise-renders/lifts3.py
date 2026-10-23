"""Swap-drawer lifts: the backups of the plan's lifts, plus a few common ones. Same conventions as lifts2.py."""
import math

from mathutils import Vector

from props import Barbell, Dumbbell, box, box_dir, cable_tower, cyl_between, grip, line, place_cyl, tube
from lifts import incline_bench
from lifts2 import STAND, pose, seated, put_grips


def pair(prefix="db", yaw=0, roll=0):
    return {s: Dumbbell(prefix + s) for s in "LR"}


def hold(dbs, fig, yaw=0, roll=0):
    for s, d in dbs.items():
        d.place(grip(fig, s), yaw=yaw, roll=roll)


# ------------------------------------------------------------------ assisted pull-up
def assisted_props():
    for y in (-0.55, 0.55):
        box("post", (0.08, 0.08, 2.15), (-0.3, y, 1.075))
    box("beam", (0.08, 1.2, 0.08), (-0.3, 0, 2.15))
    box("base", (1.0, 1.0, 0.05), (0.0, 0, 0.025))
    pad = box("kneepad", (0.34, 0.30, 0.07), (0.0, 0, 0.5), mat="pad")
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0.1, 0, 0), 0.017) for s in "LR"}
    arms = {s: cyl_between("arm" + s, (0, 0, 0), (0, 0, 1), 0.018, "frame") for s in "LR"}

    def update(P, fig):
        pz = (fig.pos("hipL").z + fig.pos("hipR").z) / 2
        pad.location = (0.02, 0, pz - 0.5)
        for s in "LR":
            h = grip(fig, s)
            place_cyl(g[s], h + Vector((-0.07, 0, 0)), h + Vector((0.07, 0, 0)), 0.017)
            place_cyl(arms[s], Vector((-0.3, h.y, 2.15)), h + Vector((-0.07, 0, 0)), 0.018)
    return update


ASSISTED = dict(
    slug="assistedpull", highlight=("lats",), secondary=("biceps", "reardelt"), props=assisted_props,
    A=dict(pelvis=(0.0, 0, 0.9), pelvis_pitch=0, lumbar=0, chest=-2, neck=-8, head=0, handL=(0.06, 0.30, 2.0), handR=(0.06, -0.30, 2.0),
           rank=(-0.42, 0.05, -0.43), foot=70, arm_pole=(-0.2, 1.0, -0.2), leg_pole=(0.2, 0.0, -1.0)),
    B=dict(pelvis=(0.0, 0, 1.28), chest=-8, neck=6),
    cam=dict(center=(0.0, 0, 1.2), scale=2.7, az=135, el=8, shadow=(0.0, 0.8, 0.6)),
)


# ------------------------------------------------------------------ cable lateral raise (one arm, low pulley on the far side)
def cablelateral_props():
    low = cable_tower(0.0, y=-0.95, pulley_z=0.22)
    grip_t = cyl_between("handle", (0, 0, 0), (0, 0.1, 0), 0.016)
    cab = line("cable")

    def update(P, fig):
        h = grip(fig, "L")
        place_cyl(grip_t, h + Vector((0, 0, -0.06)), h + Vector((0, 0, 0.06)), 0.016)
        place_cyl(cab, h, low + Vector((0, 0.1, 0)), 0.005)
    return update


CABLELATERAL = dict(
    slug="cablelateral", arc=dict(rhandL=(0.0, 0.08, -0.17)), highlight=("sidedelt",), secondary=("traps",), props=cablelateral_props,
    A=pose(STAND, rhandL=(0.02, -0.12, -0.60), rhandR=(0.0, 0.14, -0.62), arm_pole=(-0.5, 0.3, -0.4)),
    B=dict(rhandL=(0.05, 0.62, 0.05)),
    cam=dict(center=(0.0, 0, 0.9), scale=2.4, az=25, el=6, shadow=(0.0, 0.9, 0.6)),
)


# ------------------------------------------------------------------ dead bug
def deadbug_props():
    box("mat", (2.0, 0.8, 0.04), (0.0, 0, 0.02), mat="pad")
    return lambda P, fig: None


DEADBUG = dict(
    slug="deadbug", tempo=(1.3, 0.35, 1.5, 0.2), highlight=("abs",), secondary=("obliques",), props=deadbug_props,
    A=dict(pelvis=(0.0, 0, 0.17), pelvis_pitch=-90, lumbar=0, chest=0, neck=14, head=0,
           rhandL=(0.0, 0.12, 0.62), rhandR=(-0.60, 0.1, 0.0),
           rankL=(0.80, 0.03, 0.14), rankR=(0.42, 0.03, 0.40), foot=-20, arm_pole=(0, 0.3, -0.4), leg_pole=(-0.5, 0.0, 1.0)),
    B=dict(rhandL=(-0.60, 0.1, 0.0), rhandR=(0.0, 0.12, 0.62), rankL=(0.42, 0.03, 0.40), rankR=(0.80, 0.03, 0.14)),
    cam=dict(center=(0.05, 0, 0.4), scale=2.3, az=100, el=14, shadow=(0.0, 1.1, 0.5)),
)


# ------------------------------------------------------------------ dumbbell bench press (flat bench)
def flatbench():
    box("pad", (1.25, 0.32, 0.08), (-0.2, 0, 0.45), mat="pad")
    box("f1", (0.07, 0.34, 0.41), (-0.62, 0, 0.205))
    box("f2", (0.07, 0.34, 0.41), (0.2, 0, 0.205))
    box("foot1", (0.07, 0.6, 0.05), (-0.62, 0, 0.025))
    box("foot2", (0.07, 0.6, 0.05), (0.2, 0, 0.025))
    tube("rail", (-0.62, 0, 0.05), (0.2, 0, 0.05), 0.02)


def dbpress_props():
    flatbench()
    dbs = pair()
    return lambda P, fig: hold(dbs, fig)


DBPRESS = dict(
    slug="dbpress", arc=dict(rhand=(0.0, 0.04, 0.0)), highlight=("chest",), secondary=("frontdelt", "triceps"), props=dbpress_props,
    A=dict(pelvis=(0.0, 0, 0.575), pelvis_pitch=-90, lumbar=0, chest=0, neck=14, head=0, rank=(0.40, 0.10, -0.49), foot=0,
           rhand=(0.0, 0.31, 0.08), arm_pole=(-0.2, 0.9, -0.8), leg_pole=(1.0, 0.1, 0.4)),
    B=dict(rhand=(0.0, 0.17, 0.64)),
    cam=dict(center=(-0.05, 0, 0.7), scale=2.05, az=50, el=14),
)


# ------------------------------------------------------------------ dumbbell shoulder press (seated, upright bench)
def dbshoulder_props():
    box("seat", (0.40, 0.34, 0.09), (0.0, 0, 0.405), mat="pad")
    box("back", (0.08, 0.30, 0.6), (-0.17, 0, 0.78), (0, -8, 0), mat="pad")
    box("f1", (0.07, 0.34, 0.37), (0.12, 0, 0.19))
    box("foot1", (0.07, 0.55, 0.05), (0.12, 0, 0.025))
    box("foot2", (0.07, 0.55, 0.05), (-0.32, 0, 0.025))
    tube("strut", (-0.32, 0, 0.05), (-0.2, 0, 0.55), 0.022)
    dbs = pair()
    return lambda P, fig: hold(dbs, fig)


DBSHOULDER = dict(
    slug="dbshoulder", arc=dict(rhand=(0.04, -0.03, 0.0)), highlight=("frontdelt", "sidedelt"), secondary=("triceps",), props=dbshoulder_props,
    A=seated(0.45, 0.0, -4, 8, rhand=(0.10, 0.30, 0.08), arm_pole=(-0.5, 0.9, -0.6)),
    B=dict(rhand=(0.0, 0.19, 0.63)),
    cam=dict(center=(0.05, 0, 0.95), scale=2.1, az=45, el=10),
)


# ------------------------------------------------------------------ one-arm dumbbell row (free hand on a bench)
def dbrow_props():
    box("pad", (0.9, 0.3, 0.08), (0.55, 0, 0.45), mat="pad")
    box("f1", (0.07, 0.3, 0.41), (0.2, 0, 0.205))
    box("f2", (0.07, 0.3, 0.41), (0.9, 0, 0.205))
    d = Dumbbell("db")
    return lambda P, fig: d.place(grip(fig, "R"))


DBROW = dict(
    slug="dbrow", arc=dict(rhandR=(0.0, 0.0, 0.05)), highlight=("lats", "midback"), secondary=("reardelt", "biceps"), props=dbrow_props,
    A=dict(pelvis=(-0.12, 0, 0.86), pelvis_pitch=62, lumbar=0, chest=0, neck=-52, head=0,
           rhandR=(0.02, -0.16, -0.64), handL=(0.42, 0.14, 0.50), rank=(-0.30, 0.05, -0.72), foot=0, arm_pole=(-0.6, 0.3, -0.2), leg_pole=(1.0, 0.0, 0.3)),
    B=dict(rhandR=(-0.18, -0.24, -0.22)),
    cam=dict(center=(0.25, 0, 0.7), scale=2.2, az=70, el=8),
)


# ------------------------------------------------------------------ overhead cable triceps extension (back to the stack)
def overheadtri_props():
    top = cable_tower(-0.85, pulley_z=1.55)
    cab = line("cable")
    rope = cyl_between("rope", (0, -0.1, 0), (0, 0.1, 0), 0.015)

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(rope, m + Vector((0, -0.09, 0)), m + Vector((0, 0.09, 0)), 0.015)
        place_cyl(cab, m, top, 0.005)
    return update


OVERHEADTRI = dict(
    slug="overheadtri", arc=dict(rhand=(-0.05, 0.0, 0.08)), highlight=("triceps",), secondary=("forearms",), props=overheadtri_props,
    A=pose(STAND, chest=-4, rhand=(-0.08, 0.09, 0.22), arm_pole=(-0.2, 0.3, 1.0)),
    B=dict(rhand=(0.28, 0.08, 0.55)),
    cam=dict(center=(-0.15, 0, 1.0), scale=2.4, az=50, el=8),
)


# ------------------------------------------------------------------ preacher curl machine
def preacher_props():
    box("seat", (0.40, 0.36, 0.09), (-0.05, 0, 0.40), mat="pad")
    box_dir("armpad", (0.55, 0.36, 0.08), (0.28, 0, 0.78), (0.5, 0, -0.866), mat="pad")
    box("post", (0.12, 0.3, 0.7), (0.12, 0, 0.35))
    box("base", (0.9, 0.5, 0.05), (0.1, 0, 0.025))
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0, 0, 0.1), 0.017) for s in "LR"}
    return lambda P, fig: put_grips(g, fig, axis=(0, 0, 1), half=0.06)


PREACHER = dict(
    slug="preacher", arc=dict(rhand=(0.06, 0.0, 0.05)), highlight=("biceps",), secondary=("forearms",), props=preacher_props,
    A=seated(0.45, -0.05, 8, 0, ank=(0.32, 0.17, 0.085), rhand=(0.40, 0.11, -0.40), arm_pole=(-0.2, 0.2, -1.0)),
    B=dict(rhand=(0.20, 0.12, 0.05)),
    cam=dict(center=(0.15, 0, 0.85), scale=1.9, az=50, el=10),
)


# ------------------------------------------------------------------ face pull
def facepull_props():
    top = cable_tower(0.95, pulley_z=1.6)
    rope = cyl_between("rope", (0, -0.1, 0), (0, 0.1, 0), 0.015)
    cab = line("cable")

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(rope, m + Vector((0, -0.08, 0)), m + Vector((0, 0.08, 0)), 0.015)
        place_cyl(cab, m, top, 0.005)
    return update


FACEPULL = dict(
    slug="facepull", arc=dict(rhand=(0.0, 0.06, 0.04)), highlight=("reardelt",), secondary=("traps", "midback"), props=facepull_props,
    A=pose(STAND, chest=-3, rhand=(0.62, 0.05, 0.02), arm_pole=(0.0, 0.5, -1.0)),
    B=dict(rhand=(0.08, 0.30, 0.10), arm_pole=(-0.2, 1.0, 0.1)),
    cam=dict(center=(0.35, 0, 1.0), scale=2.4, az=125, el=8),
)

# ------------------------------------------------------------------ goblet squat
def goblet_props():
    d = Dumbbell("db")
    return lambda P, fig: d.place((grip(fig, "L") + grip(fig, "R")) / 2 + Vector((0.0, 0, -0.07)), roll=90)


GOBLET = dict(
    slug="goblet", highlight=("quads",), secondary=("glutes",), props=goblet_props,
    A=pose(STAND, chest=-2, rhand=(0.20, 0.06, -0.14), arm_pole=(-0.2, 0.8, -0.8), rank=(-0.05, 0.12, -0.808)),
    B=dict(pelvis=(-0.2, 0, 0.56), pelvis_pitch=22, lumbar=4, chest=4, neck=-18, rank=(0.28, 0.12, -0.46), foot=0, leg_pole=(1.0, 0.2, 0.0)),
    cam=dict(center=(0.0, 0, 0.8), scale=2.25, az=50, el=8),
)

# ------------------------------------------------------------------ hack squat
def hack_props():
    n = Vector((-0.342, 0, 0.94))
    box_dir("backpad", (1.3, 0.34, 0.09), tuple(Vector((-0.12, 0, 0.75)) + Vector((0.94, 0, 0.342)) * 0.0 + Vector((-0.1, 0, 0))), tuple(n), mat="pad")
    box_dir("rail", (1.7, 0.06, 0.06), (-0.28, 0.3, 0.8), tuple(n))
    box_dir("rail2", (1.7, 0.06, 0.06), (-0.28, -0.3, 0.8), tuple(n))
    box("platform", (0.45, 0.7, 0.05), (0.3, 0, 0.12), (0, -20, 0))
    box("base", (1.3, 0.8, 0.05), (0.1, 0, 0.025))
    return lambda P, fig: None


HACK = dict(
    slug="hacksquat", highlight=("quads",), secondary=("glutes",), props=hack_props,
    A=dict(pelvis=(0.0, 0, 0.90), pelvis_pitch=-20, lumbar=0, chest=0, neck=14, head=0,
           ankleL=(0.22, 0.17, 0.17), ankleR=(0.22, -0.17, 0.17), foot=0, rhand=(0.0, 0.2, -0.60), arm_pole=(-0.5, 0.6, -0.3), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(pelvis=(0.15, 0, 0.58)),
    cam=dict(center=(0.1, 0, 0.8), scale=2.25, az=70, el=8),
)


# ------------------------------------------------------------------ hanging knee raise
def kneeraise_props():
    for y in (-0.55, 0.55):
        box("post", (0.08, 0.08, 2.3), (-0.3, y, 1.15))
    box("beam", (0.08, 1.2, 0.08), (-0.3, 0, 2.3))
    box("base", (0.9, 1.2, 0.05), (-0.2, 0, 0.025))
    bar = cyl_between("bar", (-0.2, -0.3, 2.28), (-0.2, 0.3, 2.28), 0.018)
    return lambda P, fig: None


KNEERAISE = dict(
    slug="kneeraise", highlight=("abs",), secondary=("obliques",), props=kneeraise_props,
    A=dict(pelvis=(-0.2, 0, 1.12), pelvis_pitch=0, lumbar=0, chest=-2, neck=-4, head=0, handL=(-0.18, 0.28, 2.26), handR=(-0.18, -0.28, 2.26),
           rank=(-0.05, 0.04, -0.808), foot=40, arm_pole=(-0.2, 1.0, -0.1), leg_pole=(1.0, 0.0, 0.2)),
    B=dict(pelvis_pitch=-20, lumbar=18, rank=(0.20, 0.04, -0.34), foot=20, leg_pole=(1.0, 0.0, 0.6)),
    cam=dict(center=(-0.1, 0, 1.15), scale=2.7, az=60, el=6, shadow=(-0.1, 0.8, 0.6)),
)


# ------------------------------------------------------------------ dumbbell lunge
def lunge_props():
    dbs = pair()
    return lambda P, fig: hold(dbs, fig)


LUNGE = dict(
    slug="lunge", highlight=("quads",), secondary=("glutes", "hamstrings"), props=lunge_props,
    A=dict(pelvis=(0.0, 0, 0.88), pelvis_pitch=0, lumbar=0, chest=0, neck=0, head=0, rhand=(0.02, 0.15, -0.62), arm_pole=(-0.5, 0.4, -0.4),
           ankleL=(0.42, 0.12, 0.085), ankleR=(-0.40, -0.12, 0.13), foot=0, leg_pole=(1.0, 0.0, 0.3)),
    B=dict(pelvis=(0.0, 0, 0.62), ankleR=(-0.50, -0.12, 0.13)),
    cam=dict(center=(0.0, 0, 0.8), scale=2.4, az=80, el=6),
)


# ------------------------------------------------------------------ dumbbell Romanian deadlift
def rdl_props():
    dbs = pair()
    return lambda P, fig: hold(dbs, fig)


RDL = dict(
    slug="rdl", highlight=("hamstrings",), secondary=("glutes", "midback"), props=rdl_props,
    A=pose(STAND, rhand=(0.06, 0.16, -0.62), arm_pole=(-0.5, 0.4, -0.4)),
    B=dict(pelvis=(-0.28, 0, 0.82), pelvis_pitch=68, lumbar=4, chest=4, neck=-62, rank=(0.14, 0.04, -0.74), leg_pole=(1.0, 0.0, 0.4)),
    cam=dict(center=(0.0, 0, 0.8), scale=2.3, az=85, el=6),
)


# ------------------------------------------------------------------ smith machine incline press
def smithincline_props():
    incline_bench(45.0)
    bar = Barbell("bb", plate_r=0.15, half=0.62)
    for y in (-0.62, 0.62):
        tube("rail", (-0.14, y, 0.05), (-0.14, y, 2.1), 0.02)
        box("rfoot", (0.3, 0.1, 0.05), (-0.14, y, 0.025))
    box("rtop", (0.1, 1.3, 0.06), (-0.14, 0, 2.1))
    return lambda P, fig: bar.place((grip(fig, "L") + grip(fig, "R")) / 2)


SMITHINCLINE = dict(
    slug="smithincline", highlight=("chest",), secondary=("frontdelt", "triceps"), props=smithincline_props,
    A=dict(pelvis=(-0.03, 0, 0.585), pelvis_pitch=-45, lumbar=0, chest=0, neck=30, head=0, ankleL=(0.30, 0.17, 0.085), ankleR=(0.30, -0.17, 0.085), foot=0,
           handL=(-0.14, 0.30, 1.02), handR=(-0.14, -0.30, 1.02), arm_pole=(-0.3, 0.9, -0.9), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(handL=(-0.14, 0.28, 1.50), handR=(-0.14, -0.28, 1.50)),
    cam=dict(center=(0.0, 0, 1.0), scale=2.4, az=50, el=10),
)


# ------------------------------------------------------------------ smith machine Romanian deadlift
def smithrdl_props():
    bar = Barbell("bb", plate_r=0.15, half=0.62)
    for y in (-0.62, 0.62):
        tube("rail", (0.08, y, 0.05), (0.08, y, 1.6), 0.02)
        box("rfoot", (0.3, 0.1, 0.05), (0.08, y, 0.025))
    box("rtop", (0.1, 1.3, 0.06), (0.08, 0, 1.6))
    return lambda P, fig: bar.place((grip(fig, "L") + grip(fig, "R")) / 2)


SMITHRDL = dict(
    slug="smithrdl", highlight=("hamstrings",), secondary=("glutes", "midback"), props=smithrdl_props,
    A=pose(STAND, rhand=(0.06, 0.20, -0.62), arm_pole=(-0.5, 0.4, -0.4)),
    B=dict(pelvis=(-0.28, 0, 0.82), pelvis_pitch=68, lumbar=4, chest=4, neck=-62, rank=(0.14, 0.04, -0.74), leg_pole=(1.0, 0.0, 0.4)),
    cam=dict(center=(0.0, 0, 0.8), scale=2.3, az=85, el=6),
)


# ------------------------------------------------------------------ standing calf raise machine
def standcalf_props():
    box("platform", (0.5, 0.5, 0.12), (0.0, 0, 0.06))
    box("base", (1.2, 0.8, 0.05), (-0.05, 0, 0.025))
    box("post", (0.1, 0.5, 1.45), (-0.38, 0, 0.78))
    pads = {s: box("pad" + s, (0.16, 0.14, 0.09), (0, 0, 0), mat="pad") for s in "LR"}

    def update(P, fig):
        for s in "LR":
            pads[s].location = fig.pos("shoulder" + s) + Vector((-0.01, -0.07 * (1 if s == "L" else -1), 0.075))
    return update


STANDCALF = dict(
    slug="standcalf", tempo=(0.9, 0.7, 1.8, 0.3), highlight=("calves",), secondary=(), props=standcalf_props,
    A=pose(STAND, pelvis=(0, 0, 1.025), rank=(-0.05, 0.1, -0.808), foot=-6, rhand=(0.02, 0.28, 0.16), arm_pole=(-0.4, 0.6, 0.2)),
    B=dict(pelvis=(0, 0, 1.115), foot=40),
    cam=dict(center=(-0.05, 0, 0.8), scale=2.3, az=120, el=8),
)


# ------------------------------------------------------------------ push-up
def pushup_props():
    box("mat", (2.8, 0.8, 0.03), (-0.45, 0, 0.015), mat="pad")
    return lambda P, fig: None


PUSHUP = dict(
    slug="pushup", tempo=(1.1, 0.35, 1.8, 0.3), highlight=("chest",), secondary=("triceps", "frontdelt"), props=pushup_props,
    A=dict(pelvis=(-0.38, 0, 0.52), pelvis_pitch=78, lumbar=0, chest=0, neck=-58, head=0, handL=(0.10, 0.24, 0.045), handR=(0.10, -0.24, 0.045),
           rank=(-0.70, 0.04, -0.40), foot=62, arm_pole=(-0.5, 0.9, 0.0), leg_pole=(0.0, 0.0, 1.0)),
    B=dict(pelvis=(-0.38, 0, 0.27), pelvis_pitch=83, neck=-62),
    cam=dict(center=(-0.1, 0, 0.35), scale=2.3, az=55, el=10, shadow=(-0.1, 1.2, 0.55)),
)


# ------------------------------------------------------------------ pec deck fly
def pecdeck_props():
    box("seat", (0.40, 0.40, 0.10), (-0.05, 0, 0.40), mat="pad")
    box("back", (0.09, 0.42, 0.7), (-0.2, 0, 0.9), (0, -8, 0), mat="pad")
    box("post", (0.12, 0.2, 1.5), (-0.34, 0, 0.75))
    box("base", (0.9, 0.55, 0.05), (0.0, 0, 0.025))
    pads = {s: box("pdl" + s, (0.07, 0.1, 0.34), (0, 0, 0), mat="pad") for s in "LR"}

    def update(P, fig):
        for s in "LR":
            pads[s].location = grip(fig, s) + Vector((0.03, 0, 0))
    return update


PECDECK = dict(
    slug="pecdeck", arc=dict(rhand=(0.05, 0.08, 0.0)), highlight=("chest",), secondary=("frontdelt",), props=pecdeck_props,
    A=seated(0.45, -0.05, -4, 8, rhand=(0.20, 0.55, 0.0), arm_pole=(-0.2, 0.2, -0.8)),
    B=dict(rhand=(0.56, 0.07, 0.0)),
    cam=dict(center=(0.1, 0, 0.92), scale=1.9, az=48, el=10),
)

LIFTS3 = {l["slug"]: l for l in (ASSISTED, CABLELATERAL, DEADBUG, DBPRESS, DBSHOULDER, DBROW, OVERHEADTRI, PREACHER, FACEPULL, GOBLET, HACK, KNEERAISE, LUNGE, RDL, SMITHINCLINE, SMITHRDL, STANDCALF, PUSHUP, PECDECK)}
