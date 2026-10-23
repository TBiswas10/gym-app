"""Lift definitions: a start pose, a finish pose, the minimal props you touch, and the camera. Pilot set of three.
Poses are numbers only (see figure.POSE_KEYS). World: +X forward, +Y the figure's left, +Z up, floor at z = 0.
"""
import math

import bpy
from mathutils import Euler, Matrix, Vector

from props import box, box_dir, tube, cyl_between, place_cyl, grip, mid, Dumbbell, _mat


# ======================================================================= chest press (seated machine)
def chest_press_props():
    box("seat", (0.40, 0.40, 0.10), (0.02, 0, 0.40), mat="pad")
    box("back", (0.09, 0.40, 0.66), (-0.17, 0, 0.88), (0, -8, 0), mat="pad")
    box("post", (0.08, 0.14, 1.25), (-0.33, 0, 0.64))
    hs = {s: (cyl_between("grip" + s, (0, 0, 0), (0.1, 0, 0), 0.017), cyl_between("arm" + s, (0, 0, 0), (0.1, 0, 0), 0.013, "frame")) for s in "LR"}

    def update(P, fig):
        for s in "LR":
            h = grip(fig, s)
            place_cyl(hs[s][0], h + Vector((0, -0.06, 0)), h + Vector((0, 0.06, 0)), 0.017)
            place_cyl(hs[s][1], h, h + Vector((-0.12, 0, 0)), 0.013)
    return update


