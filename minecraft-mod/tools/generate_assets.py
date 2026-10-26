#!/usr/bin/env python3
"""Erzeugt alle Skin-Texturen, Modelle, Item-Definitionen und skins.json fuer die Mod Arsenal.

Aufruf:  python3 tools/generate_assets.py [--preview ORDNER]
Die Formen werden als Umriss (Laengsachse x = 0 Griffende ... 100 Spitze, y = Breite)
beschrieben, schraeg ins Pixelraster gelegt und mit einem Muster (Finish) eingefaerbt.
"""
import json
import math
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, 'src', 'main', 'resources', 'assets', 'vantage')
NS = 'vantage'


# ---------------------------------------------------------------- Hilfen
def clamp(v, a=0, b=255):
    return max(a, min(b, v))


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(lerp(c1[i], c2[i], t) for i in range(3))


def mul(c, f):
    return tuple(c[i] * f for i in range(3))


def grad(stops, t):
    t = max(0.0, min(1.0, t))
    for i in range(len(stops) - 1):
        a, ca = stops[i]
        b, cb = stops[i + 1]
        if t <= b:
            return mix(ca, cb, (t - a) / (b - a) if b > a else 0)
    return stops[-1][1]


def h2(ix, iy, seed):
    n = (ix * 374761393 + iy * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def vnoise(x, y, seed, sc=1.0):
    x /= sc
    y /= sc
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    a = h2(ix, iy, seed)
    b = h2(ix + 1, iy, seed)
    c = h2(ix, iy + 1, seed)
    d = h2(ix + 1, iy + 1, seed)
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)


def fbm(x, y, seed, sc=6.0, oct=3):
    v, amp, tot = 0.0, 1.0, 0.0
    for o in range(oct):
        v += vnoise(x, y, seed + o * 31, sc / (2 ** o)) * amp
        tot += amp
        amp *= 0.5
    return v / tot


# ---------------------------------------------------------------- Geometrie
def inside_poly(poly, x, y):
    c = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            xc = (xj - xi) * (y - yi) / (yj - yi) + xi
            if x < xc:
                c = not c
        j = i
    return c


def P(part, *pts):
    return {'part': part, 'poly': list(pts)}


def C(part, cx, cy, r):
    return {'part': part, 'circle': (cx, cy, r)}


def HOLE_P(*pts):
    return {'part': None, 'poly': list(pts)}


def HOLE_C(cx, cy, r):
    return {'part': None, 'circle': (cx, cy, r)}


def R(part, x0, y0, x1, y1):
    return P(part, (x0, y0), (x1, y0), (x1, y1), (x0, y1))


def prim_has(pr, x, y):
    if 'poly' in pr:
        return inside_poly(pr['poly'], x, y)
    cx, cy, r = pr['circle']
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def part_at(prims, x, y):
    res = None
    for pr in prims:
        if prim_has(pr, x, y):
            if pr['part'] is None:
                return None
            res = pr['part']
    return res


def curve(pts, n=6):
    """Catmull-Rom-Kurve durch Punkte."""
    out = []
    for i in range(len(pts) - 1):
        p0 = pts[max(i - 1, 0)]
        p1 = pts[i]
        p2 = pts[i + 1]
        p3 = pts[min(i + 2, len(pts) - 1)]
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2
                                    + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    out.append(pts[-1])
    return out


def blade(top, bottom, part='blade'):
    """Klinge aus Ruecken-Kurve (Griff->Spitze) und Schneiden-Kurve (Griff->Spitze)."""
    t = curve(top)
    b = curve(bottom)
    return {'part': part, 'poly': t + b[::-1]}


class Shape:
    def __init__(self, prims, x0=0, x1=100, blade_x=(40, 100), half=8, ribs=False):
        self.prims = prims
        self.x0, self.x1 = x0, x1
        self.blade_x = blade_x
        self.half = half
        self.ribs = ribs


def raster(shape, size, start, end, ss=4, thresh=7):
    """Gibt (parts[y][x], prof[y][x]=(x,y) Profilkoordinaten) zurueck."""
    sx, sy = start
    ex, ey = end
    L = math.hypot(ex - sx, ey - sy)
    dx, dy = (ex - sx) / L, (ey - sy) / L
    nx, ny = dy, -dx  # "oben" im Profil
    scale = L / (shape.x1 - shape.x0)
    parts = [[None] * size for _ in range(size)]
    prof = [[None] * size for _ in range(size)]
    for py in range(size):
        for px in range(size):
            counts = {}
            for a in range(ss):
                for b in range(ss):
                    qx = px + (a + 0.5) / ss - sx
                    qy = py + (b + 0.5) / ss - sy
                    x = (qx * dx + qy * dy) / scale + shape.x0
                    y = (qx * nx + qy * ny) / scale
                    p = part_at(shape.prims, x, y)
                    if p is not None:
                        counts[p] = counts.get(p, 0) + 1
            if counts and sum(counts.values()) >= thresh:
                best = max(counts.items(), key=lambda kv: kv[1])[0]
                parts[py][px] = best
                qx, qy = px + 0.5 - sx, py + 0.5 - sy
                prof[py][px] = ((qx * dx + qy * dy) / scale + shape.x0, (qx * nx + qy * ny) / scale)
    return parts, prof, (nx, ny)


# ---------------------------------------------------------------- Finishes
def steel(u, v):
    t = (1 - v) / 2
    return mix((108, 114, 126), (222, 226, 234), 0.25 + 0.75 * t)


def f_vanilla(u, v, x, y):
    return steel(u, v)


def f_fade(u, v, x, y):
    c = grad([(0, (246, 206, 70)), (0.3, (244, 120, 150)), (0.62, (186, 76, 214)), (1, (86, 96, 236))], u * 0.95 + 0.05 * (1 - v) / 2)
    return mix(c, (255, 255, 255), max(0, -v) * 0.18)


def swirl(base, hi, x, y, seed, sc=5.0, lo=0.42, hi_t=0.7, extra=None):
    n = fbm(x * 1.0, y * 1.0, seed, sc)
    c = mix(base, hi, (n - lo) / (hi_t - lo))
    if extra is not None:
        m = fbm(x + 50, y + 13, seed + 7, sc * 1.4)
        c = mix(c, extra, (m - 0.62) / 0.15)
    return c


def f_doppler(u, v, x, y):
    return swirl((24, 8, 30), (232, 70, 176), x, y, 11, extra=(120, 60, 220))


def f_ruby(u, v, x, y):
    return swirl((70, 0, 8), (240, 28, 50), x, y, 21, extra=(255, 120, 130))


def f_sapphire(u, v, x, y):
    return swirl((6, 14, 80), (40, 130, 255), x, y, 31, extra=(140, 210, 255))


def f_black_pearl(u, v, x, y):
    return swirl((12, 8, 26), (104, 58, 196), x, y, 41, extra=(200, 90, 200))


def f_gamma(u, v, x, y):
    return swirl((8, 36, 30), (60, 222, 160), x, y, 51, extra=(40, 120, 230))


def f_emerald(u, v, x, y):
    return swirl((0, 40, 18), (24, 236, 110), x, y, 61, extra=(170, 255, 200))


def f_marble(u, v, x, y):
    n = fbm(x, y, 71, 6.0)
    m = (math.sin((x + y) * 0.35 + n * 7.0) + 1) / 2
    c = grad([(0, (226, 36, 40)), (0.45, (250, 208, 64)), (0.7, (250, 230, 120)), (1, (52, 96, 226))], m)
    return c


def f_tiger(u, v, x, y):
    n = fbm(x, y, 81, 5.0)
    s = math.sin((x * 0.9 - y * 0.6) * 1.1 + n * 5.0)
    base = mix((236, 168, 40), (255, 214, 96), (1 - v) / 2)
    return mix(base, (164, 70, 8), (s - 0.35) * 2.2)


def f_slaughter(u, v, x, y):
    n = fbm(x, y, 91, 4.0)
    c = mix((176, 22, 36), (242, 120, 128), (n - 0.45) / 0.2)
    return mix(c, (255, 222, 222), (n - 0.72) / 0.08)


def f_crimson(u, v, x, y):
    base = mix((92, 0, 8), (150, 10, 20), (1 - v) / 2)
    cx, cy = 4.0, 28.0
    ang = math.atan2(y - cy, x - cx)
    dist = math.hypot(x - cx, y - cy)
    radial = abs(math.sin(ang * 9.0))
    ring = abs(math.sin(dist * 0.85))
    if radial < 0.16 or ring < 0.13:
        return (14, 6, 8)
    return base


def f_case(u, v, x, y):
    n = fbm(x, y, 101, 5.0)
    return grad([(0, (56, 82, 186)), (0.38, (126, 92, 156)), (0.5, (160, 150, 150)), (0.68, (206, 164, 66)), (1, (232, 196, 96))], n)


def f_damascus(u, v, x, y):
    n = fbm(x, y, 111, 6.0)
    w = math.sin(u * 34 + v * 3 + n * 6)
    c = steel(u, v)
    return mix(c, mul(c, 0.55), (w - 0.3) * 1.5)


