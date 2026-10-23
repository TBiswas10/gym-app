"""The rest of the plan's lifts. Same conventions as lifts.py. Hands are given relative to the shoulder (rhand) and feet relative to the hip (rank),
so a pose keeps working if the torso moves. World: +X forward, +Y the figure's left, +Z up, floor at z = 0.
"""
import math

from mathutils import Vector

from props import Barbell, Dumbbell, box, box_dir, cable_tower, cyl_between, grip, line, mid, place_cyl, tube
from lifts import incline_bench

STAND = dict(pelvis=(0, 0, 0.905), pelvis_pitch=0, lumbar=0, chest=0, neck=0, head=0, rank=(-0.05, 0.04, -0.808), foot=0,
             arm_pole=(-0.4, 0.4, -0.8), leg_pole=(1.0, 0.05, 0.2))


def pose(base, **kw):
    d = dict(base)
    d.update(kw)
    return d


def seated(seat_top=0.45, x=0.0, pitch=0, neck=8, ank=(0.42, 0.17, 0.085), **kw):
    d = dict(pelvis=(x, 0, seat_top + 0.125), pelvis_pitch=pitch, lumbar=0, chest=0, neck=neck, head=0,
             ankleL=(ank[0], ank[1], ank[2]), ankleR=(ank[0], -ank[1], ank[2]), foot=0,
             arm_pole=(-0.4, 0.4, -0.8), leg_pole=(1.0, 0.1, 0.3))
    d.update(kw)
    return d


def grip_tube(name, along="Y", length=0.14, r=0.017):
    return cyl_between(name, (0, 0, 0), (0.1, 0, 0), r)


def put_grips(grips, fig, axis=(0, 1, 0), half=0.07):
    for s, g in grips.items():
        h = grip(fig, s)
        a = Vector(axis) * half
        place_cyl(g, h - a, h + a, 0.017)


# ------------------------------------------------------------------ shoulder press (machine)
def shoulder_props():
    box("seat", (0.40, 0.40, 0.10), (0.0, 0, 0.40), mat="pad")
    box("back", (0.09, 0.40, 0.72), (-0.17, 0, 0.9), (0, -8, 0), mat="pad")
    box("post", (0.08, 0.16, 1.7), (-0.33, 0, 0.85))
    box("base", (0.7, 0.5, 0.05), (0.0, 0, 0.025))
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0, 0.1, 0), 0.017) for s in "LR"}
    return lambda P, fig: put_grips(g, fig, axis=(1, 0, 0), half=0.07)


SHOULDER = dict(
    slug="shoulder", highlight=("frontdelt", "sidedelt"), secondary=("triceps",), props=shoulder_props,
    A=seated(0.45, 0.0, -2, 8, rhandL=(0.10, 0.30, 0.10), rhandR=(0.10, 0.30, 0.10), arm_pole=(-0.5, 0.9, -0.6)),
    B=dict(rhandL=(0.02, 0.18, 0.64), rhandR=(0.02, 0.18, 0.64)),
    cam=dict(center=(0.1, 0, 0.9), scale=1.9, az=45, el=10),
)


# ------------------------------------------------------------------ rear delt fly (reverse pec deck)
def reardelt_props():
    box("seat", (0.40, 0.40, 0.10), (-0.05, 0, 0.40), mat="pad")
    box("pad", (0.10, 0.42, 0.40), (0.17, 0, 0.74), (0, 8, 0), mat="pad")
    box("post", (0.10, 0.2, 1.3), (0.30, 0, 0.65))
    box("base", (0.9, 0.55, 0.05), (0.1, 0, 0.025))
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0, 0, 0.1), 0.017) for s in "LR"}
    return lambda P, fig: put_grips(g, fig, axis=(0, 0, 1), half=0.07)


REARDELT = dict(
    slug="reardelt", highlight=("reardelt",), secondary=("midback", "traps"), props=reardelt_props,
    A=seated(0.45, -0.07, 10, -6, rhandL=(0.56, 0.14, 0.0), rhandR=(0.56, 0.14, 0.0), arm_pole=(0.0, 0.2, -1.0), ank=(0.30, 0.17, 0.085)),
    B=dict(rhandL=(-0.04, 0.60, 0.02), rhandR=(-0.04, 0.60, 0.02)),
    cam=dict(center=(0.1, 0, 0.88), scale=2.0, az=125, el=10),
)


