"""The rep: a three-phase tempo instead of a straight blend.
  lift (concentric)  fast, cubic-bezier(0.25, 0.1, 0.25, 1)
  hold (peak)        a short squeeze with a slight tremor
  lower (eccentric)  slow and controlled, ease in and out
  rest               a beat at the start before the next rep
Everything else here is small, constant, loop-safe life: breathing, a little weight shift, a slow camera drift."""
import math

from figure import lerp_pose

TEMPO = (1.0, 0.45, 2.2, 0.35)   # seconds: lift, hold, lower, rest


def _bezier(x1, y1, x2, y2, t):
    """cubic-bezier easing: y at the point where x == t."""
    lo, hi = 0.0, 1.0
    for _ in range(40):
        s = (lo + hi) / 2
        x = 3 * (1 - s) ** 2 * s * x1 + 3 * (1 - s) * s * s * x2 + s ** 3
        if x < t:
            lo = s
        else:
            hi = s
    s = (lo + hi) / 2
    return 3 * (1 - s) ** 2 * s * y1 + 3 * (1 - s) * s * s * y2 + s ** 3


def smoother(x):
    x = max(0.0, min(1.0, x))
    return x * x * x * (x * (6 * x - 15) + 10)


def duration(tempo=TEMPO):
    return sum(tempo)


def phase(t, tempo=TEMPO):
    """(u, name, hold_weight): how far through the rep (0 = start pose, 1 = peak) at time t, which phase, and how much of a hold we are in."""
    up, hold, down, rest = tempo
    t = t % duration(tempo)
    if t < up:
        return _bezier(0.25, 0.1, 0.25, 1.0, t / up), "lift", 0.0
    t -= up
    if t < hold:
        return 1.0, "hold", math.sin(math.pi * t / hold) ** 0.5
    t -= hold
    if t < down:
        return 1.0 - smoother(t / down), "lower", 0.0
    return 0.0, "rest", 0.0


def pose_at(lift, A, B, t):
    """The pose of a lift at time t: the blend, an arc through the middle, breathing, weight shift and the peak tremor. Returns (pose, pulse 0..1, u)."""
    tempo = lift.get("tempo", TEMPO)
    T = duration(tempo)
    u, name, hw = phase(t, tempo)
    p = lerp_pose(A, B, u)
    s = math.sin(math.pi * u)
    for k, v in lift.get("arc", {}).items():     # a path that bows instead of a straight line (an elbow leading a lateral raise, a bar travelling on an arc)
        if k in p:
            p[k] = tuple(p[k][i] + v[i] * s for i in range(3))
    ph = 2 * math.pi * (t / T)
    still = lift.get("still", False)
    if "chest" in p:
        p["chest"] = p["chest"] + 0.9 * math.sin(ph)                 # breathing
    if "neck" in p:
        p["neck"] = p["neck"] + 0.6 * math.sin(ph + 0.6)
    if "pelvis" in p:
        x, y, z = p["pelvis"]
        p["pelvis"] = (x, y + 0.004 * math.sin(ph), z)               # weight shifting a touch
    if hw > 0:                                                       # the shake of a hard squeeze at the top
        tr = 0.0022 * hw * math.sin(2 * math.pi * 9.5 * t)
        for k in list(p):
            if k.startswith("hand") or k.startswith("rhand"):
                p[k] = (p[k][0] + tr, p[k][1], p[k][2] + tr * 0.7)
    pulse = u
    if hw > 0:
        pulse = min(1.0, u + 0.08 * math.sin(2 * math.pi * 6.0 * t))
    if still:
        pulse = 0.55 + 0.35 * math.sin(ph)
    return p, max(0.0, pulse), u