def f_ultraviolet(u, v, x, y):
    return mix((40, 22, 60), (98, 64, 134), (1 - v) / 2 * 0.8 + fbm(x, y, 121, 4.0) * 0.2)


def f_night(u, v, x, y):
    return mix((36, 38, 46), (82, 86, 98), (1 - v) / 2 * 0.7 + fbm(x, y, 131, 3.0) * 0.3)


def f_blue_steel(u, v, x, y):
    n = fbm(x, y, 141, 5.0)
    return grad([(0, (70, 92, 140)), (0.5, (146, 156, 180)), (0.75, (190, 172, 124)), (1, (110, 130, 186))], n * 0.7 + (1 - v) / 2 * 0.3)


def f_lore(u, v, x, y):
    base = mix((196, 146, 46), (250, 214, 110), (1 - v) / 2)
    x, y = int(x), int(y)
    a = (x + y) % 5
    b = (x - y) % 5
    if a == 0 or b == 0:
        return mul(base, 0.6)
    return base


def f_autotronic(u, v, x, y):
    base = mix((176, 22, 26), (226, 52, 44), (1 - v) / 2)
    x, y = int(x), int(y)
    n = h2(x // 3, y // 3, 151)
    if (x % 4 == 0 and n > 0.4) or (y % 5 == 0 and n < 0.55):
        return (26, 20, 22)
    return base


def f_freehand(u, v, x, y):
    n = fbm(x, y, 161, 4.0)
    m = fbm(x + 20, y + 7, 162, 3.0)
    if abs(n - 0.5) < 0.035:
        return (20, 20, 24)
    if m > 0.62:
        return (250, 128, 36)
    if m < 0.36:
        return (44, 96, 210)
    return (232, 232, 222)


def f_bright_water(u, v, x, y):
    n = fbm(x, y, 171, 6.0)
    w = (math.sin(x * 0.6 + y * 0.3 + n * 6) + 1) / 2
    return mix((18, 88, 138), (60, 196, 214), w)


def camo(cols, x, y, seed, block=2, sc=3.0):
    n = fbm((x // block) * block, (y // block) * block, seed, sc)
    idx = min(len(cols) - 1, int(n * len(cols) * 1.15 - 0.1 * len(cols)))
    return cols[max(0, idx)]


def f_ddpat(u, v, x, y):
    return camo([(40, 52, 30), (74, 94, 52), (116, 124, 74), (158, 148, 104)], x, y, 181)


def f_safari(u, v, x, y):
    base = mix((150, 130, 88), (196, 176, 124), fbm(x, y, 191, 4.0))
    if int(x) % 3 == 0 or int(y) % 3 == 0:
        return mul(base, 0.72)
    return base


def f_urban(u, v, x, y):
    return camo([(56, 58, 64), (96, 98, 104), (146, 148, 154), (196, 198, 202)], x, y, 201)


def f_scorched(u, v, x, y):
    return camo([(24, 20, 18), (56, 44, 34), (96, 80, 62), (140, 124, 100)], x, y, 211, block=1, sc=2.5)


def f_boreal(u, v, x, y):
    return camo([(38, 40, 28), (64, 74, 48), (96, 84, 58), (130, 118, 84)], x, y, 221)


def f_rust(u, v, x, y):
    n = fbm(x, y, 231, 2.5)
    c = grad([(0, (96, 44, 22)), (0.5, (152, 72, 30)), (1, (196, 112, 52))], n)
    if h2(int(x * 2), int(y * 2), 232) > 0.86:
        return steel(u, v)
    return c


def f_stained(u, v, x, y):
    c = steel(u, v)
    n = fbm(x, y, 241, 4.0)
    m = fbm(x + 9, y + 3, 242, 4.0)
    c = mix(c, (128, 70, 160), (n - 0.6) / 0.12)
    return mix(c, (200, 170, 60), (m - 0.64) / 0.12)


FINISHES = [
    # id, Name, Seltenheit (0 Konsum ... 6 Gold), Funktion
    ('vanilla', 'Vanilla', 5, f_vanilla),
    ('fade', 'Fade', 5, f_fade),
    ('marble_fade', 'Marble Fade', 5, f_marble),
    ('doppler', 'Doppler', 5, f_doppler),
    ('ruby', 'Doppler (Ruby)', 6, f_ruby),
    ('sapphire', 'Doppler (Sapphire)', 6, f_sapphire),
    ('black_pearl', 'Doppler (Black Pearl)', 6, f_black_pearl),
    ('gamma_doppler', 'Gamma Doppler', 5, f_gamma),
    ('emerald', 'Gamma Doppler (Emerald)', 6, f_emerald),
    ('tiger_tooth', 'Tiger Tooth', 4, f_tiger),
    ('slaughter', 'Slaughter', 4, f_slaughter),
    ('crimson_web', 'Crimson Web', 4, f_crimson),
    ('case_hardened', 'Case Hardened', 4, f_case),
    ('lore', 'Lore', 4, f_lore),
    ('autotronic', 'Autotronic', 4, f_autotronic),
    ('ultraviolet', 'Ultraviolet', 3, f_ultraviolet),
    ('damascus', 'Damascus Steel', 3, f_damascus),
    ('blue_steel', 'Blue Steel', 3, f_blue_steel),
    ('night', 'Night', 3, f_night),
    ('freehand', 'Freehand', 3, f_freehand),
    ('bright_water', 'Bright Water', 3, f_bright_water),
    ('stained', 'Stained', 2, f_stained),
    ('forest_ddpat', 'Forest DDPAT', 1, f_ddpat),
    ('boreal_forest', 'Boreal Forest', 1, f_boreal),
    ('urban_masked', 'Urban Masked', 1, f_urban),
    ('safari_mesh', 'Safari Mesh', 1, f_safari),
    ('scorched', 'Scorched', 1, f_scorched),
    ('rust_coat', 'Rust Coat', 1, f_rust),
]
FIN = {f[0]: f for f in FINISHES}
TOOL_FINISHES = ['vanilla', 'fade', 'doppler', 'ruby', 'sapphire', 'emerald', 'tiger_tooth', 'crimson_web',
                 'case_hardened', 'lore', 'night', 'damascus', 'marble_fade', 'slaughter']

# ---------------------------------------------------------------- Teilefarben
PART_COLORS = {
    'black': (40, 40, 46),
    'dark': (58, 60, 66),
    'rubber': (52, 54, 58),
    'steel': (168, 172, 182),
    'darksteel': (110, 114, 124),
    'brass': (198, 156, 72),
    'wood': (118, 76, 42),
    'lightwood': (156, 108, 62),
    'olive': (98, 108, 66),
    'orange': (220, 110, 36),
    'red': (190, 34, 34),
    'paint_red': (196, 30, 36),
    'leather': (96, 58, 34),
    'gold': (226, 178, 62),
    'gem': (60, 200, 230),
    'cord_a': (60, 66, 44),
    'cord_b': (96, 104, 70),
}


def part_color(part, x, y, px, py):
    if part == 'cord':
        return PART_COLORS['cord_a'] if (px + py) % 3 == 0 else PART_COLORS['cord_b']
    if part == 'cord_orange':
        return (150, 70, 20) if (px + py) % 3 == 0 else (226, 120, 40)
    if part == 'ribbed':
        return PART_COLORS['rubber'] if (px - py) % 3 else (34, 36, 40)
    if part == 'wood':
        g = (math.sin(x * 0.9 + y * 0.2) + 1) / 2
        return mix(PART_COLORS['wood'], PART_COLORS['lightwood'], g * 0.6)
    return PART_COLORS.get(part, (200, 0, 200))


FINISHED_PARTS = ('blade', 'head')


def render(shape, size, start, end, finish, flip_light=False, outline=0.58):
    parts, prof, (nx, ny) = raster(shape, size, start, end)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    b0, b1 = shape.blade_x
    ex, ey = int(round(-nx)), int(round(-ny))  # Richtung Schneide
    for py in range(size):
        for px in range(size):
            p = parts[py][px]
            if p is None:
                continue
            x, y = prof[py][px]
            if p in FINISHED_PARTS:
                u = (x - b0) / max(1e-6, (b1 - b0))
                v = max(-1.0, min(1.0, y / shape.half))
                c = FIN[finish][3](u, v, px, py)
            else:
                c = part_color(p, x, y, px, py)

            def empty(qx, qy):
                return not (0 <= qx < size and 0 <= qy < size) or parts[qy][qx] is None

            edge_side = empty(px + ex, py + ey)
            spine_side = empty(px - ex, py - ey)
            border = empty(px + 1, py) or empty(px - 1, py) or empty(px, py + 1) or empty(px, py - 1)
            if p in FINISHED_PARTS and edge_side and not spine_side:
                c = mix(mul(c, 1.25), (255, 255, 255), 0.22)
            elif spine_side or border:
                c = mul(c, outline)
            img.putpixel((px, py), (int(clamp(c[0])), int(clamp(c[1])), int(clamp(c[2])), 255))
    return img


# ---------------------------------------------------------------- Messer
# ---------------------------------------------------------------- Messer (64x64, echte 3D-Tiefe)
KNIFE_SIZE = 64
KNIFE_START, KNIFE_END = (4.0, 60.0), (60.0, 4.0)
THICK = {'E': 0.3, 'S': 0.6, 'H': 1.1, 'R': 0.9, 'G': 1.6, 'V': 1.3}


class KShape(Shape):
    def __init__(self, prims, x0=0, x1=100, blade_x=(40, 100), half=8, double=False, fuller=None):
        super().__init__(prims, x0, x1, blade_x, half)
        self.double = double
        self.fuller = fuller  # (x_start, x_end, v_mitte)


def RIV(x, y, r=1.7, brass=False):
    return C('rivet_brass' if brass else 'rivet', x, y, r)


def cross_interval(prim, x, y):
    """Unter-/Obergrenze (y) des Polygons auf der Senkrechten durch x, die y enthaelt."""
    if 'circle' in prim:
        cx, cy, r = prim['circle']
        h = math.sqrt(max(0.0, r * r - (x - cx) ** 2))
        return cy - h, cy + h
    poly = prim['poly']
    ys = []
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (x1 <= x < x2) or (x2 <= x < x1):
            t = (x - x1) / (x2 - x1)
            ys.append(y1 + t * (y2 - y1))
    ys.sort()
    for i in range(0, len(ys) - 1, 2):
        if ys[i] <= y <= ys[i + 1]:
            return ys[i], ys[i + 1]
    if len(ys) >= 2:
        return ys[0], ys[-1]
    return y - 1, y + 1


def prim_for(shape, part, x, y):
    found = None
    for pr in shape.prims:
        if pr['part'] == part and prim_has(pr, x, y):
            found = pr
    return found


def handle_color(part, x, y, v, px, py):
    """Griff-Materialien in Profil-Koordinaten (x entlang, y quer), v = 0..1 quer."""
    roll = 1.12 - 0.42 * abs(v - 0.62) * 2  # runde Form: oben heller
    if part in ('g10', 'ring'):
        n = fbm(x * 1.4, y * 1.4, 501, 2.0)
        grip = ((x * 1.1 + y * 1.1) % 2.6) < 0.7
        c = (30 + 12 * n, 31 + 12 * n, 37 + 14 * n)
        if grip and part == 'g10':
            c = mul(c, 1.35)
    elif part == 'carbon':
        c = (44, 46, 52) if (int(x * 0.9) + int(y * 0.9)) % 2 else (26, 27, 31)
    elif part == 'wood':
        g = (math.sin(y * 2.3 + fbm(x, y * 3, 503, 6.0) * 5) + 1) / 2
        c = mix((104, 62, 32), (156, 104, 58), g * 0.8)
    elif part == 'ribbed':
        c = (58, 60, 66) if int(x * 0.75) % 2 else (34, 36, 40)
    elif part in ('cord', 'cord_orange'):
        band = (x * 0.9 + y * 0.55) % 3.0
        if part == 'cord':
            c = mix((54, 62, 40), (104, 114, 74), band / 3.0)
        else:
            c = mix((150, 66, 18), (236, 128, 44), band / 3.0)
        if band < 0.35:
            c = mul(c, 0.55)
    elif part in ('steel', 'guard_steel'):
        c = mix((120, 126, 138), (214, 220, 230), 0.5 + 0.5 * math.sin(v * 3.1))
    elif part in ('darksteel', 'guard_dark'):
        c = mix((64, 68, 78), (132, 138, 150), 0.5 + 0.5 * math.sin(v * 3.1))
    elif part in ('brass', 'guard_brass'):
        c = mix((150, 106, 40), (240, 196, 104), 0.5 + 0.5 * math.sin(v * 3.1))
    elif part == 'leather':
        c = (98, 60, 34)
        if int(x * 1.2) % 3 == 0 and abs(v - 0.5) < 0.12:
            c = (196, 170, 120)
    elif part == 'rivet':
        d = v
        return mix((230, 234, 240), (120, 124, 134), d)
    elif part == 'rivet_brass':
        return mix((252, 220, 140), (150, 110, 46), v)
    else:
        c = PART_COLORS.get(part, (200, 0, 200))
    return mul(c, roll)


def knife_class(part, e):
    if part == 'blade':
        return 'E' if e < 0.34 else 'S'
    if part.startswith('guard'):
        return 'G'
    if part.startswith('rivet'):
        return 'V'
    if part == 'ring':
        return 'R'
    return 'H'


_KNIFE_RASTER = {}


def knife_raster(sid, shape):
    if sid not in _KNIFE_RASTER:
        _KNIFE_RASTER[sid] = raster(shape, KNIFE_SIZE, KNIFE_START, KNIFE_END)
    return _KNIFE_RASTER[sid]


def render_knife(sid, shape, finish):
    size = KNIFE_SIZE
    parts, prof, (nx, ny) = knife_raster(sid, shape)
    L = math.hypot(KNIFE_END[0] - KNIFE_START[0], KNIFE_END[1] - KNIFE_START[1])
    px_per_unit = L / (shape.x1 - shape.x0)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cls = [[None] * size for _ in range(size)]
    info = [[None] * size for _ in range(size)]
    b0, b1 = shape.blade_x
    sc = size / 32.0
    for py in range(size):
        for px in range(size):
            p = parts[py][px]
            if p is None:
                continue
            x, y = prof[py][px]
            pr = prim_for(shape, p, x, y)
            if pr is not None and 'poly' in pr or (pr is not None and 'circle' in pr):
                lo, hi = cross_interval(pr, x, y)
            else:
                lo, hi = y - 1, y + 1
            width = max(1e-3, hi - lo)
            v = max(0.0, min(1.0, (y - lo) / width))
            e = min(v, 1 - v) * 2 if (p == 'blade' and shape.double) else v
            if p.startswith('rivet') and pr is not None and 'circle' in pr:
                cx, cy, r = pr['circle']
                v = min(1.0, math.hypot(x - cx + r * 0.3, y - cy - r * 0.3) / (r * 1.3))
            fx, fy = px / sc, py / sc
            if p == 'blade':
                u = (x - b0) / max(1e-6, b1 - b0)
                c = FIN[finish][3](u, 2 * e - 1, fx, fy)
                bevel = 0.34
                if e < bevel:
                    k = 1 - e / bevel
                    c = mix(mul(c, 1.05 + 0.2 * k), (255, 255, 255), 0.05 + 0.14 * k * k)
                else:
                    c = mul(c, 0.98 - 0.14 * (e - bevel) / (1 - bevel))
                line = 0.75 / max(1.0, width * px_per_unit)
                if abs(e - bevel) < line:
                    c = mul(c, 0.72)
                if shape.fuller:
                    f0, f1, fv = shape.fuller
                    if f0 <= x <= f1 and abs(v - fv) < 0.11:
                        c = mul(c, 0.68 if v > fv else 0.82)
                spec = math.exp(-((u - 0.52) * 5.5) ** 2) * 0.13 * (0.4 + 0.6 * e)
                c = mix(c, (255, 255, 255), spec)
            else:
                c = handle_color(p, x, y, v, px, py)
            cls[py][px] = knife_class(p, e)
            info[py][px] = (p, e)
            img.putpixel((px, py), (int(clamp(c[0])), int(clamp(c[1])), int(clamp(c[2])), 255))
    # Umriss: dunkler Rand, an der Schneide ein heller Glanz
    out = img.copy()
    for py in range(size):
        for px in range(size):
            if parts[py][px] is None:
                continue

            def empty(qx, qy):
                return not (0 <= qx < size and 0 <= qy < size) or parts[qy][qx] is None

            border = empty(px + 1, py) or empty(px - 1, py) or empty(px, py + 1) or empty(px, py - 1)
            if not border:
                continue
            p, e = info[py][px]
            r, g, b, a = img.getpixel((px, py))
            if p == 'blade' and e < 0.2:
                c = mix((r, g, b), (255, 255, 255), 0.35)
            else:
                c = mul((r, g, b), 0.52)
            out.putpixel((px, py), (int(clamp(c[0])), int(clamp(c[1])), int(clamp(c[2])), 255))
    return out, cls


def knife_shape_model(cls):
    size = KNIFE_SIZE
    s = 16.0 / size
    elements = []
    for py in range(size):
        px = 0
        while px < size:
            k = cls[py][px]
            if k is None:
                px += 1
                continue
            x0 = px
            while px < size and cls[py][px] == k:
                px += 1
            x1 = px
            t = THICK[k]
            y0 = round(16 - (py + 1) * s, 4)
            y1 = round(16 - py * s, 4)
            u0, u1 = round(x0 * s, 4), round(x1 * s, 4)
            v0, v1 = round(py * s, 4), round((py + 1) * s, 4)
            elements.append({
                "from": [u0, y0, round(8 - t / 2, 4)],
                "to": [u1, y1, round(8 + t / 2, 4)],
                "faces": {
                    "south": {"uv": [u0, v0, u1, v1], "texture": "#tex"},
                    "north": {"uv": [u1, v0, u0, v1], "texture": "#tex"},
                    "up": {"uv": [u0, v0, u1, v1], "texture": "#tex"},
                    "down": {"uv": [u0, v0, u1, v1], "texture": "#tex"},
                    "east": {"uv": [round(u1 - s, 4), v0, u1, v1], "texture": "#tex"},
                    "west": {"uv": [u0, v0, round(u0 + s, 4), v1], "texture": "#tex"},
                },
            })
    return {
        "gui_light": "front",
        "textures": {"particle": "#tex"},
        "elements": elements,
        "display": {
            "thirdperson_righthand": {"rotation": [0, -90, 55], "translation": [0, 4.0, 0.5], "scale": [0.85, 0.85, 0.85]},
            "thirdperson_lefthand": {"rotation": [0, 90, -55], "translation": [0, 4.0, 0.5], "scale": [0.85, 0.85, 0.85]},
            "firstperson_righthand": {"rotation": [0, -90, 25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
            "firstperson_lefthand": {"rotation": [0, 90, -25], "translation": [1.13, 3.2, 1.13], "scale": [0.68, 0.68, 0.68]},
            "ground": {"rotation": [0, 0, 0], "translation": [0, 2, 0], "scale": [0.5, 0.5, 0.5]},
            "head": {"rotation": [0, 180, 0], "translation": [0, 13, 7], "scale": [1, 1, 1]},
            "fixed": {"rotation": [0, 180, 0], "scale": [1, 1, 1]},
        },
    }


def knives():
    K = {}
    K['karambit'] = ('Karambit', KShape([
        C('ring', 6, 0, 8.5), HOLE_C(6, 0, 4.6),
        P('g10', (11, 5), (20, 6.5), (30, 5.2), (44, 5.8), (46, -5), (30, -5.6), (20, -4.2), (12, -5.5)),
        RIV(23, 0.4), RIV(36, 0.2),
        blade([(44, 6), (62, 7), (78, 3.5), (90, -5), (98, -17)],
              [(44, -4.5), (58, -4), (72, -6), (84, -10), (98, -17)]),
    ], x0=-3, x1=100, blade_x=(44, 98), half=7))
    K['butterfly'] = ('Butterfly', KShape([
        R('steel', -2, -2, 4, 2),
        R('steel', 2, -6.5, 48, 6.5), HOLE_P((8, -1.2), (44, -1.2), (44, 1.2), (8, 1.2)),
        HOLE_C(16, 3.9, 1.25), HOLE_C(26, 3.9, 1.25), HOLE_C(36, 3.9, 1.25),
        HOLE_C(16, -3.9, 1.25), HOLE_C(26, -3.9, 1.25), HOLE_C(36, -3.9, 1.25),
        RIV(45.5, 3.9, 1.4), RIV(45.5, -3.9, 1.4),
        blade([(48, 4), (78, 4), (90, 3), (100, 0)], [(48, -4), (70, -4.5), (88, -3.5), (100, 0)]),
    ], x0=-2, x1=100, blade_x=(48, 100), half=4.5))
    K['bayonet'] = ('Bajonett', KShape([
        R('guard_steel', 0, -6.5, 4, 6.5), R('ribbed', 4, -5.5, 38, 5.5),
        R('guard_dark', 38, -9, 42, 9), C('guard_dark', 40, 9.5, 3), HOLE_C(40, 9.5, 1.4),
        blade([(42, 5.5), (84, 5.5), (100, 0)], [(42, -5.5), (84, -5.5), (100, 0)]),
    ], blade_x=(42, 100), half=5.5, fuller=(47, 80, 0.62)))
    K['m9'] = ('M9-Bajonett', KShape([
        R('guard_steel', 0, -7, 4, 7), R('ribbed', 4, -6, 38, 6),
        R('guard_dark', 38, -10, 42, 10), C('guard_dark', 40, -10, 3.4), HOLE_C(40, -10, 1.6),
        blade([(42, 7), (52, 7), (54, 8.6), (56, 7), (58, 8.6), (60, 7), (62, 8.6), (64, 7), (66, 8.6), (68, 7), (80, 6.5), (100, 0)],
              [(42, -7), (86, -6.5), (100, 0)]),
    ], blade_x=(42, 100), half=7.5, fuller=(46, 78, 0.6)))
    K['flip'] = ('Flip', KShape([
        P('g10', (0, 3.5), (4, 5), (44, 5), (44, -5), (4, -5), (0, -3.5)),
        RIV(8, 0), RIV(40, 0), C('darksteel', 46, 5.5, 1.4),
        blade([(44, 4.5), (80, 4.5), (100, -1.5)], [(44, -4.5), (82, -5), (94, -4), (100, -1.5)]),
    ], blade_x=(44, 100), half=5))
    K['gut'] = ('Gut-Messer', KShape([
        P('g10', (0, 4), (4, 5.5), (42, 5.5), (42, -5.5), (4, -5.5), (0, -4)),
        RIV(12, 0), RIV(32, 0),
        blade([(42, 6), (66, 6), (69, 2), (73, 2.5), (76, 6), (86, 5), (100, -2.5)],
              [(42, -6), (80, -6.5), (94, -5), (100, -2.5)]),
    ], blade_x=(42, 100), half=6.5))
    K['huntsman'] = ('Huntsman', KShape([
        P('g10', (0, 5), (12, 6), (16, 4.5), (22, 6), (28, 4.5), (34, 6), (40, 6), (40, -6), (0, -5)),
        R('guard_dark', 40, -9, 43, 9),
        blade([(43, 7.5), (50, 7.5), (52, 9), (54, 7.5), (56, 9), (58, 7.5), (60, 9), (62, 7.5), (76, 7.5), (100, 0)],
              [(43, -7.5), (88, -7), (100, 0)]),
    ], blade_x=(43, 100), half=8, fuller=(47, 74, 0.58)))
    K['falchion'] = ('Falchion', KShape([
        P('g10', (0, 4.5), (44, 6), (44, -5), (0, -5.5)), RIV(10, 0), RIV(36, 0.4),
        blade([(44, 5.5), (70, 6.5), (86, 5), (100, -3)], [(44, -5), (72, -6.5), (92, -6), (100, -3)]),
    ], blade_x=(44, 100), half=6.5))
    K['bowie'] = ('Bowie', KShape([
        R('guard_brass', 0, -6.8, 4, 6.8), R('wood', 4, -6, 38, 6), RIV(14, 0, 1.6, True), RIV(28, 0, 1.6, True),
        R('guard_brass', 38, -10.5, 42, 10.5),
        blade([(42, 8.5), (72, 8.5), (100, 1.5)], [(42, -8.5), (84, -8.5), (95, -5), (100, 1.5)]),
    ], blade_x=(42, 100), half=8.5, fuller=(46, 70, 0.66)))
    K['shadow_daggers'] = ('Schattendolche', KShape([
        R('g10', 0, -11, 8, 11), R('g10', 8, -3.5, 18, 3.5), RIV(4, 6, 1.4), RIV(4, -6, 1.4),
        blade([(18, 4.5), (34, 6.5), (62, 0.5)], [(18, -4.5), (34, -6.5), (62, -0.5)]),
    ], x0=-6, x1=66, blade_x=(18, 62), half=6.5, double=True))
    K['ursus'] = ('Ursus', KShape([
        P('g10', (0, 4), (6, 5.5), (44, 5.5), (44, -5.5), (6, -5.5), (0, -4)), RIV(12, 0), RIV(36, 0),
        blade([(44, 5.5), (88, 5.5), (100, -1)], [(44, -5.5), (90, -5.5), (100, -1)]),
    ], blade_x=(44, 100), half=6))
    K['navaja'] = ('Navaja', KShape([
        blade([(0, 2), (20, 6.5), (40, 6), (50, 4)], [(0, -3.5), (22, 0), (40, -2), (50, -3.5)], part='wood'),
        RIV(10, -0.5, 1.3, True), RIV(42, 1.2, 1.3, True),
        R('guard_brass', 47, -4, 50, 4.5),
        blade([(50, 3.5), (84, 3.5), (100, 1.5)], [(50, -3.5), (80, -3.2), (94, -1.5), (100, 1.5)]),
    ], blade_x=(50, 100), half=3.8))
    K['stiletto'] = ('Stiletto', KShape([
        R('guard_steel', 0, -4.6, 4, 4.6), R('wood', 4, -3.6, 42, 3.6), R('guard_steel', 42, -5, 46, 5),
        blade([(46, 3.2), (86, 3), (100, 0)], [(46, -3.2), (86, -3), (100, 0)]),
    ], blade_x=(46, 100), half=3.4, double=True))
    K['talon'] = ('Talon', KShape([
        C('ring', 6, 0, 9), HOLE_C(6, 0, 5.4),
        P('g10', (12, 5.5), (44, 6), (46, -5.5), (12, -6)), HOLE_C(24, 0, 1.5), HOLE_C(34, 0, 1.5),
        blade([(44, 6.5), (64, 8.5), (82, 5), (93, -4), (99, -18)],
              [(44, -5), (60, -3), (76, -6), (88, -11), (99, -18)]),
    ], x0=-4, x1=100, blade_x=(44, 99), half=8))
    K['skeleton'] = ('Skeleton', KShape([
        P('steel', (0, 3.5), (4, 6), (42, 6), (42, -6), (4, -6), (0, -3.5)),
        HOLE_P((8, 2.1), (37, 2.3), (37, -2.3), (8, -2.1)),
        R('cord', 14, -2.1, 31, 2.1),
        blade([(42, 6), (80, 6), (100, -1.5)], [(42, -6), (84, -6), (96, -4), (100, -1.5)]),
    ], blade_x=(42, 100), half=6))
    K['classic'] = ('Classic', KShape([
        P('g10', (0, 4.5), (36, 5.5), (40, 9), (42, 9), (42, -6), (0, -5)), RIV(10, 0), RIV(26, 0),
        blade([(42, 6), (78, 6), (100, 0)], [(42, -6), (86, -5.5), (100, 0)]),
    ], blade_x=(42, 100), half=6, fuller=(46, 72, 0.64)))
    K['paracord'] = ('Paracord', KShape([
        R('guard_steel', 0, -3, 3, 3), R('cord', 3, -5, 42, 5),
        blade([(42, 6), (80, 6), (100, -1)], [(42, -6), (60, -5), (84, -6.5), (100, -1)]),
    ], blade_x=(42, 100), half=6.5))
    K['survival'] = ('Survival', KShape([
        R('guard_steel', 0, -3, 3, 3), R('cord_orange', 3, -5, 42, 5),
        blade([(42, 7), (80, 7), (100, -1)],
              [(42, -7), (46, -8.6), (48, -7), (50, -8.6), (52, -7), (54, -8.6), (56, -7), (86, -7), (100, -1)]),
    ], blade_x=(42, 100), half=7.5))
    K['nomad'] = ('Nomad', KShape([
        P('g10', (0, 4.5), (44, 5.5), (44, -5.5), (0, -4.5)), HOLE_C(4.5, 0, 1.6), RIV(18, 0), RIV(36, 0),
        blade([(44, 6.5), (76, 6.5), (100, -5)], [(44, -6), (100, -5.5)]),
    ], blade_x=(44, 100), half=6.5))
    K['kukri'] = ('Kukri', KShape([
        P('wood', (0, 7), (4, 5), (38, 4.5), (38, -4.5), (4, -5), (0, -7)), RIV(16, 0, 1.5, True), RIV(28, 0, 1.5, True),
        R('guard_brass', 36, -6, 39, 6),
        blade([(39, 4.5), (60, 6), (78, 2), (92, -6), (100, -13)],
              [(39, -4.5), (56, -7), (70, -13), (86, -16.5), (100, -13)]),
    ], blade_x=(39, 100), half=9))
    return K


# ---------------------------------------------------------------- Aexte (Kopf bei x 70-100, Klinge nach "oben")
def axes():
    A = {}
    A['dz_axe'] = ('Danger-Zone-Axt', Shape([
        R('black', 0, -3.2, 96, 3.2),
        P('paint_red', (68, 3), (94, 3), (94, -3), (88, -10), (74, -10), (68, -3)),
        P('head', (70, 3), (92, 3), (102, 24), (60, 24)),
    ], x0=0, x1=104, blade_x=(60, 102), half=14))
    A['tomahawk'] = ('Tomahawk', Shape([
        R('wood', 0, -3, 94, 3),
        P('head', (76, 3), (94, 3), (104, 24), (66, 24)),
        P('darksteel', (80, -3), (92, -3), (86, -20)),
    ], x0=0, x1=102, blade_x=(74, 100), half=10))
    A['battle_axe'] = ('Doppelaxt', Shape([
        R('wood', 0, -3, 100, 3),
        blade([(72, 3), (60, 14), (64, 26)], [(90, 3), (100, 14), (96, 26)], part='head'),
        blade([(72, -3), (60, -14), (64, -26)], [(90, -3), (100, -14), (96, -26)], part='head'),
    ], x0=0, x1=104, blade_x=(60, 100), half=18))
    A['ice_axe'] = ('Eispickel', Shape([
        R('black', 0, -3, 92, 3), R('darksteel', 84, -7, 98, 7),
        blade([(84, 7), (80, 20), (64, 34)], [(98, 7), (94, 20), (64, 34)], part='head'),
        P('head', (84, -7), (98, -7), (100, -21), (86, -21)),
    ], x0=0, x1=100, blade_x=(76, 98), half=16))
    A['viking'] = ('Wikinger-Axt', Shape([
        R('wood', 0, -3, 100, 3),
        P('head', (80, 3), (98, 3), (104, 26), (84, 26), (74, 18), (56, 22), (64, 3)),
        R('darksteel', 82, -5, 96, -3),
    ], x0=0, x1=104, blade_x=(66, 102), half=12))
    A['cleaver'] = ('Hackebeil', Shape([
        R('black', 0, -3.5, 46, 3.5),
        P('head', (44, -2), (100, -2), (100, 26), (52, 26), (44, 18)), HOLE_C(92, 19, 2.6),
    ], x0=0, x1=102, blade_x=(44, 100), half=14))
    A['fire_axe'] = ('Feuerwehraxt', Shape([
        R('paint_red', 0, -3.2, 96, 3.2), R('black', 0, -3.4, 22, 3.4),
        P('paint_red', (72, 3), (94, 3), (100, 20), (64, 20)),
        P('head', (64, 16), (100, 16), (102, 24), (60, 24)),
        P('darksteel', (74, -3), (92, -3), (84, -22)),
    ], x0=0, x1=104, blade_x=(60, 102), half=12))
    A['shovel'] = ('Klappspaten', Shape([
        R('olive', 0, -3.2, 72, 3.2), P('olive', (0, -6), (6, -6), (6, 6), (0, 6)),
        P('head', (70, -12), (92, -12), (100, 0), (92, 12), (70, 12)),
    ], x0=0, x1=102, blade_x=(70, 100), half=12))
    return A


# ---------------------------------------------------------------- Streitkolben
def maces():
    M = {}
    M['dz_hammer'] = ('Danger-Zone-Hammer', Shape([
        R('black', 0, -3.2, 80, 3.2),
        R('head', 74, -15, 96, 15),
    ], x0=0, x1=98, blade_x=(74, 96), half=15))
    M['wrench'] = ('Schraubenschlüssel', Shape([
        P('darksteel', (0, -3.5), (76, -3.5), (76, 3.5), (0, 3.5)), HOLE_C(6, 0, 1.8),
        P('head', (74, -10), (100, -10), (100, -3.5), (86, -3.5), (86, 3.5), (100, 3.5), (100, 10), (74, 10)),
    ], x0=0, x1=102, blade_x=(74, 100), half=10))
    M['morning_star'] = ('Morgenstern', Shape([
        R('wood', 0, -3, 78, 3),
        C('head', 85, 0, 14.5),
        P('head', (80, 10), (84, 20), (88, 10)), P('head', (80, -10), (84, -20), (88, -10)),
        P('head', (96, 6), (106, 0), (96, -6)), P('head', (92, 9), (100, 16), (96, 6)), P('head', (92, -9), (100, -16), (96, -6)),
    ], x0=0, x1=108, blade_x=(74, 106), half=14))
    M['war_hammer'] = ('Kriegshammer', Shape([
        R('wood', 0, -3, 92, 3),
        R('head', 74, 3, 94, 20),
        P('head', (74, -3), (94, -3), (84, -26)),
        P('head', (86, -4), (86, 4), (106, 0)),
    ], x0=0, x1=104, blade_x=(78, 102), half=16))
    M['mjolnir'] = ('Thors Hammer', Shape([
        C('leather', 2, 0, 4.5), HOLE_C(2, 0, 2.2),
        R('leather', 4, -3.5, 66, 3.5),
        R('head', 64, -17, 100, 17), R('gold', 64, -17, 68, 17),
    ], x0=-3, x1=101, blade_x=(64, 100), half=17))
    M['sledgehammer'] = ('Vorschlaghammer', Shape([
        R('lightwood', 0, -2.8, 84, 2.8),
        R('head', 80, -13, 100, 13),
    ], x0=0, x1=101, blade_x=(80, 100), half=13))
    M['baseball'] = ('Baseballschläger', Shape([
        C('head', 3, 0, 4.5),
        blade([(0, 3), (40, 3.6), (70, 6.5), (100, 7.5)], [(0, -3), (40, -3.6), (70, -6.5), (100, -7.5)], part='head'),
        C('head', 98, 0, 7.5),
    ], x0=-2, x1=106, blade_x=(0, 106), half=7.5))
    M['scepter'] = ('Zepter', Shape([
        R('gold', 0, -2.6, 78, 2.6), C('gold', 2, 0, 4),
        P('head', (68, 0), (84, 15), (104, 0), (84, -15)),
        C('gem', 85, 0, 6.5),
    ], x0=-2, x1=101, blade_x=(76, 100), half=10))
    return M


# ---------------------------------------------------------------- Speere
def spears():
    S = {}
    S['lance'] = ('Lanze', Shape([
        R('wood', 0, -2.4, 74, 2.4), R('darksteel', 72, -3.6, 76, 3.6),
        blade([(76, 3.5), (86, 6), (100, 0)], [(76, -3.5), (86, -6), (100, 0)]),
    ], blade_x=(76, 100), half=6))
    S['naginata'] = ('Naginata', Shape([
        R('black', 0, -2.4, 68, 2.4), R('gold', 66, -4.2, 70, 4.2),
        blade([(70, 3), (86, 3.5), (100, 7)], [(70, -3), (88, -3.5), (100, 7)]),
    ], blade_x=(70, 100), half=5))
    S['halberd'] = ('Hellebarde', Shape([
        R('wood', 0, -2.4, 88, 2.4),
        blade([(80, 2), (100, 1.4)], [(80, -2), (100, -1.4)]),
        P('head', (72, 2), (86, 2), (90, 13), (70, 13)),
        P('head', (76, -2), (84, -2), (80, -10)),
    ], blade_x=(70, 100), half=10))
    S['trident_spear'] = ('Dreizack', Shape([
        R('darksteel', 0, -2.4, 80, 2.4), R('head', 78, -9, 82, 9),
        P('head', (82, 1.6), (100, 0.8), (100, -0.8), (82, -1.6)),
        P('head', (82, 9), (95, 8), (95, 6.5), (82, 6)),
        P('head', (82, -9), (95, -8), (95, -6.5), (82, -6)),
    ], blade_x=(78, 100), half=9))
    S['bayonet_spear'] = ('Bajonett-Speer', Shape([
        R('olive', 0, -2.6, 72, 2.6), R('darksteel', 70, -5.5, 74, 5.5),
        blade([(74, 3.5), (92, 3.5), (100, 0)], [(74, -3.5), (92, -3.5), (100, 0)]),
    ], blade_x=(74, 100), half=4))
    S['glaive'] = ('Glefe', Shape([
        R('black', 0, -2.4, 66, 2.4),
        blade([(64, 3), (84, 7), (100, 4)], [(64, -3), (84, -3), (100, 4)]),
    ], blade_x=(64, 100), half=6))
    return S


# ---------------------------------------------------------------- Schild-Designs (Vorderseite 24x44)
def shield_front(design):
    W, H = 24, 44
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    trim = (60, 62, 68)

    def put(x, y, c):
        img.putpixel((x, y), (int(clamp(c[0])), int(clamp(c[1])), int(clamp(c[2])), 255))

    for y in range(H):
        for x in range(W):
            u = y / (H - 1)
            v = (x - W / 2) / (W / 2)
            if design in FIN:
                c = FIN[design][3](1 - u, v * 0.6, x, y)
                tr = (70, 72, 80)
            elif design == 'riot':
                c = (28, 30, 34) if not (10 <= y <= 15) else (220, 220, 225)
                if 13 <= y <= 30 and 5 <= x <= 18 and not (10 <= y <= 15):
                    c = mix((80, 110, 140), (150, 190, 220), (x - 5) / 13 * 0.5 + (30 - y) / 17 * 0.5)
                tr = (20, 20, 24)
            elif design == 'ballistic':
                c = mix((92, 96, 90), (120, 124, 116), fbm(x, y, 5, 4.0))
                if 6 <= y <= 9 and 4 <= x <= 19:
                    c = (24, 30, 36)
                tr = (50, 52, 48)
            elif design == 'spartan':
                c = mix((176, 112, 40), (226, 160, 70), (1 - abs(v)) * 0.6 + fbm(x, y, 9, 4.0) * 0.4)
                lam = (abs((x - W / 2) - (y - 8) * 0.35) < 1.2 or abs((x - W / 2) + (y - 8) * 0.35) < 1.2) and 8 <= y <= 36
                if lam:
                    c = (150, 20, 20)
                tr = (120, 70, 20)
            elif design == 'crusader':
                c = (232, 230, 220)
                if abs(x - W / 2 + 0.5) <= 2 or (13 <= y <= 17):
                    c = (190, 20, 26)
                tr = (110, 110, 110)
            elif design == 'star':
                c = (24, 44, 120)
                cx, cy = W / 2 - 0.5, H / 2
                d = math.hypot((x - cx), (y - cy) * 0.6)
                ang = math.atan2(y - cy, x - cx)
                rad = 4.2 + 6.0 * ((math.cos(5 * (ang + math.pi / 2)) + 1) / 2) ** 2.2
                if d < rad:
                    c = mix((250, 214, 90), (200, 140, 30), d / 10)
                if y in (5, 38):
                    c = (200, 160, 50)
                tr = (200, 160, 50)
            elif design == 'dragon':
                c = mix((20, 22, 26), (40, 44, 50), fbm(x, y, 13, 5.0))
                n = fbm(x, y, 17, 4.0)
                cx = W / 2 + math.sin(y * 0.35) * 5
                if abs(x - cx) < 2.2 + n * 1.2 and 4 < y < 40:
                    c = mix((200, 40, 30), (250, 170, 60), n)
                tr = (150, 120, 40)
            elif design == 'neon':
                c = (14, 12, 24)
                if (x + y) % 9 == 0 or (x - y) % 13 == 0:
                    c = (40, 230, 255)
                if (x * 3 + y) % 17 == 0:
                    c = (255, 50, 200)
                tr = (60, 30, 90)
            elif design == 'wood':
                c = mix((112, 72, 40), (150, 102, 58), (math.sin(x * 1.6 + fbm(x, y, 3, 6.0) * 4) + 1) / 2)
                if y in (8, 9, 34, 35):
                    c = (96, 98, 106)
                tr = (80, 82, 90)
            else:
                c = (255, 0, 255)
                tr = (0, 0, 0)
            if x == 0 or y == 0 or x == W - 1 or y == H - 1:
                c = tr
            elif x == 1 or y == 1 or x == W - 2 or y == H - 2:
                c = mix(c, tr, 0.5)
            put(x, y, c)
    return img


SHIELD_DESIGNS = [
    ('riot', 'Riot (SWAT)', 4), ('ballistic', 'Ballistik-Schild', 3), ('spartan', 'Spartaner', 4),
    ('crusader', 'Kreuzritter', 3), ('star', 'Sternschild', 5), ('dragon', 'Drache', 5), ('neon', 'Neon', 4),
    ('wood', 'Holz & Eisen', 1),
    ('fade', 'Fade', 5), ('doppler', 'Doppler', 5), ('ruby', 'Ruby', 6), ('sapphire', 'Sapphire', 6),
    ('emerald', 'Emerald', 6), ('tiger_tooth', 'Tiger Tooth', 4), ('crimson_web', 'Crimson Web', 4),
    ('case_hardened', 'Case Hardened', 4), ('marble_fade', 'Marble Fade', 5), ('night', 'Night', 3),
]


def shield_texture(design):
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    img.paste(shield_front(design), (0, 0))
    back = Image.new('RGBA', (24, 44))
    for y in range(44):
        for x in range(24):
            c = mix((92, 62, 36), (122, 84, 50), (math.sin(x * 1.3 + fbm(x, y, 4, 5.0) * 3) + 1) / 2)
            if x in (0, 23) or y in (0, 43):
                c = (64, 66, 72)
            back.putpixel((x, y), tuple(int(v) for v in c) + (255,))
    img.paste(back, (24, 0))
    edge = Image.new('RGBA', (16, 64), (76, 78, 86, 255))
    img.paste(edge, (48, 0))
    strip = Image.new('RGBA', (48, 4), (76, 78, 86, 255))
    img.paste(strip, (0, 44))
    for y in range(52, 64):
        for x in range(52, 64):
            img.putpixel((x, y), (100, 66, 38, 255))
    return img


def shield_model(name, blocking):
    if blocking:
        display = {
            "thirdperson_righthand": {"rotation": [45, 155, 0], "translation": [-3.49, 11, -2], "scale": [1, 1, 1]},
            "thirdperson_lefthand": {"rotation": [45, 155, 0], "translation": [11.51, 7, 2.5], "scale": [1, 1, 1]},
            "firstperson_righthand": {"rotation": [0, 180, -5], "translation": [-15, 5, -11], "scale": [1.25, 1.25, 1.25]},
            "firstperson_lefthand": {"rotation": [0, 180, -5], "translation": [5, 5, -11], "scale": [1.25, 1.25, 1.25]},
            "gui": {"rotation": [15, -25, -5], "translation": [2, 3, 0], "scale": [0.65, 0.65, 0.65]},
        }
    else:
        display = {
            "thirdperson_righthand": {"rotation": [0, 90, 0], "translation": [10, 6, -4], "scale": [1, 1, 1]},
            "thirdperson_lefthand": {"rotation": [0, 90, 0], "translation": [10, 6, 12], "scale": [1, 1, 1]},
            "firstperson_righthand": {"rotation": [0, 180, 5], "translation": [-10, 2, -10], "scale": [1.25, 1.25, 1.25]},
            "firstperson_lefthand": {"rotation": [0, 180, 5], "translation": [10, 0, -10], "scale": [1.25, 1.25, 1.25]},
            "gui": {"rotation": [15, -25, -5], "translation": [2, 3, 0], "scale": [0.65, 0.65, 0.65]},
            "fixed": {"rotation": [0, 180, 0], "translation": [-4.5, 4.5, -5], "scale": [0.55, 0.55, 0.55]},
            "on_shelf": {"rotation": [0, 0, 0], "translation": [11, 18.5, 8.7], "scale": [1.4, 1.4, 1.4]},
            "ground": {"rotation": [0, 0, 0], "translation": [2, 4, 2], "scale": [0.25, 0.25, 0.25]},
        }
    tex = f"{NS}:item/{name}"
    edge_ns = [12, 0, 12.5, 11]
    edge_ud = [0, 11, 6, 11.5]
    handle = [13, 13, 16, 16]
    return {
        "gui_light": "front",
        "textures": {"shield": tex, "particle": tex},
        "elements": [
            {"from": [-6, -11, 1], "to": [6, 11, 2], "faces": {
                "south": {"uv": [0, 0, 6, 11], "texture": "#shield"},
                "north": {"uv": [0, 0, 6, 11], "texture": "#shield"},
                "east": {"uv": edge_ns, "texture": "#shield"},
                "west": {"uv": edge_ns, "texture": "#shield"},
                "up": {"uv": edge_ud, "texture": "#shield"},
                "down": {"uv": edge_ud, "texture": "#shield"}}},
            {"from": [-1, -3, -5], "to": [1, 3, 1], "faces": {
                f: {"uv": handle, "texture": "#shield"} for f in ("north", "south", "east", "west", "up", "down")}},
        ],
        "display": display,
    }


# ---------------------------------------------------------------- kleine Gegenstaende (32x32, von Hand gezeichnet)
class Canvas:
    def __init__(self, size=32):
        self.s = size
        self.img = Image.new('RGBA', (size, size), (0, 0, 0, 0))

    def px(self, x, y, c):
        if 0 <= x < self.s and 0 <= y < self.s:
            self.img.putpixel((int(x), int(y)), (int(clamp(c[0])), int(clamp(c[1])), int(clamp(c[2])), 255))

    def get(self, x, y):
        if 0 <= x < self.s and 0 <= y < self.s:
            return self.img.getpixel((int(x), int(y)))
        return (0, 0, 0, 0)

    def rect(self, x0, y0, x1, y1, c, shade=True):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                f = 1.0
                if shade:
                    f = 1.15 - 0.4 * (x - x0) / max(1, x1 - x0)
                self.px(x, y, mul(c, f))

    def ellipse(self, cx, cy, rx, ry, c, shade=True):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if d <= 1.0:
                    f = 1.0
                    if shade:
                        lx = (x + 0.5 - (cx - rx * 0.35)) / rx
                        ly = (y + 0.5 - (cy - ry * 0.35)) / ry
                        f = 1.25 - 0.55 * min(1.0, math.hypot(lx, ly))
                    self.px(x, y, mul(c, f))

    def clear_ellipse(self, cx, cy, rx, ry):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0 and 0 <= x < self.s and 0 <= y < self.s:
                    self.img.putpixel((x, y), (0, 0, 0, 0))

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            t = i / max(1, n - 1)
            self.px(round(lerp(x0, x1, t)), round(lerp(y0, y1, t)), c)

    def outline(self, col=None, f=0.5):
        src = self.img.copy()
        for y in range(self.s):
            for x in range(self.s):
                p = src.getpixel((x, y))
                if p[3] == 0:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    qx, qy = x + dx, y + dy
                    if not (0 <= qx < self.s and 0 <= qy < self.s) or src.getpixel((qx, qy))[3] == 0:
                        c = col if col else mul(p[:3], f)
                        self.px(x, y, c)
                        break


def grenade(kind):
    cv = Canvas()
    if kind == 'he':
        cv.ellipse(15, 19, 8, 10, (92, 108, 58))
        for y in (14, 19, 24):
            for x in range(8, 24):
                if cv.get(x, y)[3]:
                    cv.px(x, y, mul(cv.get(x, y)[:3], 0.7))
        cv.rect(12, 7, 18, 10, (120, 124, 130))
        cv.rect(19, 8, 22, 22, (150, 154, 160))
        cv.ellipse(10, 6, 3, 3, (190, 190, 196), shade=False)
        cv.clear_ellipse(10, 6, 1.6, 1.6)
    elif kind in ('flash', 'smoke', 'incendiary', 'decoy', 'ta'):
        body = {'flash': (170, 176, 186), 'smoke': (110, 122, 104), 'incendiary': (176, 54, 30),
                'decoy': (140, 116, 76), 'ta': (90, 70, 150)}[kind]
        band = {'flash': (60, 120, 220), 'smoke': (220, 200, 60), 'incendiary': (250, 170, 40),
                'decoy': (70, 60, 40), 'ta': (230, 230, 240)}[kind]
        cv.rect(9, 10, 21, 28, body)
        cv.rect(9, 15, 21, 17, band)
        if kind == 'smoke':
            for y in (21, 24):
                for x in (11, 14, 17, 20):
                    cv.px(x, y, (40, 46, 40))
        cv.rect(12, 6, 18, 9, (120, 124, 130))
        cv.rect(19, 7, 22, 20, (156, 160, 166))
        cv.ellipse(10, 5, 3, 3, (190, 190, 196), shade=False)
        cv.clear_ellipse(10, 5, 1.6, 1.6)
        if kind == 'decoy':
            cv.line(15, 6, 15, 0, (40, 40, 40))
    elif kind == 'molotov':
        cv.rect(10, 13, 21, 29, (126, 74, 30))
        cv.rect(10, 22, 21, 26, (230, 220, 200))
        cv.rect(13, 6, 18, 12, (110, 66, 26))
        cv.rect(12, 3, 19, 6, (210, 200, 180), shade=False)
        cv.ellipse(15.5, 2.5, 3, 3, (255, 150, 30), shade=False)
        cv.ellipse(15.5, 3, 1.6, 2, (255, 230, 90), shade=False)
    cv.outline()
    return cv.img


def wind_skin(kind):
    cv = Canvas()
    if kind == 'smoke_bomb':
        cv.ellipse(15, 18, 10, 10, (40, 42, 48))
        cv.rect(14, 5, 17, 8, (90, 90, 96))
        cv.line(17, 5, 22, 1, (150, 120, 70))
        cv.px(23, 0, (255, 200, 60))
        cv.px(22, 0, (255, 120, 30))
    elif kind == 'vortex':
        cv.ellipse(16, 16, 12, 12, (20, 70, 96), shade=False)
        for i in range(220):
            t = i / 220 * math.pi * 4.2
            r = 1 + t * 0.8
            x = 16 + math.cos(t) * r
            y = 16 + math.sin(t) * r
            c = mix((40, 220, 240), (210, 250, 255), i / 220)
            for dx in (0, 1):
                for dy in (0, 1):
                    cv.px(round(x) + dx, round(y) + dy, c)
    elif kind == 'lightning':
        cv.ellipse(16, 16, 11, 11, (60, 50, 120))
        pts = [(19, 5), (12, 16), (17, 16), (11, 27), (22, 13), (17, 13), (21, 5)]
        for a, b in zip(pts, pts[1:]):
            cv.line(a[0], a[1], b[0], b[1], (255, 236, 80))
    elif kind == 'frost':
        cv.ellipse(16, 16, 11, 11, (150, 210, 240))
        for k in range(6):
            a = k * math.pi / 3
            cv.line(16, 16, 16 + math.cos(a) * 9, 16 + math.sin(a) * 9, (250, 255, 255))
    cv.outline()
    return cv.img


def totem_skin(kind):
    cv = Canvas()
    if kind == 'medishot':
        cv.rect(13, 6, 18, 24, (220, 225, 230))
        cv.rect(14, 9, 17, 22, (220, 40, 50))
        cv.rect(10, 4, 21, 5, (200, 200, 205))
        cv.rect(14, 1, 17, 3, (160, 160, 170))
        cv.line(15, 25, 15, 30, (200, 200, 210))
        cv.line(16, 25, 16, 29, (160, 160, 170))
        cv.rect(11, 12, 12, 14, (250, 250, 250), shade=False)
    elif kind == 'defuse_kit':
        cv.rect(6, 10, 25, 25, (48, 70, 52))
        cv.rect(6, 10, 25, 12, (30, 44, 32))
        cv.rect(10, 15, 13, 22, (180, 180, 186))
        cv.rect(18, 15, 21, 22, (220, 180, 40))
        cv.rect(14, 6, 17, 10, (40, 40, 40))
    elif kind == 'c4':
        cv.rect(5, 11, 26, 25, (186, 170, 120))
        cv.rect(5, 17, 26, 18, (60, 60, 60))
        cv.rect(9, 7, 22, 15, (40, 40, 44))
        cv.rect(11, 8, 20, 10, (60, 200, 80), shade=False)
        for x in (11, 14, 17, 20):
            cv.px(x, 13, (200, 200, 200))
        cv.line(6, 25, 3, 29, (200, 30, 30))
        cv.line(25, 25, 28, 29, (40, 80, 200))
    elif kind == 'dogtags':
        cv.line(8, 2, 14, 12, (170, 170, 176))
        cv.line(24, 2, 18, 12, (170, 170, 176))
        cv.rect(9, 12, 18, 26, (196, 198, 206))
        cv.rect(14, 15, 23, 29, (172, 174, 184))
        for y in (18, 21, 24):
            cv.line(16, y, 21, y, (110, 110, 118))
    elif kind == 'heart':
        for y in range(32):
            for x in range(32):
                X = (x - 15.5) / 11
                Y = -(y - 15) / 11
                if (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0:
                    cv.px(x, y, mix((250, 80, 120), (150, 10, 50), (y - 6) / 22))
        cv.px(11, 9, (255, 220, 230))
        cv.px(12, 9, (255, 220, 230))
        cv.px(11, 10, (255, 220, 230))
    cv.outline()
    return cv.img


# ---------------------------------------------------------------- Ausgabe
RARITY_NAMES = ['Konsum', 'Industrie', 'Militär', 'Begrenzt', 'Geheim', 'Verdeckt', '★ Gold']


def write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def save_png(img, rel):
    p = os.path.join(RES, 'textures', 'item', rel + '.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, optimize=True)


def item_def(name, model_json):
    write_json(os.path.join(RES, 'items', name + '.json'), model_json)


def simple_model(name, parent, tex=None):
    write_json(os.path.join(RES, 'models', 'item', name + '.json'),
               {"parent": parent, "textures": {"layer0": f"{NS}:item/{tex or name}"}})


def knife_preview(out, names):
    sheet = Image.new('RGBA', (len(names) * 260, 260), (54, 57, 63, 255))
    K = knives()
    for i, (sid, fid) in enumerate(names):
        img, _ = render_knife(sid, K[sid][1], fid)
        sheet.alpha_composite(img.resize((256, 256), Image.NEAREST), (i * 260, 2))
    sheet.save(out)


def main():
    if '--knife-preview' in sys.argv:
        out = sys.argv[sys.argv.index('--knife-preview') + 1]
        pairs = [a.split(':') for a in sys.argv[sys.argv.index('--knife-preview') + 2:]]
        knife_preview(out, pairs)
        return
    preview_dir = None
    if '--preview' in sys.argv:
        preview_dir = sys.argv[sys.argv.index('--preview') + 1]
    for sub in ('items', 'models', os.path.join('textures', 'item')):
        shutil.rmtree(os.path.join(RES, sub), ignore_errors=True)

    cats = []
    previews = {}

    def finish_list(ids):
        return [{"id": f, "name": FIN[f][1], "rarity": FIN[f][2]} for f in ids]

    def tool_cat(cid, name, shapes, finishes, parent, size, items, start, end, spear=False):
        sh_list = []
        rows = []
        for sid, (sname, shape) in shapes.items():
            sh_list.append({"id": sid, "name": sname})
            row = []
            for fid in finishes:
                key = f"{cid}_{sid}_{fid}"
                img = render(shape, size, start, end, fid)
                save_png(img, key)
                row.append(img)
                if spear:
                    icon = render(shape, 16, (1.0, 15.0), (15.0, 1.0), fid)
                    save_png(icon, key + '_icon')
                    simple_model(key + '_icon', 'minecraft:item/generated')
                    simple_model(key, 'minecraft:item/spear_in_hand')
                    item_def(key, {"model": {"type": "minecraft:select", "property": "minecraft:display_context",
                                             "cases": [{"when": ["gui", "ground", "fixed", "on_shelf"],
                                                        "model": {"type": "minecraft:model", "model": f"{NS}:item/{key}_icon"}}],
                                             "fallback": {"type": "minecraft:model", "model": f"{NS}:item/{key}"}},
                                   "swap_animation_scale": 1.95})
                else:
                    simple_model(key, parent)
                    item_def(key, {"model": {"type": "minecraft:model", "model": f"{NS}:item/{key}"}})
            rows.append(row)
        cats.append({"id": cid, "name": name, "items": items, "shapes": sh_list, "finishes": finish_list(finishes)})
        previews[cid] = rows

    def knife_cat(items):
        sh_list = []
        rows = []
        finishes = [f[0] for f in FINISHES]
        for sid, (sname, shape) in knives().items():
            sh_list.append({"id": sid, "name": sname})
            row = []
            shape_written = False
            for fid in finishes:
                key = f"knife_{sid}_{fid}"
                img, cls = render_knife(sid, shape, fid)
                if not shape_written:
                    write_json(os.path.join(RES, 'models', 'item', f'knife_shape_{sid}.json'), knife_shape_model(cls))
                    shape_written = True
                save_png(img, key)
                row.append(img)
                write_json(os.path.join(RES, 'models', 'item', key + '.json'),
                           {"parent": f"{NS}:item/knife_shape_{sid}", "textures": {"tex": f"{NS}:item/{key}"}})
                item_def(key, {"model": {"type": "minecraft:model", "model": f"{NS}:item/{key}"}})
            rows.append(row)
        cats.append({"id": "knife", "name": "Messer", "items": items, "shapes": sh_list, "finishes": finish_list(finishes)})
        previews['knife'] = rows

    mats = ['wooden', 'stone', 'copper', 'iron', 'golden', 'diamond', 'netherite']
    knife_cat([m + '_sword' for m in mats])
    tool_cat('axe', 'Äxte', axes(), TOOL_FINISHES, 'minecraft:item/handheld', 32,
             [m + '_axe' for m in mats], (3.0, 30.0), (29.0, 3.0))
    tool_cat('mace', 'Kolben', maces(), TOOL_FINISHES, 'minecraft:item/handheld_mace', 32,
             ['mace'], (3.0, 30.0), (29.0, 3.0))
    tool_cat('spear', 'Speere', spears(), TOOL_FINISHES, None, 32,
             [m + '_spear' for m in mats], (31.0, 31.0), (0.5, 0.5), spear=True)

    # Schild
    sh_rows = []
    for did, dname, rar in SHIELD_DESIGNS:
        key = f"shield_{did}"
        img = shield_texture(did)
        save_png(img, key)
        sh_rows.append(img.crop((0, 0, 24, 44)))
        write_json(os.path.join(RES, 'models', 'item', key + '.json'), shield_model(key, False))
        write_json(os.path.join(RES, 'models', 'item', key + '_blocking.json'), shield_model(key, True))
        item_def(key, {"model": {"type": "minecraft:condition", "property": "minecraft:using_item",
                                 "on_true": {"type": "minecraft:model", "model": f"{NS}:item/{key}_blocking"},
                                 "on_false": {"type": "minecraft:model", "model": f"{NS}:item/{key}"}}})
    cats.append({"id": "shield", "name": "Schilde", "items": ["shield"], "shapes": [],
                 "finishes": [{"id": d, "name": n, "rarity": r} for d, n, r in SHIELD_DESIGNS]})
    previews['shield'] = [sh_rows]

    def flat_cat(cid, name, items, entries, fn):
        row = []
        for eid, ename, rar in entries:
            key = f"{cid}_{eid}"
            img = fn(eid)
            save_png(img, key)
            row.append(img)
            simple_model(key, 'minecraft:item/generated')
            item_def(key, {"model": {"type": "minecraft:model", "model": f"{NS}:item/{key}"}})
        cats.append({"id": cid, "name": name, "items": items, "shapes": [],
                     "finishes": [{"id": e, "name": n, "rarity": r} for e, n, r in entries]})
        previews[cid] = [row]

    flat_cat('grenade', 'Perlen', ['ender_pearl'], [
        ('he', 'HE-Granate', 3), ('flash', 'Blendgranate', 3), ('smoke', 'Rauchgranate', 3),
        ('molotov', 'Molotow', 4), ('incendiary', 'Brandgranate', 4), ('decoy', 'Lockvogel', 2),
        ('ta', 'Taktische Granate', 5)], grenade)
    flat_cat('wind', 'Wind', ['wind_charge'], [
        ('smoke_bomb', 'Rauchbombe', 3), ('vortex', 'Wirbel', 4), ('lightning', 'Blitzkugel', 5),
        ('frost', 'Frostkugel', 4)], wind_skin)
    flat_cat('totem', 'Totems', ['totem_of_undying'], [
        ('medishot', 'Medi-Shot', 4), ('defuse_kit', 'Entschärfer-Set', 3), ('c4', 'C4', 5),
        ('dogtags', 'Erkennungsmarken', 3), ('heart', 'Kristallherz', 5)], totem_skin)

    write_json(os.path.join(RES, 'skins.json'), {"rarities": RARITY_NAMES, "categories": cats})
    n = sum(len(r) for rows in previews.values() for r in rows)
    print('Skins erzeugt:', n)

    if preview_dir:
        os.makedirs(preview_dir, exist_ok=True)
        for cid, rows in previews.items():
            cols = max(len(r) for r in rows)
            w = max(im.size[0] for r in rows for im in r)
            h = max(im.size[1] for r in rows for im in r)
            sheet = Image.new('RGBA', (cols * (w + 2) * 3, len(rows) * (h + 2) * 3), (54, 57, 63, 255))
            for ry, r in enumerate(rows):
                for cx, im in enumerate(r):
                    big = im.resize((im.size[0] * 3, im.size[1] * 3), Image.NEAREST)
                    sheet.alpha_composite(big, (cx * (w + 2) * 3, ry * (h + 2) * 3))
            sheet.save(os.path.join(preview_dir, f'preview_{cid}.png'))


if __name__ == '__main__':
    main()