# ------------------------------------------------------------------ leg extension
def legext_props():
    box("seat", (0.40, 0.40, 0.10), (-0.05, 0, 0.40), mat="pad")
    box("back", (0.09, 0.40, 0.62), (-0.24, 0, 0.78), (0, -10, 0), mat="pad")
    box("post", (0.10, 0.2, 1.0), (-0.38, 0, 0.5))
    box("base", (1.0, 0.5, 0.05), (0.1, 0, 0.025))
    pad = cyl_between("shinpad", (0, -0.2, 0), (0, 0.2, 0), 0.045, "pad")
    arm = line("lever", 0.02)
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0, 0, 0.1), 0.017) for s in "LR"}

    def update(P, fig):
        a = (fig.pos("ankleL") + fig.pos("ankleR")) / 2 + Vector((0.045, 0, 0.03))
        place_cyl(pad, a + Vector((0, -0.21, 0)), a + Vector((0, 0.21, 0)), 0.045)
        place_cyl(arm, a, Vector((-0.05, 0, 0.30)), 0.02)
        for s, sd in (("L", 1), ("R", -1)):
            place_cyl(g[s], Vector((0.05, 0.26 * sd, 0.60)), Vector((0.05, 0.26 * sd, 0.72)), 0.017)
    return update


LEGEXT = dict(
    slug="legext", highlight=("quads",), secondary=(), props=legext_props,
    A=seated(0.45, -0.05, -6, 8, ankleL=(0.30, 0.10, 0.14), ankleR=(0.30, -0.10, 0.14), handL=(0.05, 0.26, 0.64), handR=(0.05, -0.26, 0.64), leg_pole=(0.3, 0.0, 1.0)),
    B=dict(ankleL=(0.76, 0.10, 0.50), ankleR=(0.76, -0.10, 0.50)),
    cam=dict(center=(0.25, 0, 0.62), scale=2.0, az=70, el=8),
)


# ------------------------------------------------------------------ seated calf raise
def calf_props():
    box("seat", (0.40, 0.40, 0.10), (-0.08, 0, 0.40), mat="pad")
    box("kneepad", (0.22, 0.42, 0.09), (0.30, 0, 0.665), mat="pad")
    box("plate", (0.06, 0.42, 0.22), (0.50, 0, 0.10), (0, -20, 0))
    box("post", (0.08, 0.14, 0.9), (0.62, 0, 0.45))
    box("base", (1.0, 0.5, 0.05), (0.15, 0, 0.025))
    return lambda P, fig: None


CALF = dict(
    slug="calf", highlight=("calves",), secondary=(), props=calf_props,
    A=seated(0.45, -0.08, -4, 8, ankleL=(0.36, 0.11, 0.115), ankleR=(0.36, -0.11, 0.115), foot=-8, handL=(0.15, 0.17, 0.64), handR=(0.15, -0.17, 0.64), leg_pole=(1.0, 0.0, 0.6)),
    B=dict(ankleL=(0.36, 0.11, 0.19), ankleR=(0.36, -0.11, 0.19), foot=38),
    cam=dict(center=(0.22, 0, 0.5), scale=1.7, az=105, el=8),
)


# ------------------------------------------------------------------ low cable row
def row_props():
    box("seat", (0.34, 0.40, 0.10), (-0.15, 0, 0.40), mat="pad")
    box("footplate", (0.05, 0.5, 0.34), (0.62, 0, 0.30), (0, 12, 0))
    box("bench", (1.0, 0.3, 0.05), (0.25, 0, 0.025))
    top = cable_tower(1.25, pulley_z=0.42)
    bar = cyl_between("vbar", (0, -0.1, 0), (0, 0.1, 0), 0.016)
    cab = line("cable")

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(bar, m + Vector((0, -0.1, 0)), m + Vector((0, 0.1, 0)), 0.016)
        place_cyl(cab, m, top, 0.005)
    return update


ROW = dict(
    slug="row", highlight=("midback", "lats"), secondary=("biceps", "reardelt"), props=row_props,
    A=dict(pelvis=(-0.15, 0, 0.575), pelvis_pitch=0, lumbar=0, chest=22, neck=-8, head=0, rank=(0.78, 0.04, -0.14), foot=-10,
           rhand=(0.58, 0.09, -0.34), arm_pole=(-0.1, 0.3, -1.0), leg_pole=(0.4, 0.0, 1.0)),
    B=dict(chest=-6, neck=4, rhand=(0.12, 0.13, -0.42)),
    cam=dict(center=(0.4, 0, 0.7), scale=2.4, az=60, el=8),
)