CHEST_PRESS = dict(
    slug="chest",
    highlight=("chest",), secondary=("frontdelt", "triceps"),
    props=chest_press_props,
    A=dict(pelvis=(0, 0, 0.545), pelvis_pitch=0, lumbar=-2, chest=-4, neck=8, head=0,
           handL=(0.24, 0.30, 1.0), handR=(0.24, -0.30, 1.0), ankleL=(0.44, 0.14, 0.085), ankleR=(0.44, -0.14, 0.085), foot=0,
           arm_pole=(-0.7, 0.4, -0.6), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(handL=(0.52, 0.17, 1.03), handR=(0.52, -0.17, 1.03)),
    cam=dict(center=(0.2, 0, 0.72), scale=1.62, az=48, el=10),
)


# ======================================================================= lat pulldown
def lat_pulldown_props():
    box("seat", (0.40, 0.40, 0.10), (-0.03, 0, 0.45), mat="pad")
    box("thighpad", (0.22, 0.34, 0.07), (0.30, 0, 0.72), mat="pad")
    box("post", (0.08, 0.10, 2.25), (0.55, 0, 1.125))
    box("beam", (0.55, 0.10, 0.07), (0.3, 0, 2.2))
    bar = cyl_between("bar", (0, -0.5, 0), (0, 0.5, 0), 0.016)
    cable = cyl_between("cable", (0, 0, 0), (0, 0, 1), 0.006, "frame")

    def update(P, fig):
        hl, hr = grip(fig, "L"), grip(fig, "R")
        m = (hl + hr) / 2
        place_cyl(bar, (m.x, -0.52, m.z), (m.x, 0.52, m.z), 0.016)
        place_cyl(cable, (m.x, 0, m.z), (0.12, 0, 2.18), 0.006)
    return update


LAT_PULLDOWN = dict(
    slug="lat",
    highlight=("lats",), secondary=("biceps", "reardelt"),
    props=lat_pulldown_props,
    A=dict(pelvis=(0, 0, 0.60), pelvis_pitch=0, lumbar=-2, chest=-2, neck=4, head=0,
           handL=(0.12, 0.40, 1.62), handR=(0.12, -0.40, 1.62), ankleL=(0.44, 0.14, 0.085), ankleR=(0.44, -0.14, 0.085), foot=0,
           arm_pole=(-0.15, 1.0, -0.7), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(chest=-12, neck=8, handL=(0.17, 0.33, 1.02), handR=(0.17, -0.33, 1.02)),
    cam=dict(center=(0.1, 0, 0.98), scale=1.95, az=128, el=10),
)


# ======================================================================= leg press (45 degree sled)
TH = math.radians(40)
D = Vector((math.cos(TH), 0, math.sin(TH)))       # the way the sled travels
N = Vector((-math.sin(TH), 0, math.cos(TH)))      # up the plate (toes point this way)
PITCH = -math.degrees(math.atan2(math.cos(TH), math.sin(TH))) - 90  # placeholder, replaced below
PITCH = math.degrees(math.atan2(-math.cos(TH), -math.sin(TH)))     # torso axis points down and back


def leg_press_props():
    hip = Vector((0, 0, 0.62))
    torso = Vector((-math.cos(TH), 0, -math.sin(TH)))
    under = Vector((math.sin(TH), 0, -math.cos(TH)))  # from the body down into the pad / frame
    pad_c = hip + torso * 0.32 + under * 0.17
    box("back", (0.78, 0.44, 0.08), tuple(pad_c), (0, -math.degrees(TH), 0), mat="pad")
    box("seatpad", (0.30, 0.44, 0.08), tuple(hip + under * 0.17 + D * 0.12), (0, -math.degrees(TH), 0), mat="pad")
    for sy in (-0.28, 0.28):
        c = hip + under * 0.26 + D * 0.35
        box("rail", (1.55, 0.05, 0.05), (c.x, sy, c.z), (0, -math.degrees(TH), 0))
        for k in (-0.35, 0.95):
            p = hip + under * 0.26 + D * k
            box("leg", (0.05, 0.05, p.z), (p.x, sy, p.z / 2))
    plate = box("plate", (0.05, 0.62, 0.5), (0, 0, 0), (0, -math.degrees(TH), 0), mat="frame")

    def update(P, fig):
        a = (Vector(P["ankleL"]) + Vector(P["ankleR"])) / 2
        plate.location = a + D * 0.085
    return update


def _leg(dist, y=0.14):
    hip = Vector((0, 0, 0.62))
    # the ankle sits along the sled direction from the hip; the knee points up toward the chest
    a = hip + D * dist
    return (a.x, y, a.z)


LEG_PRESS = dict(
    slug="legpress",
    highlight=("quads",), secondary=("glutes",),
    props=leg_press_props,
    A=dict(pelvis=(0, 0, 0.62), pelvis_pitch=PITCH, lumbar=0, chest=0, neck=12, head=0,
           handL=(-0.05, 0.28, 0.64), handR=(-0.05, -0.28, 0.64), ankleL=_leg(0.52, 0.16), ankleR=_leg(0.52, -0.16), foot=PITCH,
           arm_pole=(-0.3, 0.6, -0.5), leg_pole=(-0.64, 0.25, 0.77)),
    B=dict(ankleL=_leg(0.80, 0.16), ankleR=_leg(0.80, -0.16)),
    cam=dict(center=(0.3, 0, 0.62), scale=2.1, az=84, el=6),
)


# ======================================================================= incline dumbbell curl (seated on an incline bench)
def incline_bench(alpha=60.0):
    a = math.radians(alpha)
    P = Vector((-0.06, 0, 0.46))
    d = Vector((-math.cos(a), 0, math.sin(a)))
    n = Vector((math.sin(a), 0, math.cos(a)))
    box("seatpad", (0.36, 0.30, 0.08), (0.10, 0, 0.42), mat="pad")
    box_dir("backpad", (0.74, 0.30, 0.08), tuple(P + d * 0.38 - n * 0.04), tuple(d), mat="pad")
    box("front_foot", (0.07, 0.52, 0.05), (0.30, 0, 0.025))
    box("rear_foot", (0.07, 0.52, 0.05), (-0.52, 0, 0.025))
    tube("rail", (0.30, 0, 0.05), (-0.52, 0, 0.05), 0.022)
    tube("post_front", (0.26, 0, 0.05), (0.16, 0, 0.38), 0.024)
    tube("post_mid", (-0.12, 0, 0.05), (-0.04, 0, 0.38), 0.024)
    tube("strut", (-0.52, 0, 0.05), tuple(P + d * 0.5 - n * 0.09), 0.024)


def dbcurl_props():
    incline_bench(60.0)
    dbs = {s: Dumbbell("db" + s) for s in "LR"}

    def update(P, fig):
        for s in "LR":
            dbs[s].place(grip(fig, s))
    return update


DB_CURL = dict(
    slug="dbcurl",
    highlight=("biceps",), secondary=("forearms", "frontdelt"),
    props=dbcurl_props,
    A=dict(pelvis=(-0.03, 0, 0.585), pelvis_pitch=-30, lumbar=0, chest=0, neck=24, head=0,
           handL=(-0.30, 0.27, 0.45), handR=(-0.30, -0.27, 0.45), ankleL=(0.30, 0.17, 0.085), ankleR=(0.30, -0.17, 0.085), foot=0,
           arm_pole=(-0.4, 0.3, -1.0), leg_pole=(1.0, 0.1, 0.3)),
    B=dict(handL=(-0.08, 0.25, 1.1), handR=(-0.08, -0.25, 1.1)),
    cam=dict(center=(0.0, 0, 0.72), scale=1.95, az=52, el=12, shadow=(-0.05, 1.0, 0.65)),
)

LIFTS = {l["slug"]: l for l in (CHEST_PRESS, LAT_PULLDOWN, LEG_PRESS, DB_CURL)}
