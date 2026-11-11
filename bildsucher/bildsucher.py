# -*- coding: utf-8 -*-
"""
Bildsucher – sucht Bilder auf dem Bildschirm und zeigt sie an.

- Man gibt dem Programm ein oder mehrere Bilder (Datei, Zwischenablage
  oder Ordner "bilder").
- Das Programm schaut ständig auf den Bildschirm. Findet es ein Bild
  (egal wie groß oder klein), bekommt es einen farbigen Rahmen und einen
  Strich von der Bildschirm-Mitte dorthin.
- Ist das Bild nicht mehr zu sehen, verschwinden Rahmen und Strich.

Gebaut für Windows 10/11. Benötigt: opencv-python, numpy, mss, pillow
(Start.bat installiert das automatisch).
"""

import ctypes
import math
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import cv2
import numpy as np

WIN = sys.platform.startswith("win")
ORDNER = os.path.dirname(os.path.abspath(__file__))
BILDER = os.path.join(ORDNER, "bilder")
ENDUNGEN = (".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp", ".tif", ".tiff")

# Farben für die Markierungen (eine pro Bild)
FARBEN = ["#ff3b3b", "#2ee66b", "#3b9bff", "#ffd23b", "#ff3bf0", "#3bffee",
          "#ff8c1a", "#b26bff", "#a6ff3b", "#ff6b9c"]


# ---------------------------------------------------------------------------
#  Bilder laden
# ---------------------------------------------------------------------------

def lade_bild(pfad):
    """Lädt ein Bild (auch mit Umlauten im Pfad). Gibt (bgr, maske) zurück."""
    daten = np.fromfile(pfad, dtype=np.uint8)
    img = cv2.imdecode(daten, cv2.IMREAD_UNCHANGED)
    if img is None:
        # z. B. GIF: über Pillow versuchen
        try:
            from PIL import Image
            with Image.open(pfad) as p:
                img = cv2.cvtColor(np.array(p.convert("RGBA")), cv2.COLOR_RGBA2BGRA)
        except Exception:
            return None, None
    return bereite_vor(img)