# ------------------------------------------------------------------ lying leg curl
def legcurl_props():
    box("pad", (1.15, 0.32, 0.10), (0.05, 0, 0.42), (0, -6, 0), mat="pad")
    box("base", (1.3, 0.55, 0.05), (0.0, 0, 0.025))
    for x in (-0.45, 0.4):
        box("leg", (0.07, 0.07, 0.4), (x, 0.1, 0.22))
        box("leg2", (0.07, 0.07, 0.4), (x, -0.1, 0.22))
    roller = cyl_between("roller", (0, -0.2, 0), (0, 0.2, 0), 0.045, "pad")
    arm = line("lever", 0.02)
    g = {s: cyl_between("grip" + s, (0, 0, 0), (0, 0, 0.1), 0.017) for s in "LR"}

    def update(P, fig):
        a = (fig.pos("ankleL") + fig.pos("ankleR")) / 2 + Vector((0, 0, 0.07))
        place_cyl(roller, a + Vector((0, -0.2, 0)), a + Vector((0, 0.2, 0)), 0.045)
        place_cyl(arm, a, Vector((-0.55, 0, 0.35)), 0.02)
    return update


LEGCURL = dict(
    slug="legcurl", highlight=("hamstrings",), secondary=("calves", "glutes"), props=legcurl_props,
    A=dict(pelvis=(-0.05, 0, 0.58), pelvis_pitch=90, lumbar=-8, chest=-10, neck=-52, head=0,
           handL=(0.58, 0.17, 0.50), handR=(0.58, -0.17, 0.50), rank=(-0.80, 0.03, 0.02), foot=70, arm_pole=(0, 0.6, -1.0), leg_pole=(0.0, 0.0, -1.0)),
    B=dict(rank=(-0.36, 0.03, 0.50)),
    cam=dict(center=(0.0, 0, 0.62), scale=2.3, az=55, el=10),
)


# ------------------------------------------------------------------ cable crunch (kneeling)
def crunch_props():
    top = cable_tower(0.95, pulley_z=2.0)
    box("mat", (0.9, 0.5, 0.04), (-0.1, 0, 0.02), mat="pad")
    rope = line("rope")

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(rope, m, top, 0.006)
    return update


CRUNCH = dict(
    slug="cablecrunch", highlight=("abs",), secondary=("obliques",), props=crunch_props,
    A=dict(pelvis=(0.0, 0, 0.50), pelvis_pitch=0, lumbar=4, chest=2, neck=0, head=0, rank=(-0.40, 0.05, -0.43), foot=70,
           rhand=(0.13, 0.10, 0.12), arm_pole=(-0.3, 0.8, -0.5), leg_pole=(0.2, 0.0, -1.0)),
    B=dict(pelvis_pitch=6, lumbar=38, chest=34, neck=10),
    cam=dict(center=(0.2, 0, 0.8), scale=2.15, az=75, el=8),
)

# ------------------------------------------------------------------ incline dumbbell press
def incline_press_props():
    incline_bench(45.0)
    dbs = {s: Dumbbell("db" + s) for s in "LR"}

    def update(P, fig):
        for s in "LR":
            dbs[s].place(grip(fig, s))
    return update


