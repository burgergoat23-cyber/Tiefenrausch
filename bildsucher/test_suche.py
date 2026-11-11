# -*- coding: utf-8 -*-
"""Test für die Bildsuche (ohne echten Bildschirm).

Baut künstliche "Bildschirme" (Hintergrundbild + Fenster mit Text +
viele ähnliche Ablenkungs-Symbole), klebt die gesuchten Symbole in
zufälligen Größen hinein und prüft:
  - werden sie gefunden?
  - wird nichts Falsches markiert?
  - wie schnell ist eine Suche?

Aufruf:  python test_suche.py [runden]
"""
import math
import os
import random
import sys
import time

import cv2
import numpy as np

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
from bildsucher import Sucher, Vorlage, _iou, bereite_vor  # noqa: E402

PROMO = os.path.join(HIER, "..", "promo")


def symbol(rnd, w, h):
    """Zufälliges App-/Spiel-Symbol."""
    img = np.zeros((h, w, 3), np.uint8)
    img[:] = [rnd.randint(0, 255) for _ in range(3)]
    for _ in range(rnd.randint(2, 5)):
        farbe = [rnd.randint(0, 255) for _ in range(3)]
        art = rnd.randint(0, 3)
        if art == 0:
            cv2.circle(img, (rnd.randint(0, w), rnd.randint(0, h)),
                       rnd.randint(min(w, h) // 8, min(w, h) // 2), farbe, -1, cv2.LINE_AA)
        elif art == 1:
            x, y = rnd.randint(0, w - 4), rnd.randint(0, h - 4)
            cv2.rectangle(img, (x, y), (x + rnd.randint(4, w), y + rnd.randint(4, h)), farbe, -1)
        elif art == 2:
            pts = np.array([[rnd.randint(0, w), rnd.randint(0, h)] for _ in range(3)], np.int32)
            cv2.fillPoly(img, [pts], farbe, cv2.LINE_AA)
        else:
            cv2.putText(img, rnd.choice("ABCDEFGHKMXZ0123456789$#@"),
                        (rnd.randint(0, w // 2), rnd.randint(h // 2, h)),
                        cv2.FONT_HERSHEY_SIMPLEX, min(w, h) / 40.0, farbe,
                        max(1, min(w, h) // 20), cv2.LINE_AA)
    return img


def bildschirm(rnd, hinter):
    bild = hinter[rnd.randrange(len(hinter))].copy()
    # Fenster mit Text
    for _ in range(rnd.randint(1, 4)):
        x, y = rnd.randint(0, 1500), rnd.randint(0, 800)
        w, h = rnd.randint(300, 700), rnd.randint(200, 500)
        cv2.rectangle(bild, (x, y), (x + w, y + h), (245, 245, 245), -1)
        cv2.rectangle(bild, (x, y), (x + w, y + 28), (60, 90, 160), -1)
        for z in range(y + 50, min(1080, y + h), 22):
            text = "".join(rnd.choice("abcdefghijklmnop qrstuvwxyz") for _ in range(40))
            cv2.putText(bild, text, (x + 10, z), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        (30, 30, 30), 1, cv2.LINE_AA)
    return bild


def kleben(bild, img, x, y, w, h):
    inter = cv2.INTER_AREA if w < img.shape[1] else cv2.INTER_LINEAR
    bild[y:y + h, x:x + w] = cv2.resize(img, (w, h), interpolation=inter)


def main():
    runden = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    rnd = random.Random(11)
    hinter = [cv2.resize(cv2.imread(os.path.join(PROMO, n)), (1920, 1080),
                         interpolation=cv2.INTER_AREA)
              for n in ("hintergrund_pc_1920x1080.jpg", "youtube_thumbnail_1280x720.jpg",
                        "youtube_banner_2560x1440.jpg", "cover_1920x1080.png")]
    vorlagen = [Vorlage("v%d" % i, symbol(rnd, rnd.randint(32, 128), rnd.randint(32, 128)))
                for i in range(5)]
    # Symbol mit durchsichtigem Rand (PNG mit Alpha)
    rund = symbol(rnd, 96, 96)
    alpha = np.zeros((96, 96), np.uint8)
    cv2.circle(alpha, (48, 48), 46, 255, -1, cv2.LINE_AA)
    bgr, maske = bereite_vor(np.dstack([rund, alpha]))
    vorlagen.append(Vorlage("rund", bgr, maske))

    sucher = Sucher()
    treffer = verfehlt = falsch = 0
    zeiten = []
    for r in range(runden):
        bild = bildschirm(rnd, hinter)
        belegt = []

        def platz(w, h):
            for _ in range(50):
                x, y = rnd.randint(0, 1920 - w), rnd.randint(0, 1080 - h)
                box = (x - 6, y - 6, w + 12, h + 12)
                if all(_iou(box, b) == 0 for b in belegt):
                    belegt.append(box)
                    return x, y
            return None

        # Ablenkungen: ähnliche, aber andere Symbole
        for _ in range(15):
            w, h = rnd.randint(16, 140), rnd.randint(16, 140)
            p = platz(w, h)
            if p:
                kleben(bild, symbol(rnd, w, h), p[0], p[1], w, h)
        wahr = []
        for v in rnd.sample(vorlagen, rnd.randint(0, 4)):
            for _ in range(rnd.choice([1, 1, 2])):
                lo = max(0.2, 18.0 / min(v.w, v.h))
                s = math.exp(rnd.uniform(math.log(lo), math.log(5.0)))
                w, h = int(round(v.w * s)), int(round(v.h * s))
                if w > 1000 or h > 1000:
                    continue
                p = platz(w, h)
                if not p:
                    continue
                if v.maske is not None:
                    hg = bild[p[1]:p[1] + h, p[0]:p[0] + w].astype(np.float32)
                    vg = cv2.resize(v.bgr, (w, h)).astype(np.float32)
                    m = cv2.resize(v.maske, (w, h)).astype(np.float32)[:, :, None] / 255.0
                    bild[p[1]:p[1] + h, p[0]:p[0] + w] = (vg * m + hg * (1 - m)).astype(np.uint8)
                else:
                    kleben(bild, v.bgr, p[0], p[1], w, h)
                wahr.append((v, (p[0], p[1], w, h)))

        sucher.vorher = {}
        sucher._letzt_klein = None
        t0 = time.perf_counter()
        erg = sucher.suche(bild, vorlagen, 0.80, voll=True)
        zeiten.append(time.perf_counter() - t0)
        benutzt = set()
        for v, b in wahr:
            ok = [i for i, t in enumerate(erg)
                  if t.vorlage is v and _iou(b, (t.x, t.y, t.w, t.h)) > 0.5]
            if ok:
                treffer += 1
                benutzt.update(ok)
            else:
                verfehlt += 1
                print("  verfehlt: Runde %d %s Größe %dx%d bei %d,%d" % (r, v.name, b[2], b[3], b[0], b[1]))
        for i, t in enumerate(erg):
            if i not in benutzt:
                falsch += 1
                print("  FALSCH:   Runde %d %s bei %d,%d %dx%d (%.2f)"
                      % (r, t.vorlage.name, t.x, t.y, t.w, t.h, t.score))
    z = sorted(zeiten)
    print("Gefunden: %d  Verfehlt: %d  Falsch: %d" % (treffer, verfehlt, falsch))
    print("Zeit pro Suche (%d Bilder, 1920x1080, %d Kerne): Mittel %.0f ms, Median %.0f ms, max %.0f ms"
          % (len(vorlagen), os.cpu_count(), 1000 * sum(z) / len(z), 1000 * z[len(z) // 2], 1000 * z[-1]))
    # Tempo einer vollständigen Suche
    for n in (1, 3):
        t0 = time.perf_counter()
        for _ in range(5):
            sucher._letzt_klein = None
            sucher.suche(bild, vorlagen[:n], 0.80, voll=True)
        print("  volle Suche, %d Bild(er): %.0f ms" % (n, (time.perf_counter() - t0) / 5 * 1000))
    ok_l = laufend(sucher, vorlagen, hinter, rnd)
    return 0 if verfehlt <= max(1, treffer * 0.03) and falsch == 0 and ok_l else 1


def laufend(sucher, vorlagen, hinter, rnd):
    """Wie im echten Betrieb: Bild für Bild, ein Symbol wandert über den
    Bildschirm und verschwindet dann. Prüft Verfolgung, Verschwinden und Tempo."""
    sucher.vorher = {}
    sucher._key = None
    v = vorlagen[0]
    grund = bildschirm(rnd, hinter)
    w, h = int(v.w * 1.3), int(v.h * 1.3)
    zeiten, erstes, fehl, nach_weg = [], None, 0, 0
    for i in range(120):
        bild = grund.copy()
        da = i < 90
        if da:
            x, y = 100 + i * 15, 300 + int(150 * math.sin(i / 10.0))
            kleben(bild, v.bgr, x, y, w, h)
        t0 = time.perf_counter()
        erg = sucher.suche(bild, vorlagen, 0.80)
        zeiten.append(time.perf_counter() - t0)
        gef = [t for t in erg if t.vorlage is v]
        if da:
            if gef and _iou((x, y, w, h), (gef[0].x, gef[0].y, gef[0].w, gef[0].h)) > 0.5:
                if erstes is None:
                    erstes = i
            elif erstes is not None:
                fehl += 1
        elif gef:
            nach_weg += 1
    z = sorted(zeiten)
    print("Laufend (%d Bilder gesucht): zuerst gefunden nach %s Bildern, danach %d x verloren, "
          "%d x nach Verschwinden noch markiert; pro Bild Median %.0f ms, max %.0f ms"
          % (len(vorlagen), erstes, fehl, nach_weg, 1000 * z[len(z) // 2], 1000 * z[-1]))
    return erstes is not None and erstes <= 8 and fehl <= 2 and nach_weg == 0


if __name__ == "__main__":
    sys.exit(main())