def bereite_vor(img):
    """Macht aus beliebigem Bild ein BGR-Bild + (optional) Maske für Transparenz."""
    if img.dtype != np.uint8:
        img = cv2.normalize(img, None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    if img.ndim == 2:
        return cv2.cvtColor(img, cv2.COLOR_GRAY2BGR), None
    if img.shape[2] == 4:
        alpha = img[:, :, 3]
        bgr = np.ascontiguousarray(img[:, :, :3])
        sicht = alpha > 20
        if not sicht.any():
            return bgr, None
        if sicht.all():
            return bgr, None
        ys, xs = np.where(sicht)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        bgr = bgr[y0:y1, x0:x1].copy()
        sicht = sicht[y0:y1, x0:x1]
        # durchsichtige Stellen mit der Durchschnittsfarbe füllen,
        # damit sie bei der Grobsuche kaum stören
        mittel = bgr[sicht].mean(axis=0)
        bgr[~sicht] = mittel.astype(np.uint8)
        maske = None if sicht.mean() > 0.97 else (sicht.astype(np.uint8) * 255)
        return bgr, maske
    return np.ascontiguousarray(img[:, :, :3]), None


class Vorlage:
    """Ein gesuchtes Bild mit vorberechneten Größen."""

    def __init__(self, name, bgr, maske=None, farbe="#ff3b3b"):
        self.name = name
        self.bgr = bgr
        self.maske = maske
        self.farbe = farbe
        self.gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        self.h, self.w = self.gray.shape
        self.flach = float(self.gray.std()) < 4.0  # einfarbig -> schlecht suchbar
        self._cache = {}
        self._lock = threading.Lock()

    def skaliert(self, w, h, art):
        """art: 'g' = grau, 'c' = farbig, 'm' = Maske"""
        key = (w, h, art)
        t = self._cache.get(key)
        if t is not None:
            return t
        quelle = {"g": self.gray, "c": self.bgr, "m": self.maske}[art]
        if quelle is None:
            return None
        inter = cv2.INTER_AREA if w < self.w else cv2.INTER_LINEAR
        t = cv2.resize(quelle, (w, h), interpolation=inter)
        if art == "m":
            t = np.where(t > 127, 255, 0).astype(np.uint8)
        with self._lock:
            if len(self._cache) > 600:
                self._cache.clear()
            self._cache[key] = t
        return t


# ---------------------------------------------------------------------------
#  Die eigentliche Suche
# ---------------------------------------------------------------------------

class Treffer:
    __slots__ = ("vorlage", "x", "y", "w", "h", "s", "score")

    def __init__(self, vorlage, x, y, w, h, s, score):
        self.vorlage, self.x, self.y, self.w, self.h = vorlage, x, y, w, h
        self.s, self.score = s, score


def _iou(a, b):
    x0, y0 = max(a[0], b[0]), max(a[1], b[1])
    x1, y1 = min(a[0] + a[2], b[0] + b[2]), min(a[1] + a[3], b[1] + b[3])
    if x1 <= x0 or y1 <= y0:
        return 0.0
    inter = (x1 - x0) * (y1 - y0)
    return inter / float(a[2] * a[3] + b[2] * b[3] - inter)


def _spitzen(r, anzahl, unten, tw, th):
    """Holt die besten Stellen aus einer Ergebnis-Karte (mit Unterdrückung)."""
    out = []
    np.nan_to_num(r, copy=False, nan=-1.0, posinf=-1.0, neginf=-1.0)
    for _ in range(anzahl):
        _, mx, _, (x, y) = cv2.minMaxLoc(r)
        if mx < unten:
            break
        out.append((mx, x, y))
        rx, ry = max(1, tw // 2), max(1, th // 2)
        r[max(0, y - ry):y + ry + 1, max(0, x - rx):x + rx + 1] = -1.0
    return out


class Sucher:
    """
    Schnelle Suche in allen Größen:
    1. Bildschirm wird als Pyramide (1/1, 1/2, 1/4, ...) verkleinert.
    2. Jede Größe des gesuchten Bildes wird auf der Stufe gesucht, auf der
       es nur noch ~8-16 Pixel groß ist  -> sehr schnell (Grobsuche, grau).
    3. Die besten Kandidaten werden in Farbe genau nachgeprüft (Feinsuche).
    """

    GROB_PX = 8       # Mindestgröße der Vorlage bei der Grobsuche
    FEIN_PX = 40      # Mindestgröße bei der Feinsuche
    STUFE = 1.2       # Größen-Schritt zwischen zwei Suchgrößen
    PRO_GROESSE = 3   # Kandidaten je Größe
    MAX_KANDIDATEN = 10
    PRO_STUFE = 2     # Kandidaten je Pyramiden-Stufe (fair über alle Größen)
    MAD_OK = 22.0     # erlaubte mittlere Farbabweichung je Pixel (0-255)
    MAX_TREFFER = 10  # höchstens so viele Fundstellen pro Bild

    def __init__(self, threads=None):
        self.threads = threads or max(2, min(8, (os.cpu_count() or 4)))
        self.pool = ThreadPoolExecutor(self.threads)
        self.min_px = 16          # kleinste gesuchte Größe (Pixel)
        self.vorher = {}          # Vorlage-id -> letzte Treffer
        self._letzt_klein = None
        self._letzt_ergebnis = []
        self._letzt_vorlagen = None
        self._letzt_schwelle = None
        self._key = None
        self._rr = 0              # nächste Grobsuch-Aufgabe (Runde um Runde)
        self._rest = 0            # Aufgaben bis zur vollen Runde seit letzter Änderung
        self.werte = {}           # Vorlage-id -> bester Wert der letzten Suche (Anzeige)
        self.budget_ms = 15       # Zeit pro Bild für die Suche nach neuen Fundstellen

    def groessen(self, v, W, H):
        s_min = self.min_px / float(min(v.w, v.h))
        s_max = min(W / float(v.w), H / float(v.h))
        if s_max < s_min:
            return []
        n = int(math.floor(math.log(s_max / s_min) / math.log(self.STUFE))) + 1
        return [s_min * self.STUFE ** i for i in range(n)] + [s_max]

    def suche(self, frame, vorlagen, schwelle=0.8, voll=False):
        """frame: BGR-Bild vom Bildschirm. Gibt Liste von Treffern zurück.

        Schon gefundene Stellen werden bei jedem Aufruf nachgeprüft (schnell).
        Die Suche nach neuen Stellen wird auf mehrere Aufrufe verteilt
        (höchstens budget_ms pro Aufruf), außer voll=True."""
        if not vorlagen:
            self.vorher = {}
            return []
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        pyr = [gray]
        while min(pyr[-1].shape) >= 48 and len(pyr) < 7:
            pyr.append(cv2.pyrDown(pyr[-1]))

        # Bildschirm unverändert? Dann alte Ergebnisse behalten (spart Rechenzeit)
        klein = pyr[min(3, len(pyr) - 1)]
        H, W = gray.shape
        aufgaben = []
        for v in vorlagen:
            for s in self.groessen(v, W, H):
                aufgaben.append((v, s))
        key = (tuple(id(v) for v in vorlagen), W, H, self.min_px, schwelle)
        if key != self._key:
            self._key = key
            self._rr = 0
            self._rest = len(aufgaben)
            self._letzt_klein = None
        gleich = (self._letzt_klein is not None and self._letzt_klein.shape == klein.shape
                  and cv2.norm(klein, self._letzt_klein, cv2.NORM_INF) <= 2)
        if gleich and self._rest <= 0:
            return self._letzt_ergebnis
        if not gleich:
            self._rest = len(aufgaben)
        unten = max(0.35, schwelle - 0.22)

        def grob(arg):
            v, s = arg
            tw, th = v.w * s, v.h * s
            gp = self.GROB_PX * (1.5 if v.maske is not None else 1.0)
            L = int(math.floor(math.log2(max(1.0, min(tw, th) / gp))))
            L = max(1 if len(pyr) > 1 else 0, min(L, len(pyr) - 1))
            img = pyr[L]
            f = 2 ** L
            lw, lh = int(round(tw / f)), int(round(th / f))
            if lw < 3 or lh < 3 or lw > img.shape[1] or lh > img.shape[0]:
                return v, []
            t = v.skaliert(lw, lh, "g")
            m = v.skaliert(lw, lh, "m") if v.maske is not None else None
            if m is not None and m.any() and not m.all():
                r = cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED, mask=m)
            else:
                r = cv2.matchTemplate(img, t, cv2.TM_CCOEFF_NORMED)
            out = []
            for sc, x, y in _spitzen(r, self.PRO_GROESSE, unten, lw, lh):
                out.append((sc, x * f, y * f, tw, th, s, L))
            return v, out

        # ---- Grobsuche: Bilder x Größen, parallel, Stück für Stück ----
        kand = {id(v): [] for v in vorlagen}
        n = len(aufgaben)
        t_start = time.perf_counter()
        erledigt = 0
        stueck = self.threads * 2
        while erledigt < n and (voll or self._rest > 0):
            k = min(stueck, n - erledigt)
            teil = [aufgaben[(self._rr + i) % n] for i in range(k)]
            self._rr = (self._rr + k) % n
            erledigt += k
            self._rest -= k
            for v, liste in self.pool.map(grob, teil):
                kand[id(v)].extend(liste)
            if not voll and (time.perf_counter() - t_start) * 1000 > self.budget_ms:
                break

        # ---- Kandidaten sortieren, doppelte entfernen ----
        fein_auftraege = []
        for v in vorlagen:
            liste = sorted(kand[id(v)], key=lambda k: -k[0])
            behalten = []
            je_stufe = {}
            alt = self.vorher.get(id(v), [])
            for k in liste:
                # schon verfolgte Stellen nicht doppelt prüfen
                if any(_iou((k[1], k[2], k[3], k[4]), (a.x, a.y, a.w, a.h)) > 0.3 for a in alt):
                    continue
                box = (k[1], k[2], k[3], k[4])
                if je_stufe.get(k[6], 0) >= self.PRO_STUFE:
                    continue
                if all(_iou(box, (b[1], b[2], b[3], b[4])) < 0.3 for b in behalten):
                    behalten.append(k)
                    je_stufe[k[6]] = je_stufe.get(k[6], 0) + 1
                if len(behalten) >= self.MAX_KANDIDATEN:
                    break
            for k in behalten:
                fein_auftraege.append((v, k[:6], False))
            # letzte Treffer immer nachprüfen (Verfolgung, auch wenn es sich bewegt)
            for t in self.vorher.get(id(v), []):
                fein_auftraege.append((v, (t.score, t.x, t.y, t.w, t.h, t.s), True))

        # Farb-Pyramide für die Feinsuche (einmal pro Bild)
        cpyr = [frame]
        if fein_auftraege:
            while len(cpyr) < len(pyr):
                cpyr.append(cv2.pyrDown(cpyr[-1]))

        def fein(arg):
            v, (sc0, x, y, tw, th, s), verfolgen = arg
            return v, self._fein(cpyr, v, x, y, tw, th, s, verfolgen, schwelle)

        ergebnis = []
        neu_vorher = {}
        roh = {}
        for v, t in self.pool.map(fein, fein_auftraege):
            if t is not None:
                roh.setdefault(id(v), []).append(t)

        self.werte = {k: max(t.score for t in ts) for k, ts in roh.items() if ts}
        for v in vorlagen:
            alt = self.vorher.get(id(v), [])
            liste = sorted(roh.get(id(v), []), key=lambda t: -t.score)
            gut = []
            for t in liste:
                box = (t.x, t.y, t.w, t.h)
                if any(_iou(box, (g.x, g.y, g.w, g.h)) > 0.3 for g in gut):
                    continue
                # Schwelle; etwas lockerer, wenn es schon vorher dort war
                war_da = any(_iou(box, (a.x, a.y, a.w, a.h)) > 0.4 for a in alt)
                if t.score >= schwelle or (war_da and t.score >= schwelle - 0.08):
                    gut.append(t)
                if len(gut) >= self.MAX_TREFFER:
                    break
            neu_vorher[id(v)] = gut
            ergebnis.extend(gut)
        self.vorher = neu_vorher

        self._letzt_klein = klein.copy()
        self._letzt_vorlagen = [id(v) for v in vorlagen]
        self._letzt_schwelle = schwelle
        self._letzt_ergebnis = ergebnis
        return ergebnis

    def _fein(self, cpyr, v, x, y, tw, th, s, verfolgen=False, schwelle=0.8):
        """Zweistufige Nachprüfung: erst Größe grob nachjustieren, dann genau."""
        rand = 0.7 if verfolgen else 0.22   # Verfolgung: größerer Suchbereich
        t = self._fein1(cpyr, v, x, y, tw, th, s, (0.85, 0.92, 1.0, 1.08, 1.17), 20, rand)
        if t is None or t.score < schwelle - 0.15:
            return t  # zu schwach – wird später verworfen, Wert dient nur der Anzeige
        return self._fein1(cpyr, v, t.x, t.y, t.w, t.h, t.s, (0.96, 1.0, 1.04), self.FEIN_PX, 0.15)

    def _fein1(self, cpyr, v, x, y, tw, th, s, faktoren, fein_px, randf=0.22):
        """Genaue Prüfung eines Kandidaten in Farbe, mit leicht anderen Größen."""
        frame = cpyr[0]
        H, W = frame.shape[:2]
        rand = int(max(tw, th) * randf) + 4
        x0, y0 = int(max(0, x - rand)), int(max(0, y - rand))
        x1, y1 = int(min(W, x + tw + rand)), int(min(H, y + th + rand))
        if x1 - x0 < 3 or y1 - y0 < 3:
            return None
        L = int(math.floor(math.log2(max(1.0, min(tw, th) / fein_px))))
        L = max(0, min(L, len(cpyr) - 1))
        f = float(2 ** L)
        roi = cpyr[L][y0 >> L:(y1 >> L) + 1, x0 >> L:(x1 >> L) + 1]
        x0, y0 = (x0 >> L) << L, (y0 >> L) << L
        best = None
        for k in faktoren:
            s2 = s * k
            fw, fh = v.w * s2, v.h * s2
            lw, lh = int(round(fw / f)), int(round(fh / f))
            if lw < 3 or lh < 3 or lw > roi.shape[1] or lh > roi.shape[0]:
                continue
            t = v.skaliert(lw, lh, "c")
            m = v.skaliert(lw, lh, "m") if v.maske is not None else None
            if m is not None and m.any() and not m.all():
                r = cv2.matchTemplate(roi, t, cv2.TM_CCOEFF_NORMED, mask=m)
            else:
                r = cv2.matchTemplate(roi, t, cv2.TM_CCOEFF_NORMED)
            np.nan_to_num(r, copy=False, nan=-1.0, posinf=-1.0, neginf=-1.0)
            _, mx, _, (px, py) = cv2.minMaxLoc(r)
            if best is None or mx > best[0]:
                best = (mx, px, py, fw, fh, s2)
        if best is None:
            return None
        mx, px, py, fw, fh, s2 = best
        # Farbe und Kontrast müssen auch passen (die Korrelation allein
        # würde z. B. ein dunkles Abbild auch als Treffer zählen)
        tx, ty = px + int(round(fw / f)), py + int(round(fh / f))
        stueck = roi[py:ty, px:tx]
        vt = v.skaliert(int(round(fw / f)), int(round(fh / f)), "c")
        if stueck.shape == vt.shape and not v.flach:
            m = v.skaliert(vt.shape[1], vt.shape[0], "m") if v.maske is not None else None
            if m is not None:
                a, b = stueck[m > 0].astype(np.float32), vt[m > 0].astype(np.float32)
            else:
                a, b = stueck.reshape(-1, 3).astype(np.float32), vt.reshape(-1, 3).astype(np.float32)
            if len(a):
                d = float(np.abs(a.mean(0) - b.mean(0)).max())
                q = (float(a.std()) + 3.0) / (float(b.std()) + 3.0)
                # Pixel für Pixel: echte Kopien weichen kaum ab
                mad = float(np.abs(a - b).mean())
                mx -= (max(0.0, d - 25.0) / 100.0 + max(0.0, abs(math.log(q)) - 0.35)
                       + max(0.0, mad - self.MAD_OK) / 80.0)
        if v.flach:
            # einfarbige Bilder: nur Farbe vergleichen
            stueck = frame[int(y0 + py * f):int(y0 + py * f + fh),
                           int(x0 + px * f):int(x0 + px * f + fw)]
            if stueck.size == 0:
                return None
            d = np.abs(stueck.reshape(-1, 3).mean(0) - v.bgr.reshape(-1, 3).mean(0)).max()
            ruhig = stueck.std() < 6
            mx = 1.0 - d / 255.0 * 4 if ruhig else 0.0
        return Treffer(v, x0 + px * f, y0 + py * f, fw, fh, s2, float(mx))


# ---------------------------------------------------------------------------
#  KI-Suche ("Ähnlich"): findet auch andere Farben / anderes Licht
# ---------------------------------------------------------------------------

MODELL = os.path.join(ORDNER, "form_modell.onnx")


class FormSucher:
    """
    Sucht nicht nach gleichen Pixeln, sondern nach gleicher Form.
    Ein vortrainiertes Bilderkennungs-Netz (ResNet18, gekürzt) macht aus
    Bildschirm und Vorlage "Merkmal-Karten" (Kanten, Muster, Teile).
    Diese werden in vielen Größen verglichen (Grobsuche), die besten
    Stellen werden vergrößert noch einmal genau geprüft.
    """

    ZIEL_H = 540        # Bildschirm wird für die Grobsuche auf diese Höhe verkleinert
    STUFE = 1.2         # Größen-Schritt (die genaue Prüfung gleicht ±25 % aus)
    MIN_ZELLEN = 4      # Vorlage muss mindestens so viele Merkmal-Zellen haben
    PRUEF_BREITE = 128  # Breite der Vorlage bei der genauen Prüfung
    KANDIDATEN = 3      # so viele Stellen pro Bild werden genau geprüft
    MAX_TREFFER = 10

    def __init__(self, pfad=MODELL):
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = max(1, os.cpu_count() or 4)
        so.log_severity_level = 3
        self.sess = ort.InferenceSession(pfad, so, providers=["CPUExecutionProvider"])
        self.mittel = np.array([0.485, 0.456, 0.406], np.float32) * 255
        self.streu = np.array([0.229, 0.224, 0.225], np.float32) * 255
        self.vorher = {}
        self.werte = {}

    def merkmale(self, bgr):
        x = (bgr[:, :, ::-1].astype(np.float32) - self.mittel) / self.streu
        x = np.ascontiguousarray(x.transpose(2, 0, 1)[None])
        f = self.sess.run(None, {"data": x})[0][0]  # Kanäle x Höhe x Breite
        return f / (np.sqrt((f * f).sum(0, keepdims=True)) + 1e-6)

    def vorlage_m(self, v, w, h):
        """Merkmale der Vorlage in Größe w x h (gemerkt). Rand-Zellen werden
        weggelassen, weil sie den fehlenden Hintergrund 'sehen'."""
        key = ("form", w, h)
        c = v._cache.get(key)
        if c is None:
            inter = cv2.INTER_AREA if w < v.w else cv2.INTER_LINEAR
            f = self.merkmale(cv2.resize(v.bgr, (w, h), interpolation=inter))
            if f.shape[1] >= 5 and f.shape[2] >= 5:
                c = (np.ascontiguousarray(f[:, 1:-1, 1:-1]), 1)
            else:
                c = (np.ascontiguousarray(f), 0)
            with v._lock:
                if len(v._cache) > 600:
                    v._cache.clear()
                v._cache[key] = c
        return c

    @staticmethod
    def korr(fs, ft, Fs=None):
        """Mittlere Ähnlichkeit (Kosinus) der Vorlage an jeder Stelle.
        Große Vorlagen über FFT (Fs = vorberechnete FFT des Bildschirms)."""
        C, Hs, Ws = fs.shape
        _, h, w = ft.shape
        Ho, Wo = Hs - h + 1, Ws - w + 1
        if Fs is not None and h * w > 500:
            Ft = np.fft.rfft2(ft[:, ::-1, ::-1], s=(Hs, Ws))
            R = np.fft.irfft2(np.einsum("chw,chw->hw", Fs, Ft), s=(Hs, Ws))
            return (R[h - 1:Hs, w - 1:Ws] / float(h * w)).astype(np.float32)
        G = (ft.reshape(C, h * w).T @ fs.reshape(C, Hs * Ws)).reshape(h, w, Hs, Ws)
        r = np.zeros((Ho, Wo), np.float32)
        for dy in range(h):
            for dx in range(w):
                r += G[dy, dx, dy:dy + Ho, dx:dx + Wo]
        return r / float(h * w)

    @staticmethod
    def _fein_spitze(r, py, px):
        """Lage der Spitze zwischen den Zellen schätzen (Parabel)."""
        def eins(a, b, c):
            d = a - 2 * b + c
            return 0.0 if d >= -1e-9 else max(-0.5, min(0.5, 0.5 * (a - c) / d))
        oy = eins(r[py - 1, px], r[py, px], r[py + 1, px]) if 0 < py < r.shape[0] - 1 else 0.0
        ox = eins(r[py, px - 1], r[py, px], r[py, px + 1]) if 0 < px < r.shape[1] - 1 else 0.0
        return py + oy, px + ox

    def pruef(self, frame, v, x, y, w, h, faktoren=(0.8, 0.9, 1.0, 1.1, 1.25)):
        """Genaue Prüfung: Stelle vergrößern, in mehreren Größen vergleichen."""
        H, W = frame.shape[:2]
        f = self.PRUEF_BREITE / float(w)
        x0, y0 = int(max(0, x - w * 0.5)), int(max(0, y - h * 0.5))
        x1, y1 = int(min(W, x + w * 1.5)), int(min(H, y + h * 1.5))
        if x1 - x0 < 8 or y1 - y0 < 8:
            return None
        cw, ch = max(32, int((x1 - x0) * f)), max(32, int((y1 - y0) * f))
        inter = cv2.INTER_AREA if f < 1 else cv2.INTER_LINEAR
        fc = self.merkmale(cv2.resize(frame[y0:y1, x0:x1], (cw, ch), interpolation=inter))
        fx, fy = (x1 - x0) / float(cw), (y1 - y0) / float(ch)
        best = None
        for k in faktoren:
            lw = int(round(self.PRUEF_BREITE * k))
            lh = max(16, int(round(lw * v.h / float(v.w))))
            ft, off = self.vorlage_m(v, lw, lh)
            if ft.shape[1] > fc.shape[1] or ft.shape[2] > fc.shape[2]:
                continue
            r = self.korr(fc, ft)
            py, px = np.unravel_index(int(r.argmax()), r.shape)
            mx = float(r[py, px])
            if best is None or mx > best[0]:
                fy_, fx_ = self._fein_spitze(r, py, px)
                best = (mx, x0 + (fx_ - off) * 16 * fx, y0 + (fy_ - off) * 16 * fy,
                        lw * fx, lh * fy)
        if best is None:
            return None
        mx, bx, by, bw, bh = best
        return Treffer(v, bx, by, bw, bh, bw / float(v.w), mx)

    def suche(self, frame, vorlagen, schwelle=0.5):
        if not vorlagen:
            self.vorher = {}
            return []
        # Bildschirm unverändert? Dann nicht neu rechnen.
        mini = cv2.resize(frame, (160, 90), interpolation=cv2.INTER_AREA)
        key = (tuple(id(v) for v in vorlagen), schwelle)
        if (getattr(self, "_mini", None) is not None and self._key == key
                and self._mini.shape == mini.shape
                and cv2.norm(mini, self._mini, cv2.NORM_INF) <= 3):
            return self._letzt
        self._mini, self._key = mini, key
        self._letzt = self._suche(frame, vorlagen, schwelle)
        return self._letzt

    def _suche(self, frame, vorlagen, schwelle):
        H, W = frame.shape[:2]
        down = max(1.0, H / float(self.ZIEL_H))
        klein = frame if down == 1.0 else cv2.resize(
            frame, (int(W / down), int(H / down)), interpolation=cv2.INTER_AREA)
        fs = self.merkmale(klein)
        _, Hs, Ws = fs.shape
        st = 16.0 * down  # Bildschirm-Pixel pro Merkmal-Zelle
        Fs = None
        ergebnis = []
        neu_vorher = {}
        self.werte = {}
        for v in vorlagen:
            kand = []
            tw = 40.0
            while tw <= W:
                th = tw * v.h / float(v.w)
                if th > H * 0.95:
                    break
                lw, lh = int(round(tw / down)), int(round(th / down))
                if lw >= 16 and lh >= 16:
                    ft, off = self.vorlage_m(v, lw, lh)
                    if (self.MIN_ZELLEN <= ft.shape[1] <= Hs and self.MIN_ZELLEN <= ft.shape[2] <= Ws):
                        if Fs is None and ft.shape[1] * ft.shape[2] > 500:
                            Fs = np.fft.rfft2(fs)
                        r = self.korr(fs, ft, Fs)
                        mu, sd = float(r.mean()), float(r.std()) + 1e-6
                        for _ in range(2):
                            py, px = np.unravel_index(int(r.argmax()), r.shape)
                            mx = float(r[py, px])
                            if mx < -0.5:
                                break
                            kand.append(((mx - mu) / sd, (px - off) * st, (py - off) * st, tw, th))
                            ry, rx = max(1, ft.shape[1] // 2), max(1, ft.shape[2] // 2)
                            r[max(0, py - ry):py + ry + 1, max(0, px - rx):px + rx + 1] = -1.0
                tw *= self.STUFE
            kand.sort(key=lambda k: -k[0])
            alt = self.vorher.get(id(v), [])
            pruefen = []
            for k in kand:
                box = (k[1], k[2], k[3], k[4])
                if any(_iou(box, p) > 0.3 for p in pruefen):
                    continue
                if any(_iou(box, (a.x, a.y, a.w, a.h)) > 0.3 for a in alt):
                    continue
                pruefen.append(box)
                if len(pruefen) >= self.KANDIDATEN:
                    break
            pruefen += [(a.x, a.y, a.w, a.h) for a in alt]  # Verfolgung
            roh = [t for t in (self.pruef(frame, v, *b) for b in pruefen) if t is not None]
            # gute Treffer noch einmal genau um die gefundene Stelle prüfen (Rahmen sitzt besser)
            for i, t in enumerate(roh):
                if t.score >= schwelle - 0.06:
                    t2 = self.pruef(frame, v, t.x, t.y, t.w, t.h, (0.93, 1.0, 1.07))
                    if t2 is not None and t2.score >= t.score - 0.02:
                        roh[i] = t2
            if roh:
                self.werte[id(v)] = max(t.score for t in roh)
            gut = []
            for t in sorted(roh, key=lambda t: -t.score):
                box = (t.x, t.y, t.w, t.h)
                if any(_iou(box, (g.x, g.y, g.w, g.h)) > 0.3 for g in gut):
                    continue
                war_da = any(_iou(box, (a.x, a.y, a.w, a.h)) > 0.3 for a in alt)
                if t.score >= schwelle or (war_da and t.score >= schwelle - 0.04):
                    gut.append(t)
                if len(gut) >= self.MAX_TREFFER:
                    break
            neu_vorher[id(v)] = gut
            ergebnis.extend(gut)
        self.vorher = neu_vorher
        return ergebnis


# ---------------------------------------------------------------------------
#  Fenster (Steuerung + durchsichtige Anzeige über dem Bildschirm)
# ---------------------------------------------------------------------------

def rand_punkt(cx, cy, x0, y0, x1, y1):
    """Punkt, an dem der Strich von (cx,cy) zur Box-Mitte die Box berührt."""
    if x0 <= cx <= x1 and y0 <= cy <= y1:
        return None
    bx, by = (x0 + x1) / 2.0, (y0 + y1) / 2.0
    dx, dy = bx - cx, by - cy
    tx = ((x0 if dx > 0 else x1) - cx) / dx if dx else -1e9
    ty = ((y0 if dy > 0 else y1) - cy) / dy if dy else -1e9
    t = max(0.0, min(1.0, max(tx, ty)))
    return cx + dx * t, cy + dy * t


LOG = os.path.join(ORDNER, "bildsucher_log.txt")


def log(*teile):
    text = " ".join(str(t) for t in teile)
    print(text)
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(datetime.now().strftime("%H:%M:%S ") + text + "\n")
    except Exception:
        pass


def main():
    try:
        with open(LOG, "w", encoding="utf-8") as f:
            f.write("Bildsucher-Protokoll %s\n" % datetime.now())
    except Exception:
        pass
    import platform
    log("System:", platform.platform(), "| Python", sys.version.split()[0],
        "| OpenCV", cv2.__version__, "| numpy", np.__version__)
    if WIN:
        try:
            ctypes.windll.shcore.SetProcessDpiAwareness(2)  # echte Pixel
        except Exception:
            try:
                ctypes.windll.user32.SetProcessDPIAware()
            except Exception:
                pass

    import tkinter as tk
    from tkinter import filedialog, messagebox
    import mss

    MSS = getattr(mss, "MSS", None) or mss.mss
    os.makedirs(BILDER, exist_ok=True)

    root = tk.Tk()
    root.title("Bildsucher")
    root.attributes("-topmost", True)
    root.resizable(False, False)

    import json
    EINST = os.path.join(ORDNER, "einstellungen.json")
    try:
        with open(EINST, encoding="utf-8") as f:
            einst = json.load(f)
    except Exception:
        einst = {}

    # Bildschirme bestimmen
    with MSS() as s:
        mons = [{k: m[k] for k in ("left", "top", "width", "height")} for m in s.monitors[1:]]
    log("mss", getattr(mss, "__version__", "?"), "Bildschirme:", mons)
    haupt = next((i for i, m in enumerate(mons) if m["left"] == 0 and m["top"] == 0), 0)
    mon_nr = einst.get("bildschirm", haupt)
    if not isinstance(mon_nr, int) or not 0 <= mon_nr < len(mons):
        mon_nr = haupt
    mon = dict(mons[mon_nr])

    def mon_name(i):
        m = mons[i]
        return "Bildschirm %d  (%dx%d)%s" % (i + 1, m["width"], m["height"],
                                             "  – Hauptbildschirm" if i == haupt else "")

    # ---- Anzeige-Fenster (durchsichtig, Klicks gehen hindurch) ----
    KEY = "#010203"
    ov = tk.Toplevel(root)
    ov.overrideredirect(True)
    ov.geometry("%dx%d+%d+%d" % (mon["width"], mon["height"], mon["left"], mon["top"]))
    ov.configure(bg=KEY)
    ov.attributes("-topmost", True)
    try:
        ov.attributes("-transparentcolor", KEY)
    except tk.TclError:
        ov.withdraw()  # nicht Windows: Anzeige ausgeblendet (nur zum Testen)
    cv = tk.Canvas(ov, bg=KEY, highlightthickness=0,
                   width=mon["width"], height=mon["height"])
    cv.pack(fill="both", expand=True)
    ov.update_idletasks()

    def win_extras(fenster, durchklick):
        if not WIN:
            return
        try:
            u = ctypes.windll.user32
            hwnd = u.GetParent(fenster.winfo_id()) or fenster.winfo_id()
            if durchklick:
                GWL_EXSTYLE = -20
                st = u.GetWindowLongW(hwnd, GWL_EXSTYLE)
                st |= 0x80000 | 0x20 | 0x80 | 0x08000000  # layered, transparent, toolwindow, noactivate
                u.SetWindowLongW(hwnd, GWL_EXSTYLE, st)
            # Fenster nicht mitfotografieren (Windows 10 ab 2004)
            ok = u.SetWindowDisplayAffinity(hwnd, 0x11)
            log("Fenster", hwnd, "durchklickbar" if durchklick else "", "ausgenommen:", bool(ok))
        except Exception as e:
            log("Fenster-Einstellung fehlgeschlagen:", e)

    ov.update()
    win_extras(ov, True)

    # ---- Zustand ----
    zustand = {
        "vorlagen": [],
        "laeuft": True,
        "schwelle": 0.80,
        "ergebnis": [],
        "nr": 0,
        "fps": 0.0,
        "ende": False,
        "sperre": None,   # Bereich des Steuerfensters (wird ausgeblendet)
        "fehler": "",
        "min_px": 16,
        "mon": mon,
        "mon_neu": False,
        "testmark": 0.0,
        "schwarz": False,
        "bester": {},     # Vorlage-id -> (Wert, Zeit)
        "modus": einst.get("modus", "genau"),        # "genau" oder "form"
        "schwelle_form": float(einst.get("schwelle_form", 0.50)),
    }
    try:
        import onnxruntime as _ort
        del _ort
        form_ok = os.path.isfile(MODELL)
        form_grund = "" if form_ok else "Die Datei form_modell.onnx fehlt im Ordner."
    except Exception as e:
        form_ok = False
        form_grund = "Das Zusatzteil 'onnxruntime' fehlt (%s).\nBitte Start.bat noch einmal starten." % e
    log("KI-Suche verfügbar:", form_ok, form_grund)
    if not form_ok:
        zustand["modus"] = "genau"

    def akt_schwelle():
        return zustand["schwelle_form"] if zustand["modus"] == "form" else zustand["schwelle"]

    def einst_speichern():
        try:
            with open(EINST, "w", encoding="utf-8") as f:
                json.dump({"bildschirm": mon_nr_var["i"], "schwelle": zustand["schwelle"],
                           "min_px": zustand["min_px"], "modus": zustand["modus"],
                           "schwelle_form": zustand["schwelle_form"]}, f)
        except Exception:
            pass
    mon_nr_var = {"i": mon_nr}

    foto = {"bild": None, "nr": 0}
    foto_neu = threading.Event()

    # ---- Steuerfenster ----
    pad = dict(padx=6, pady=3)
    tk.Label(root, text="🔎 Bildsucher", font=("Segoe UI", 14, "bold")).pack(**pad)
    tk.Label(root, text="Gesuchte Bilder:").pack(anchor="w", padx=8)
    lb = tk.Listbox(root, width=42, height=8, selectmode="extended",
                    font=("Segoe UI", 10))
    lb.pack(padx=8)

    def eintrag(v):
        hinweis = "  (einfarbig!)" if v.flach else ""
        b = zustand["bester"].get(id(v))
        wert = ""
        if zustand["laeuft"] and b and time.time() - b[1] < 2.0:
            wert = "  –  %d%%" % round(max(0.0, b[0]) * 100)
            if b[0] < akt_schwelle():
                wert += " (zu wenig)"
        return "■ %s  [%dx%d]%s%s" % (v.name, v.w, v.h, hinweis, wert)

    def liste_neu():
        auswahl = lb.curselection()
        lb.delete(0, "end")
        for i, v in enumerate(zustand["vorlagen"]):
            lb.insert("end", eintrag(v))
            lb.itemconfig(i, fg=v.farbe)
        for i in auswahl:
            if i < lb.size():
                lb.selection_set(i)

    def farbe_frei():
        benutzt = {v.farbe for v in zustand["vorlagen"]}
        for f in FARBEN:
            if f not in benutzt:
                return f
        return FARBEN[len(zustand["vorlagen"]) % len(FARBEN)]

    def hinzu(pfad):
        bgr, maske = lade_bild(pfad)
        if bgr is None:
            messagebox.showwarning("Bildsucher", "Konnte das Bild nicht öffnen:\n" + pfad)
            return False
        if min(bgr.shape[:2]) < 4:
            messagebox.showwarning("Bildsucher", "Das Bild ist zu klein:\n" + pfad)
            return False
        name = os.path.basename(pfad)
        neu = Vorlage(name, bgr, maske, farbe_frei())
        zustand["vorlagen"] = zustand["vorlagen"] + [neu]
        return True

    def bilder_waehlen():
        pfade = filedialog.askopenfilenames(
            title="Bilder auswählen",
            filetypes=[("Bilder", " ".join("*" + e for e in ENDUNGEN)), ("Alle", "*.*")])
        import shutil
        for p in pfade:
            ziel = os.path.join(BILDER, os.path.basename(p))
            try:
                if os.path.abspath(p) != os.path.abspath(ziel):
                    shutil.copyfile(p, ziel)
                else:
                    ziel = p
            except Exception:
                ziel = p
            if any(v.name == os.path.basename(ziel) for v in zustand["vorlagen"]):
                continue
            hinzu(ziel)
        liste_neu()

    def einfuegen():
        try:
            from PIL import ImageGrab
            inhalt = ImageGrab.grabclipboard()
        except Exception as e:
            messagebox.showwarning("Bildsucher", "Zwischenablage geht nicht:\n%s" % e)
            return
        if inhalt is None:
            messagebox.showinfo("Bildsucher",
                                "In der Zwischenablage ist kein Bild.\n\n"
                                "Tipp: Windows-Taste + Umschalt + S drücken,\n"
                                "Bereich auswählen, dann hier 'Einfügen'.")
            return
        if isinstance(inhalt, list):
            for p in inhalt:
                if p.lower().endswith(ENDUNGEN):
                    hinzu(p)
        else:
            name = "bild_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".png"
            pfad = os.path.join(BILDER, name)
            inhalt.save(pfad)
            hinzu(pfad)
        liste_neu()

    def entfernen():
        weg = set(lb.curselection())
        if not weg:
            return
        if not messagebox.askyesno("Bildsucher", "Ausgewählte Bilder entfernen?\n"
                                   "(Sie werden auch aus dem Ordner 'bilder' gelöscht.)"):
            return
        bleib = []
        for i, v in enumerate(zustand["vorlagen"]):
            if i in weg:
                p = os.path.join(BILDER, v.name)
                try:
                    if os.path.isfile(p):
                        os.remove(p)
                except Exception:
                    pass
            else:
                bleib.append(v)
        zustand["vorlagen"] = bleib
        liste_neu()

    def ordner_oeffnen():
        if WIN:
            os.startfile(BILDER)

    def ordner_neu_laden():
        alt = {v.name for v in zustand["vorlagen"]}
        for n in sorted(os.listdir(BILDER)):
            if n.lower().endswith(ENDUNGEN) and n not in alt:
                hinzu(os.path.join(BILDER, n))
        liste_neu()

    reihe = tk.Frame(root)
    reihe.pack(fill="x", padx=8, pady=4)
    tk.Button(reihe, text="➕ Bilder hinzufügen", command=bilder_waehlen).pack(side="left", expand=True, fill="x")
    tk.Button(reihe, text="📋 Einfügen", command=einfuegen).pack(side="left", expand=True, fill="x")
    reihe2 = tk.Frame(root)
    reihe2.pack(fill="x", padx=8)
    tk.Button(reihe2, text="🗑 Entfernen", command=entfernen).pack(side="left", expand=True, fill="x")
    tk.Button(reihe2, text="📁 Ordner", command=ordner_oeffnen).pack(side="left", expand=True, fill="x")
    tk.Button(reihe2, text="🔄 Neu laden", command=ordner_neu_laden).pack(side="left", expand=True, fill="x")

    reihe3 = tk.Frame(root)
    reihe3.pack(fill="x", padx=8, pady=(4, 0))

    def was_sehe_ich():
        b = foto["bild"]
        if b is None:
            with MSS() as sct:
                b = np.ascontiguousarray(np.asarray(sct.grab(zustand["mon"]))[:, :, :3])
        pfad = os.path.join(ORDNER, "was_ich_sehe.png")
        cv2.imwrite(pfad, b)
        log("Bildschirmfoto gespeichert:", b.shape, "Helligkeit %.1f" % b.mean())
        if WIN:
            os.startfile(pfad)
        else:
            messagebox.showinfo("Bildsucher", "Gespeichert: " + pfad)

    def anzeige_testen():
        zustand["testmark"] = time.time() + 4.0
        zustand["nr"] += 1

    tk.Button(reihe3, text="👁 Was sieht das Programm?", command=was_sehe_ich).pack(side="left", expand=True, fill="x")
    tk.Button(reihe3, text="🎯 Anzeige testen", command=anzeige_testen).pack(side="left", expand=True, fill="x")

    tk.Label(root, text="Auf welchem Bildschirm suchen?").pack(anchor="w", padx=8, pady=(8, 0))
    namen = [mon_name(i) for i in range(len(mons))]
    mon_var = tk.StringVar(value=namen[mon_nr])

    def mon_waehlen(name):
        i = namen.index(name)
        mon_nr_var["i"] = i
        m = dict(mons[i])
        ov.geometry("%dx%d+%d+%d" % (m["width"], m["height"], m["left"], m["top"]))
        cv.config(width=m["width"], height=m["height"])
        zustand["mon"] = m
        zustand["mon_neu"] = True
        zustand["nr"] += 1
        log("Bildschirm gewählt:", i + 1, m)
        einst_speichern()
        anzeige_testen()

    om = tk.OptionMenu(root, mon_var, *namen, command=mon_waehlen)
    om.config(width=38)
    om.pack(padx=8, fill="x")

    tk.Label(root, text="Suchart:").pack(anchor="w", padx=8, pady=(8, 0))
    modus_var = tk.StringVar(value=zustand["modus"])

    def modus_waehlen():
        neu = modus_var.get()
        if neu == "form" and not form_ok:
            messagebox.showwarning("Bildsucher", "Die KI-Suche geht noch nicht:\n" + form_grund)
            modus_var.set("genau")
            return
        zustand["modus"] = neu
        zustand["bester"] = {}
        regler.set(int(round(akt_schwelle() * 100)))
        log("Suchart:", neu)
        einst_speichern()

    tk.Radiobutton(root, text="Genau – gleiche Farben (sehr schnell)", variable=modus_var,
                   value="genau", command=modus_waehlen).pack(anchor="w", padx=14)
    tk.Radiobutton(root, text="Ähnlich – auch andere Farben/Licht (KI, langsamer)",
                   variable=modus_var, value="form", command=modus_waehlen).pack(anchor="w", padx=14)

    tk.Label(root, text="Genauigkeit (höher = weniger Fehlalarme):").pack(anchor="w", padx=8, pady=(8, 0))

    def regler_neu(w):
        if zustand["modus"] == "form":
            zustand["schwelle_form"] = int(w) / 100.0
        else:
            zustand["schwelle"] = int(w) / 100.0
        einst_speichern()

    def regler2_neu(w):
        zustand["min_px"] = int(w)
        einst_speichern()

    zustand["schwelle"] = float(einst.get("schwelle", 0.8))
    regler = tk.Scale(root, from_=30, to=98, orient="horizontal", length=300,
                      command=regler_neu)
    regler.set(int(round(akt_schwelle() * 100)))
    regler.pack(padx=8)

    tk.Label(root, text="Kleinste Größe in Pixeln (nur 'Genau'; kleiner = langsamer):").pack(anchor="w", padx=8)
    regler2 = tk.Scale(root, from_=8, to=120, orient="horizontal", length=300,
                       command=regler2_neu)
    regler2.set(int(einst.get("min_px", 16)))
    regler2.pack(padx=8)

    knopf = tk.Button(root, text="⏸ Pause", font=("Segoe UI", 11, "bold"))
    knopf.pack(fill="x", padx=8, pady=6)

    def umschalten():
        zustand["laeuft"] = not zustand["laeuft"]
        knopf.config(text="⏸ Pause" if zustand["laeuft"] else "▶ Weiter suchen")
    knopf.config(command=umschalten)

    status = tk.Label(root, text="Starte …", fg="#555", font=("Segoe UI", 9))
    status.pack(pady=(0, 8))

    ordner_neu_laden()
    root.update()
    win_extras(root, False)

    # ---- Such-Schleife im Hintergrund ----
    sucher = Sucher()
    form = {"s": None}

    def form_sucher():
        if form["s"] is None:
            t0 = time.perf_counter()
            form["s"] = FormSucher(MODELL)
            log("KI-Modell geladen in %.1f s" % (time.perf_counter() - t0))
        return form["s"]


    def fotografieren():
        """Macht ständig Bildschirmfotos (eigener Faden, läuft parallel zur Suche)."""
        try:
            with MSS() as sct:
                while not zustand["ende"]:
                    if not zustand["laeuft"] or not zustand["vorlagen"]:
                        time.sleep(0.05)
                        continue
                    m = zustand["mon"]
                    shot = sct.grab(m)
                    foto["bild"] = np.ascontiguousarray(np.asarray(shot)[:, :, :3])
                    foto["mon"] = m
                    if foto["nr"] % 30 == 0:
                        zustand["schwarz"] = float(foto["bild"][::16, ::16].max()) < 8
                    foto["nr"] += 1
                    foto_neu.set()
                    time.sleep(0.002)
        except Exception as e:
            import traceback
            log("FEHLER Bildschirmfoto:", traceback.format_exc())
            zustand["fehler"] = "Bildschirmfoto: %s" % e

    threading.Thread(target=fotografieren, daemon=True).start()

    def arbeit():
        try:
            letzt = time.perf_counter()
            gesehen = 0
            alt_sig = None
            alt_modus = None
            while not zustand["ende"]:
                vl = zustand["vorlagen"]
                if not zustand["laeuft"] or not vl:
                    if zustand["ergebnis"]:
                        zustand["ergebnis"] = []
                        zustand["nr"] += 1
                    alt_sig = None
                    sucher.vorher = {}
                    time.sleep(0.05)
                    continue
                if foto["nr"] == gesehen:  # auf neues Bildschirmfoto warten
                    foto_neu.clear()
                    if foto["nr"] == gesehen:
                        foto_neu.wait(0.1)
                    continue
                gesehen = foto["nr"]
                fm = foto.get("mon")
                if zustand["mon_neu"]:  # anderer Bildschirm gewählt: neu anfangen
                    zustand["mon_neu"] = False
                    sucher.vorher = {}
                    sucher._key = None
                    if form["s"] is not None:
                        form["s"].vorher = {}
                    alt_sig = None
                    continue
                if fm is not zustand["mon"]:
                    continue  # Foto stammt noch vom alten Bildschirm
                frame = foto["bild"].copy()
                sp = zustand["sperre"]
                if sp:  # eigenes Steuerfenster nicht durchsuchen
                    x0, y0, x1, y1 = sp
                    x0, y0 = max(0, x0 - fm["left"]), max(0, y0 - fm["top"])
                    x1, y1 = x1 - fm["left"], y1 - fm["top"]
                    if x1 > 0 and y1 > 0:
                        frame[y0:y1, x0:x1] = 0
                modus = zustand["modus"]
                if modus == "form":
                    aktiv = form_sucher()
                    if modus != alt_modus:
                        aktiv.vorher = {}
                    erg = aktiv.suche(frame, vl, zustand["schwelle_form"])
                else:
                    aktiv = sucher
                    if modus != alt_modus:
                        sucher.vorher = {}
                        sucher._key = None
                    sucher.min_px = zustand["min_px"]
                    erg = sucher.suche(frame, vl, zustand["schwelle"])
                alt_modus = modus
                jetzt_t = time.time()
                for vid, w in aktiv.werte.items():
                    b = zustand["bester"].get(vid)
                    if b is None or w >= b[0] or jetzt_t - b[1] > 1.5:
                        zustand["bester"][vid] = (w, jetzt_t)
                for t in erg:
                    zustand["bester"][id(t.vorlage)] = (t.score, jetzt_t)
                sig = tuple((id(t.vorlage), int(t.x), int(t.y), int(t.w), int(t.h),
                             int(t.score * 100)) for t in erg)
                if sig != alt_sig:  # nur neu zeichnen, wenn sich etwas geändert hat
                    alt_sig = sig
                    zustand["ergebnis"] = erg
                    zustand["nr"] += 1
                jetzt = time.perf_counter()
                dt = jetzt - letzt
                letzt = jetzt
                zustand["fps"] = zustand["fps"] * 0.8 + (1.0 / max(dt, 1e-3)) * 0.2
        except Exception as e:  # Fehler anzeigen statt still abzustürzen
            import traceback
            log("FEHLER Suche:", traceback.format_exc())
            zustand["fehler"] = str(e)

    threading.Thread(target=arbeit, daemon=True).start()

    test_s = os.environ.get("BILDSUCHER_TEST")

    # ---- Zeichnen ----
    gezeichnet = {"nr": -1}
    zaehler = {"n": 0}

    def zeichnen():
        if zustand["ende"]:
            return
        zaehler["n"] += 1
        try:
            zustand["sperre"] = (root.winfo_rootx(), root.winfo_rooty() - 40,
                                 root.winfo_rootx() + root.winfo_width(),
                                 root.winfo_rooty() + root.winfo_height())
        except Exception:
            pass
        if gezeichnet["nr"] != zustand["nr"] and not (test_s and not zustand["laeuft"]):
            gezeichnet["nr"] = zustand["nr"]
            cv.delete("all")
            m = zustand["mon"]
            cx, cy = m["width"] / 2.0, m["height"] / 2.0
            if time.time() < zustand["testmark"]:
                # Test: großer Rahmen am Rand + Kreuz in der Mitte
                cv.create_rectangle(6, 6, m["width"] - 6, m["height"] - 6,
                                    outline="#ff3bf0", width=10)
                cv.create_line(cx - 60, cy, cx + 60, cy, fill="#ff3bf0", width=6)
                cv.create_line(cx, cy - 60, cx, cy + 60, fill="#ff3bf0", width=6)
                cv.create_text(cx, cy + 90, fill="#ff3bf0", font=("Segoe UI", 20, "bold"),
                               text="Hier sucht der Bildsucher")
                root.after(4100, lambda: zustand.__setitem__("nr", zustand["nr"] + 1))
            treffer = zustand["ergebnis"]
            if treffer:
                cv.create_oval(cx - 5, cy - 5, cx + 5, cy + 5, fill="#ffffff", outline="#000000")
            for t in treffer:
                f = t.vorlage.farbe
                p = 4
                x0, y0 = t.x - p, t.y - p
                x1, y1 = t.x + t.w + p, t.y + t.h + p
                rp = rand_punkt(cx, cy, x0, y0, x1, y1)
                if rp:
                    cv.create_line(cx, cy, rp[0], rp[1], fill="#000000", width=5)
                    cv.create_line(cx, cy, rp[0], rp[1], fill=f, width=3)
                cv.create_rectangle(x0 - 1, y0 - 1, x1 + 1, y1 + 1, outline="#000000", width=5)
                cv.create_rectangle(x0, y0, x1, y1, outline=f, width=3)
                ty = y0 - 12 if y0 > 20 else y1 + 12
                cv.create_text(x0 + 2, ty, anchor="w", fill=f,
                               font=("Segoe UI", 10, "bold"),
                               text="%s %d%%" % (os.path.splitext(t.vorlage.name)[0],
                                                 round(t.score * 100)))
        if zaehler["n"] % 15 == 0:
            if zustand["fehler"]:
                status.config(text="Fehler: " + zustand["fehler"], fg="#c00")
            elif not zustand["vorlagen"]:
                status.config(text="Noch keine Bilder – bitte hinzufügen", fg="#555")
            elif not zustand["laeuft"]:
                status.config(text="Pause", fg="#555")
            elif zustand["schwarz"]:
                status.config(text="Bildschirmfoto ist schwarz! (Spiel im Vollbild? "
                                   "Dann 'Fenster ohne Rahmen' einstellen)", fg="#c00")
            else:
                status.config(text="%.0f Suchen pro Sekunde  ·  %d gefunden"
                              % (zustand["fps"], len(zustand["ergebnis"])), fg="#060")
        if zaehler["n"] % 30 == 0 and zustand["vorlagen"]:
            liste_neu()  # beste Werte in der Liste auffrischen
        if zaehler["n"] % 120 == 0:  # Anzeige ganz oben halten
            try:
                ov.attributes("-topmost", True)
            except Exception:
                pass
        root.after(15, zeichnen)

    def schliessen():
        zustand["ende"] = True
        root.after(50, root.destroy)

    root.protocol("WM_DELETE_WINDOW", schliessen)

    # Nur für automatische Tests: BILDSUCHER_TEST=<Sekunden>
    if test_s:
        def test_ende():
            print("TEST fps=%.1f fehler=%r" % (zustand["fps"], zustand["fehler"]))
            for t in zustand["ergebnis"]:
                print("TREFFER %s %d %d %d %d %.2f" % (t.vorlage.name, t.x, t.y, t.w, t.h, t.score))
            zustand["laeuft"] = False
            if not WIN:
                ov.deiconify()
            ov.update()
            root.update()

            def foto_speichern():
                with MSS() as sct:
                    bild = np.asarray(sct.grab(zustand["mon"]))[:, :, :3]
                cv2.imwrite(os.environ.get("BILDSUCHER_PNG", "anzeige.png"), bild)
                schliessen()
            root.after(500, foto_speichern)
        root.after(int(float(test_s) * 1000), test_ende)
    root.after(15, zeichnen)
    root.mainloop()


if __name__ == "__main__":
    main()