INCLINE = dict(
    slug="incline", highlight=("chest",), secondary=("frontdelt", "triceps"), props=incline_press_props,
    A=dict(pelvis=(-0.03, 0, 0.585), pelvis_pitch=-45, lumbar=0, chest=0, neck=30, head=0, ankleL=(0.30, 0.17, 0.085), ankleR=(0.30, -0.17, 0.085), foot=0,
           rhand=(0.12, 0.31, 0.10), arm_pole=(-0.3, 0.9, -0.9), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(rhand=(0.46, 0.17, 0.44)),
    cam=dict(center=(0.0, 0, 0.78), scale=1.95, az=48, el=12),
)

# ------------------------------------------------------------------ lateral raise (dumbbells, standing)
def lateral_props():
    dbs = {s: Dumbbell("db" + s) for s in "LR"}

    def update(P, fig):
        for s in "LR":
            dbs[s].place(grip(fig, s), yaw=90)
    return update


LATERAL = dict(
    slug="lateral", highlight=("sidedelt",), secondary=("traps",), props=lateral_props,
    A=pose(STAND, rhand=(0.03, 0.15, -0.62), arm_pole=(-0.5, 0.4, -0.4)),
    B=dict(rhand=(0.06, 0.62, 0.04), arm_pole=(-0.6, 0.0, -0.4)),
    cam=dict(center=(0.0, 0, 0.9), scale=2.15, az=30, el=6, shadow=(0.0, 0.7, 0.5)),
)

# ------------------------------------------------------------------ hammer curl
HAMMER = dict(
    slug="hammer", highlight=("biceps",), secondary=("forearms",), props=lateral_props,
    A=pose(STAND, rhand=(0.0, 0.14, -0.64), arm_pole=(-0.6, 0.2, -0.3)),
    B=dict(rhand=(0.20, 0.13, -0.06)),
    cam=dict(center=(0.0, 0, 0.9), scale=2.15, az=40, el=6, shadow=(0.0, 0.7, 0.5)),
)


# ------------------------------------------------------------------ cable curl (standing, low pulley)
def cablecurl_props():
    low = cable_tower(0.95, pulley_z=0.2)
    bar = cyl_between("bar", (0, -0.2, 0), (0, 0.2, 0), 0.016)
    cab = line("cable")

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(bar, m + Vector((0, -0.2, 0)), m + Vector((0, 0.2, 0)), 0.016)
        place_cyl(cab, m, low, 0.005)
    return update


CABLECURL = dict(
    slug="cablecurl", highlight=("biceps",), secondary=("forearms",), props=cablecurl_props,
    A=pose(STAND, rhand=(0.04, 0.17, -0.63), arm_pole=(-0.6, 0.3, -0.3)),
    B=dict(rhand=(0.22, 0.14, -0.04)),
    cam=dict(center=(0.35, 0, 0.9), scale=2.4, az=50, el=6),
)


# ------------------------------------------------------------------ triceps pushdown (standing, high pulley)
def pushdown_props():
    top = cable_tower(0.75, pulley_z=2.05)
    bar = cyl_between("bar", (0, -0.2, 0), (0, 0.2, 0), 0.016)
    cab = line("cable")

    def update(P, fig):
        m = (grip(fig, "L") + grip(fig, "R")) / 2
        place_cyl(bar, m + Vector((0, -0.17, 0)), m + Vector((0, 0.17, 0)), 0.016)
        place_cyl(cab, m, top, 0.005)
    return update


PUSHDOWN = dict(
    slug="triceps", highlight=("triceps",), secondary=("forearms",), props=pushdown_props,
    A=pose(STAND, chest=8, rhand=(0.26, 0.11, -0.16), arm_pole=(-1.0, 0.1, -0.4)),
    B=dict(rhand=(0.10, 0.12, -0.62)),
    cam=dict(center=(0.3, 0, 0.95), scale=2.4, az=55, el=6),
)

# ------------------------------------------------------------------ chest-supported row (incline bench, dumbbells)
def chestrow_props():
    n = Vector((0.707, 0, 0.707))
    box_dir("pad", (0.8, 0.34, 0.08), (0.30, 0, 0.88), tuple(n), mat="pad")
    tube("p1", (0.55, 0.1, 0.05), (0.52, 0.1, 0.9), 0.022)
    tube("p2", (0.55, -0.1, 0.05), (0.52, -0.1, 0.9), 0.022)
    box("foot", (0.1, 0.55, 0.05), (0.55, 0, 0.025))
    box("foot2", (0.1, 0.55, 0.05), (-0.05, 0, 0.025))
    tube("brace", (-0.05, 0, 0.05), (0.2, 0, 0.7), 0.02)
    dbs = {s: Dumbbell("db" + s) for s in "LR"}

    def update(P, fig):
        for s in "LR":
            dbs[s].place(grip(fig, s))
    return update


CHESTROW = dict(
    slug="chestrow", highlight=("midback", "lats"), secondary=("reardelt", "biceps"), props=chestrow_props,
    A=dict(pelvis=(-0.02, 0, 0.82), pelvis_pitch=45, lumbar=0, chest=0, neck=-45, head=0, rank=(-0.30, 0.05, -0.72), foot=0,
           rhand=(0.0, 0.22, -0.64), arm_pole=(-0.4, 0.6, -0.4), leg_pole=(1.0, 0.0, 0.2)),
    B=dict(rhand=(-0.22, 0.30, -0.22)),
    cam=dict(center=(0.15, 0, 0.8), scale=2.1, az=125, el=10),
)


# ------------------------------------------------------------------ plank (forearms)
def plank_props():
    box("mat", (2.0, 0.7, 0.03), (-0.1, 0, 0.015), mat="pad")
    return lambda P, fig: None


PLANK = dict(
    slug="plank", highlight=("obliques", "frontdelt"), secondary=("abs",), props=plank_props,
    A=dict(pelvis=(-0.18, 0, 0.30), pelvis_pitch=80, lumbar=0, chest=0, neck=-60, head=0,
           handL=(0.56, 0.17, 0.065), handR=(0.56, -0.17, 0.065), rank=(-0.78, 0.04, -0.17), foot=62, arm_pole=(-0.8, 0.2, -0.6), leg_pole=(0.0, 0.0, 1.0)),
    B=dict(pelvis=(-0.18, 0, 0.315)),
    cam=dict(center=(-0.05, 0, 0.35), scale=2.3, az=70, el=8, shadow=(-0.1, 1.2, 0.5)),
)


# ------------------------------------------------------------------ glute bridge / hip thrust (upper back on a bench)
def hipthrust_props():
    box("bench", (0.75, 0.34, 0.06), (-0.62, 0, 0.395), mat="pad")
    box("bleg1", (0.07, 0.34, 0.37), (-0.35, 0, 0.19))
    box("bleg2", (0.07, 0.34, 0.37), (-0.88, 0, 0.19))
    box("mat", (1.6, 0.7, 0.03), (0.0, 0, 0.015), mat="pad")
    bb = Barbell("bb", plate_r=0.17, half=0.55)

    def update(P, fig):
        h = (fig.pos("hipL") + fig.pos("hipR")) / 2
        bb.place(h + Vector((0.02, 0, 0.12)))
    return update


GLUTE = dict(
    slug="glute", highlight=("glutes",), secondary=("hamstrings", "quads"), props=hipthrust_props,
    A=dict(pelvis=(-0.02, 0, 0.15), pelvis_pitch=-50, lumbar=0, chest=0, neck=34, head=0,
           rhand=(0.18, 0.28, -0.1), rank=(0.40, 0.05, -0.11), foot=0, arm_pole=(-0.3, 0.9, -0.6), leg_pole=(0.2, 0.2, 1.0)),
    B=dict(pelvis=(0.06, 0, 0.45), pelvis_pitch=-90, neck=48),
    cam=dict(center=(-0.05, 0, 0.42), scale=1.75, az=100, el=10),
)


# ------------------------------------------------------------------ back extension (45 degree bench)
def backext_props():
    lg = Vector((-0.707, 0, -0.707))
    up = Vector((-0.707, 0, 0.707))
    hip = Vector((0.0, 0, 0.92))
    box_dir("pad", (0.55, 0.30, 0.09), tuple(hip + lg * 0.25 - up * 0.1 + Vector((0.05, 0, 0))), tuple(lg), mat="pad")
    box_dir("footplate", (0.08, 0.36, 0.3), tuple(hip + lg * 0.86 - up * 0.04), tuple(lg), mat="frame")
    tube("a1", tuple(hip + lg * 0.1 - up * 0.12), (0.35, 0.12, 0.04), 0.024)
    tube("a2", tuple(hip + lg * 0.1 - up * 0.12), (0.35, -0.12, 0.04), 0.024)
    tube("b1", tuple(hip + lg * 0.8 - up * 0.12), (-0.5, 0.12, 0.04), 0.024)
    tube("b2", tuple(hip + lg * 0.8 - up * 0.12), (-0.5, -0.12, 0.04), 0.024)
    box("foot1", (0.1, 0.5, 0.05), (0.35, 0, 0.025))
    box("foot2", (0.1, 0.5, 0.05), (-0.5, 0, 0.025))
    return lambda P, fig: None


BACKEXT = dict(
    slug="back", highlight=("midback",), secondary=("glutes", "hamstrings"), props=backext_props,
    A=dict(pelvis=(0.0, 0, 0.94), pelvis_pitch=45, lumbar=30, chest=34, neck=-45, head=0,
           rhand=(0.12, 0.08, -0.12), rank=(-0.60, 0.04, -0.56), foot=45, arm_pole=(0.3, 0.8, 0.2), leg_pole=(0.0, 0.0, 1.0)),
    B=dict(lumbar=-4, chest=-6, neck=-40),
    cam=dict(center=(-0.05, 0, 0.75), scale=2.3, az=70, el=10),
)

LIFTS2 = {l["slug"]: l for l in (SHOULDER, REARDELT, LEGEXT, CALF, ROW, LEGCURL, CRUNCH, INCLINE, LATERAL, HAMMER, CABLECURL, PUSHDOWN, CHESTROW, PLANK, GLUTE, BACKEXT)}
