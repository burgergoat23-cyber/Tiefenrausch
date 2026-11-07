"""Kern der Spiel-KI: bringt sich ein Spiel selbst bei (läuft auf jedem System).

Die KI sieht nur den Bildschirm. Sie probiert Tasten aus und merkt sich, was gut war:
  +  ein bisschen für jeden Moment, in dem sie noch im Spiel ist
  +  wenn sich die Punkte ändern (falls ein Punkte-Bereich markiert ist)
  +  ein kleines bisschen für Bilder, die sie noch nie gesehen hat (Neugier)
  -  viel, wenn sie verliert (Bild bleibt stehen oder das Game-Over-Bild erscheint)
Danach startet sie das Spiel selbst neu. Gelernt wird gleichzeitig im Hintergrund
(Verstärkungslernen: Double-DQN mit Dueling-Kopf und 3-Schritt-Ertrag).
"""
import glob
import json
import math
import os
import re
import threading
import time

import numpy as np
from PIL import Image

BW, BH = 80, 56          # so klein sieht die KI das Spiel
STAPEL = 4               # aktuelles Bild in Farbe + 3 vorherige in Grau (so sieht sie Bewegung)
TAKT = 15                # Entscheidungen pro Sekunde
NSTEP, GAMMA = 3, 0.99
SPEICHER = 30000         # so viele Momente merkt sie sich (~400 MB)
START_LERNEN = 1000      # erst so viele Momente sammeln, dann lernen
VERHAELTNIS = 1.0        # Lernschritte je Spielmoment (höchstens)
ZUFALL_SCHRITTE = 8000   # bis hierhin sinkt der Zufall von 100 % auf 10 % (~9 min)
STILL_SEK = 1.5          # so lange stehendes Bild = verloren
STILL_WARTEN = 2         # steht das Bild so viele Takte, lässt die KI los und wartet ab
UEBERNAHME_SEK = 1.0     # so lange nach einer eigenen Taste steuert der Mensch

LEBEN, TOD, PUNKTE, NEUGIER = 0.02, -1.0, 0.3, 0.01

F8 = 0x77
HOTKEYS = {F8}
NIE = {0x5B, 0x5C, 0x5D, 0x1B} | HOTKEYS   # Windows-Tasten, Menütaste, Esc, eigene Kurztaste
MAUS = {0x01, 0x02, 0x04}
GEGENTEILE = [{0x25, 0x27}, {0x26, 0x28}, {0x41, 0x44}, {0x57, 0x53}]
VORSCHLAG = [0x25, 0x27, 0x26, 0x28, 0x20, 0x57, 0x41, 0x53, 0x44, 0x0D, 0xA0, 0xA2, 0x01]
NEUSTARTS = [('Leertaste', 'vk:32'), ('Enter', 'vk:13'), ('Pfeil hoch', 'vk:38'),
             ('Taste R', 'vk:82'), ('Klick auf die Game-Over-Stelle', 'klick_go'),
             ('Klick in die Mitte', 'klick_mitte'), ('Nichts (startet von selbst)', '')]

_NAMEN = {
    0x01: 'Mausklick', 0x02: 'Maus rechts', 0x04: 'Maus Mitte', 0x08: 'Rücktaste',
    0x09: 'Tab', 0x0D: 'Enter', 0x10: 'Shift', 0x11: 'Strg', 0x12: 'Alt', 0x14: 'Feststell',
    0x1B: 'Esc', 0x20: 'Leertaste', 0x21: 'Bild hoch', 0x22: 'Bild runter', 0x23: 'Ende',
    0x24: 'Pos1', 0x25: '←', 0x26: '↑', 0x27: '→', 0x28: '↓', 0x2D: 'Einfg', 0x2E: 'Entf',
    0xA0: 'Shift', 0xA1: 'Shift rechts', 0xA2: 'Strg', 0xA3: 'Strg rechts', 0xA4: 'Alt',
    0xA5: 'AltGr', 0xBA: 'Ü', 0xBB: '+', 0xBC: 'Komma', 0xBD: 'Minus', 0xBE: 'Punkt',
    0xBF: '#', 0xC0: 'Ö', 0xDB: 'ß', 0xDC: '^', 0xDD: '´', 0xDE: 'Ä', 0xE2: '<',
}


def tasten_name(vk):
    vk = int(vk)
    if vk in _NAMEN:
        return _NAMEN[vk]
    if 0x30 <= vk <= 0x39 or 0x41 <= vk <= 0x5A:
        return chr(vk)
    if 0x60 <= vk <= 0x69:
        return f'Num {vk - 0x60}'
    if 0x70 <= vk <= 0x87:
        return f'F{vk - 0x6F}'
    return f'Taste {vk}'


def aktion_name(a):
    return ' + '.join(tasten_name(v) for v in a) if a else 'nichts'


def verkleinern(bild, groesse=(BW, BH)):
    """PIL-Bild oder Feld (H×W×3) -> Feld H×W×3 (uint8) in der Größe der KI."""
    if not isinstance(bild, Image.Image):
        bild = Image.fromarray(np.asarray(bild, dtype=np.uint8))
    if bild.mode != 'RGB':
        bild = bild.convert('RGB')
    return np.asarray(bild.resize(groesse, Image.BILINEAR, reducing_gap=2.0), dtype=np.uint8)


def grau(f):
    return f[..., 0] * 0.299 + f[..., 1] * 0.587 + f[..., 2] * 0.114


def ausschnitt(bild, rel, groesse):
    """Teil eines PIL-Bilds (rel = Anteile x, y, b, h) -> Graubild als float-Feld."""
    w, h = bild.size
    x0, y0 = int(rel[0] * w), int(rel[1] * h)
    x1, y1 = max(x0 + 1, int((rel[0] + rel[2]) * w)), max(y0 + 1, int((rel[1] + rel[3]) * h))
    teil = bild.crop((x0, y0, x1, y1)).convert('L').resize(groesse, Image.BILINEAR)
    return np.asarray(teil, dtype=np.float32)


def aktionen_aus(tasten):
    """Aus den erlaubten Tasten die möglichen Züge bauen: nichts, jede Taste, sinnvolle Paare."""
    t = sorted(set(int(v) for v in tasten))
    akt = [()] + [(v,) for v in t]
    if len(t) <= 6:
        for i in range(len(t)):
            for j in range(i + 1, len(t)):
                if {t[i], t[j]} not in GEGENTEILE:
                    akt.append((t[i], t[j]))
    return akt


# ---------------------------------------------------------------- Spiel-Erklärung lesen

_WORT_TASTEN = [
    (r'leer-?taste|leerzeichen|space(bar)?', [0x20]),
    (r'\bw\s*a\s*s\s*d\b', [0x57, 0x41, 0x53, 0x44]),
    (r'(pfeil\w*|arrow\w*)\s*(nach\s*|ganz\s*)?(links|left)|(linke[nr]?|left)\s*(pfeil\w*|arrow)', [0x25]),
    (r'(pfeil\w*|arrow\w*)\s*(nach\s*|ganz\s*)?(rechts|right)|(rechte[nr]?|right)\s*(pfeil\w*|arrow)', [0x27]),
    (r'(pfeil\w*|arrow\w*)\s*(nach\s*)?(oben|hoch|up)|(obere[nr]?|up)\s*(pfeil\w*|arrow)', [0x26]),
    (r'(pfeil\w*|arrow\w*)\s*(nach\s*)?(unten|runter|down)|(untere[nr]?|down)\s*(pfeil\w*|arrow)', [0x28]),
    (r'\benter\b|eingabe-?taste|\breturn\b', [0x0D]),
    (r'\bshift\b|umschalt\w*', [0xA0]),
    (r'\bstrg\b|\bctrl\b|steuerung-?taste', [0xA2]),
    (r'klick\w*|click\w*|\bmaus\b|anklick\w*|linksklick', [0x01]),
]
_PFEILE_ALLE = r'pfeiltasten|pfeil-tasten|arrow keys|\bpfeilen\b'
_NEIN = r'\b(nicht|nie|niemals|kein\w*|never|not)\b'
_NEUSTART = (r'neu\s*-?\s*start\w*|neustart|start\w*\s+(von selbst\s+|automatisch\s+|wieder\s+)?neu\b|'
             r'nochmal|noch einmal|restart|von vorne|erneut|'
             r'wieder\s*start\w*|neue runde|play again|try again')
_STILL = r'stehen\s*bleibt|bleibt\b.{0,25}?\bstehen|steht\s+still|friert|eingefroren|stillstand|freeze|frozen|bleibt h(ä|ae)ngen'
_GO = r'game\s*-?\s*over|verlor\w*|\btot\b|stirbt|gestorben|verlierst|\blose\b|you died'
_PKT = r'punkt\w*|score|highscore|münze\w*|muenze\w*|coins?\b|sammel\w*|meter\b'


def _tasten_im_satz(satz):
    """Alle Tasten, die in einem Satz genannt werden (in der Reihenfolge des Auftretens)."""
    gefunden = []
    for muster, vks in _WORT_TASTEN:
        for m in re.finditer(muster, satz):
            gefunden += [(m.start(), v) for v in vks]
    if re.search(_PFEILE_ALLE, satz) and not any(v in (0x25, 0x26, 0x27, 0x28) for _, v in gefunden):
        m = re.search(_PFEILE_ALLE, satz)
        gefunden += [(m.start(), v) for v in (0x25, 0x26, 0x27, 0x28)]
    # einzelne Buchstaben/Ziffern: "Taste E", "mit E", "E-Taste", „E“, "A und D"
    einzeln = [r'(?:taste|mit|drück\w*|drueck\w*|press\w*|key)\s+["„\'‚]?([a-z])["“\'‘]?(?=[\s.,!?;:)/]|$)',
               r'taste\s+["„\'‚]?([0-9])\b',
               r'(?<![\w-])([a-z0-9])[- ]taste\b',
               r'["„‚\']([a-z0-9])["“‘\']']
    for muster in einzeln:
        for m in re.finditer(muster, satz):
            gefunden.append((m.start(1), ord(m.group(1).upper())))
    for m in re.finditer(r'(?<![\w-])([a-z])\s*(?:,|und|oder|/|bzw\.?)\s*([a-z])(?![\w-])', satz):
        gefunden += [(m.start(1), ord(m.group(1).upper())), (m.start(2), ord(m.group(2).upper()))]
    reihe = []
    for _, v in sorted(gefunden, key=lambda x: x[0]):
        if v not in reihe and v not in NIE:
            reihe.append(v)
    return reihe


def erklaerung_verstehen(text):
    """Liest eine Spiel-Erklärung (Deutsch/Englisch) und macht daraus Einstellungen.

    Gibt {'tasten', 'neustart', 'stillstand', 'tipps', 'gameover_erwaehnt', 'punkte_erwaehnt'} zurück.
    Die KI selbst kann keinen Text lesen – das hier stellt nur das Programm passend ein.
    """
    t = (text or '').lower().replace('ß', 'ss')
    saetze = [x.strip() for x in re.split(r'[.!?;\n]+', t) if x.strip()]
    spiel, neustart_tasten = [], []
    for satz in saetze:
        tasten = _tasten_im_satz(satz)
        if not tasten or re.search(_NEIN, satz):
            continue
        if re.search(_NEUSTART, satz):
            neustart_tasten += [v for v in tasten if v not in neustart_tasten]
        else:
            spiel += [v for v in tasten if v not in spiel]
    neustart = None
    if neustart_tasten:
        v = neustart_tasten[0]
        neustart = ('klick_go' if re.search(_GO, t) else 'klick_mitte') if v == 0x01 else f'vk:{v}'
    elif re.search(_NEUSTART, t) and re.search(r'von selbst|automatisch|alleine|allein', t):
        neustart = ''
    return {'tasten': spiel, 'neustart': neustart,
            'stillstand': True if re.search(_STILL, t) else None,
            'gameover_erwaehnt': bool(re.search(_GO, t)),
            'punkte_erwaehnt': bool(re.search(_PKT, t))}


class Fehler(Exception):
    """Fehler mit einer Meldung, die man dem Nutzer zeigen kann."""


# ---------------------------------------------------------------- Projekt (ein Spiel)

class Projekt:
    STANDARD = {'bereich': None, 'tasten': [], 'stillstand': True, 'neustart': 'vk:32',
                'punkte': None, 'gameover': [], 'scan': {}}

    def __init__(self, ordner):
        self.ordner = ordner
        os.makedirs(ordner, exist_ok=True)
        self.name = os.path.basename(ordner.rstrip('/\\'))
        self._lock = threading.Lock()
        self.info = json.loads(json.dumps(self.STANDARD))
        p = os.path.join(ordner, 'info.json')
        if os.path.exists(p):
            try:
                with open(p, encoding='utf-8') as f:
                    self.info.update(json.load(f))
            except (OSError, ValueError):
                pass

    def speichern(self):
        p = os.path.join(self.ordner, 'info.json')
        with self._lock:
            with open(p + '.neu', 'w', encoding='utf-8') as f:
                json.dump(self.info, f, ensure_ascii=False, indent=1)
            os.replace(p + '.neu', p)

    @property
    def modell_pfad(self):
        return os.path.join(self.ordner, 'gehirn.pt')

    def hat_modell(self):
        return os.path.exists(self.modell_pfad)

    def aktionen(self):
        return aktionen_aus(self.info.get('tasten', []))

    def scan_info(self):
        return {int(k): tuple(v) for k, v in self.info.get('scan', {}).items()}

    def scan_merken(self, scan):
        d = self.info.setdefault('scan', {})
        for vk, v in scan.items():
            d[str(vk)] = list(v)

    def gameover_bilder(self):
        """Liste von (rel, Graubild) für die Game-Over-Erkennung."""
        aus = []
        for g in self.info.get('gameover', []):
            try:
                img = Image.open(os.path.join(self.ordner, g['datei'])).convert('L')
                aus.append((g['rel'], np.asarray(img, dtype=np.float32)))
            except (OSError, KeyError):
                pass
        return aus

    def gameover_hinzu(self, rel, bild):
        """bild: PIL-Bild des markierten Ausschnitts."""
        n = 1
        while os.path.exists(os.path.join(self.ordner, f'gameover_{n}.png')):
            n += 1
        datei = f'gameover_{n}.png'
        bild.convert('L').resize(GO_GROESSE, Image.BILINEAR).save(os.path.join(self.ordner, datei))
        self.info.setdefault('gameover', []).append({'rel': list(rel), 'datei': datei})
        self.speichern()

    def gameover_loeschen(self):
        for g in self.info.get('gameover', []):
            try:
                os.remove(os.path.join(self.ordner, g['datei']))
            except (OSError, KeyError):
                pass
        self.info['gameover'] = []
        self.speichern()

    def gehirn_loeschen(self):
        try:
            os.remove(self.modell_pfad)
        except OSError:
            pass
        self.info.pop('statistik', None)
        self.speichern()

    def gehirn_tasten(self):
        """Mit welchen Tasten das gespeicherte Gehirn gelernt hat (None = keins)."""
        if not self.hat_modell():
            return None
        return sorted(self.info.get('statistik', {}).get('tasten', []))


GO_GROESSE = (48, 24)
PUNKTE_GROESSE = (32, 12)


def projekt_name_ok(name):
    name = re.sub(r'[^\w \-]', '', name, flags=re.UNICODE).strip()
    return name[:40]


def projekte(ordner):
    return sorted(os.path.basename(p) for p in glob.glob(os.path.join(ordner, '*'))
                  if os.path.isdir(p))


# ---------------------------------------------------------------- Eingaben vom Menschen

class Eingaben:
    """Merkt sich, was der Mensch drückt (wird vom Tastatur-/Maus-Haken gefüttert)."""

    def __init__(self):
        self._lock = threading.Lock()
        self.gedrueckt = set()
        self.getippt = set()
        self.zeit = -1e9
        self.scan = {}
        self.fangen = None      # Rückruf: nächste gedrückte Taste melden ("Taste hinzufügen")

    def ereignis(self, vk, unten, scan=0, ext=False):
        if unten and self.fangen is not None and vk not in MAUS and vk not in HOTKEYS:
            rueckruf, self.fangen = self.fangen, None
            if scan:
                self.scan[vk] = (int(scan), bool(ext))
            rueckruf(vk)
            return
        if vk in NIE and vk != 0x1B:
            return
        with self._lock:
            if unten:
                if vk not in self.gedrueckt:
                    self.getippt.add(vk)
                self.gedrueckt.add(vk)
                self.zeit = time.monotonic()
                if scan:
                    self.scan[vk] = (int(scan), bool(ext))
            else:
                self.gedrueckt.discard(vk)

    def abholen(self):
        with self._lock:
            s = self.gedrueckt | self.getippt
            self.getippt = set()
            return s

    def sekunden_seit_letzter(self):
        return time.monotonic() - self.zeit

    def haelt(self, vk):
        with self._lock:
            return vk in self.gedrueckt


# ---------------------------------------------------------------- Erinnerungs-Speicher

class Speicher:
    """Ringspeicher der letzten Spielmomente: Bild, Zug, Belohnung, Ende, Rundenstart."""

    def __init__(self, groesse=SPEICHER):
        self.cap = groesse
        self.b = np.zeros((groesse, BH, BW, 3), np.uint8)   # wird erst beim Füllen belegt
        self.a = np.zeros(groesse, np.int16)
        self.r = np.zeros(groesse, np.float32)
        self.d = np.zeros(groesse, bool)
        self.s = np.zeros(groesse, bool)
        self.pos = self.n = self.gesamt = 0
        self.lock = threading.Lock()

    def hinzu(self, f, a, r, ende, start):
        with self.lock:
            i = self.pos
            self.b[i], self.a[i], self.r[i], self.d[i], self.s[i] = f, a, r, ende, start
            self.pos = (i + 1) % self.cap
            self.n = min(self.n + 1, self.cap)
            self.gesamt += 1

    def _stapel(self, p):
        idx, cur = [p], p
        for _ in range(STAPEL - 1):
            cur = np.where(self.s[cur], cur, (cur - 1) % self.cap)
            idx.append(cur)
        return np.stack([self.b[i] for i in idx], axis=1)   # B×STAPEL×H×W×3, neuestes zuerst

    def ziehen(self, bs, rng):
        with self.lock:
            n = self.n
            if n < STAPEL + NSTEP + 2:
                return None
            L = rng.integers(STAPEL - 1, n - NSTEP, size=bs * 3)
            p = (self.pos - n + L) % self.cap
            ok = self.a[p] >= 0
            ertrag = np.zeros(len(p), np.float32)
            vorbei = np.zeros(len(p), bool)
            kaputt = np.zeros(len(p), bool)
            for k in range(NSTEP):
                pk = (p + k) % self.cap
                if k > 0:
                    kaputt |= self.s[pk] & ~vorbei
                ertrag += np.where(vorbei, 0.0, (GAMMA ** k) * self.r[pk])
                vorbei |= self.d[pk]
            pn = (p + NSTEP) % self.cap
            kaputt |= self.s[pn] & ~vorbei
            wahl = np.where(ok & ~kaputt)[0][:bs]
            if len(wahl) < bs // 2:
                return None
            p, pn = p[wahl], pn[wahl]
            return (self._stapel(p), self.a[p].astype(np.int64), ertrag[wahl],
                    np.where(vorbei[wahl], 0.0, GAMMA ** NSTEP).astype(np.float32),
                    self._stapel(pn))


def ring_stapel(ring):
    """Letzte Bilder (ältestes zuerst) -> 1×STAPEL×H×W×3, fehlende = ältestes vorhandenes."""
    return np.stack([ring[-1 - k] if k < len(ring) else ring[0] for k in range(STAPEL)])[None]


# ---------------------------------------------------------------- Netz und Lerner

def baue_netz(n_aus):
    import torch
    import torch.nn as nn

    class Netz(nn.Module):
        def __init__(self):
            super().__init__()
            self.augen = nn.Sequential(
                nn.Conv2d(3 + STAPEL - 1, 32, 8, stride=4, padding=2), nn.ReLU(),   # 14×20
                nn.Conv2d(32, 64, 4, stride=2, padding=1), nn.ReLU(),               # 7×10
                nn.Conv2d(64, 64, 3, stride=1, padding=1), nn.ReLU(), nn.Flatten())
            m = 64 * 7 * 10
            self.wert = nn.Sequential(nn.Linear(m, 256), nn.ReLU(), nn.Linear(256, 1))
            self.vorteil = nn.Sequential(nn.Linear(m, 256), nn.ReLU(), nn.Linear(256, n_aus))
            self.register_buffer('gw', torch.tensor([0.299, 0.587, 0.114]))

        def forward(self, st):
            """st: B×STAPEL×H×W×3 uint8 (neuestes zuerst)."""
            x = st.float().div(255.0)
            farbe = x[:, 0].permute(0, 3, 1, 2)
            g = (x[:, 1:] * self.gw).sum(-1)
            h = self.augen(torch.cat([farbe, g], 1) - 0.5)
            a = self.vorteil(h)
            return self.wert(h) + a - a.mean(1, keepdim=True)

    return Netz()


class Lerner:
    """Hält das Gehirn (Netz), lernt aus dem Speicher und speichert den Lernstand."""

    def __init__(self, projekt, aktionen, threads=None):
        import torch
        self.torch = torch
        if threads:
            torch.set_num_threads(threads)
        self.projekt = projekt
        self.aktionen = [tuple(int(v) for v in a) for a in aktionen]
        n = len(self.aktionen)
        self.netz, self.ziel, self.ki = baue_netz(n), baue_netz(n), baue_netz(n)
        self.opt = torch.optim.Adam(self.netz.parameters(), lr=2.5e-4, eps=1.5e-4)
        self.schritte = 0       # Spielmomente insgesamt (auch frühere Sitzungen)
        self.updates = 0
        self.runden = []        # je Runde: [Sekunden im Spiel, Punkte-Änderungen, Belohnung]
        self.zeit = 0.0         # Übungszeit in Sekunden
        self.lock = threading.Lock()
        self.geladen = False
        if projekt is not None and projekt.hat_modell():
            try:
                d = torch.load(projekt.modell_pfad, map_location='cpu', weights_only=True)
                if [tuple(a) for a in d['aktionen']] == self.aktionen:
                    self.netz.load_state_dict(d['netz'])
                    self.ziel.load_state_dict(d['ziel'])
                    self.opt.load_state_dict(d['opt'])
                    self.schritte, self.updates = int(d['schritte']), int(d['updates'])
                    self.runden, self.zeit = list(d['runden']), float(d['zeit'])
                    self.geladen = True
            except Exception:   # noqa: BLE001 – kaputte Datei: neu anfangen
                self.geladen = False
        if not self.geladen:
            self.ziel.load_state_dict(self.netz.state_dict())
        self.ziel.eval()
        self.ki.eval()
        self.sync()

    def zufall(self):
        """Wie oft die KI noch zufällig probiert (1.0 = immer, 0.03 = fast nie)."""
        s, a = self.schritte, ZUFALL_SCHRITTE
        if s < a:
            return 1.0 - 0.9 * s / a
        return max(0.03, 0.1 - 0.07 * (s - a) / (a * 7 / 3))

    def sync(self):
        with self.lock:
            self.ki.load_state_dict(self.netz.state_dict())

    def wahl(self, st):
        with self.lock, self.torch.inference_mode():
            q = self.ki(self.torch.from_numpy(st))
        return int(q.argmax(1).item())

    def update(self, speicher, rng, bs=32):
        torch = self.torch
        z = speicher.ziehen(bs, rng)
        if z is None:
            return None
        st, a, ertrag, faktor, st2 = (torch.from_numpy(np.ascontiguousarray(v)) for v in z)
        q = self.netz(st).gather(1, a[:, None]).squeeze(1)
        with torch.no_grad():
            a2 = self.netz(st2).argmax(1, keepdim=True)
            ziel = ertrag + faktor * self.ziel(st2).gather(1, a2).squeeze(1)
        loss = torch.nn.functional.smooth_l1_loss(q, ziel)
        self.opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(self.netz.parameters(), 10.0)
        self.opt.step()
        with torch.no_grad():
            for pz, pn in zip(self.ziel.parameters(), self.netz.parameters()):
                pz.mul_(0.995).add_(pn, alpha=0.005)
        self.updates += 1
        if self.updates % 50 == 0:
            self.sync()
        return float(loss.item())

    def speichern(self):
        if self.projekt is None:
            return
        with self.lock:
            d = {'netz': self.netz.state_dict(), 'ziel': self.ziel.state_dict(),
                 'opt': self.opt.state_dict(), 'aktionen': [list(a) for a in self.aktionen],
                 'schritte': self.schritte, 'updates': self.updates,
                 'runden': [[float(x) for x in r] for r in self.runden[-5000:]],
                 'zeit': float(self.zeit), 'version': 2}
            self.torch.save(d, self.projekt.modell_pfad + '.neu')
        os.replace(self.projekt.modell_pfad + '.neu', self.projekt.modell_pfad)
        self.projekt.info['statistik'] = statistik(self)
        self.projekt.speichern()


def statistik(lerner):
    r = list(lerner.runden)
    return {'runden': len(r), 'best': max((x[0] for x in r), default=0.0),
            'zeit': round(lerner.zeit), 'schritte': lerner.schritte,
            'zufall': round(lerner.zufall(), 3), 'verlauf': [x[0] for x in r[-200:]],
            'tasten': sorted(set().union(*[set(a) for a in lerner.aktionen]))}


class LernThread(threading.Thread):
    """Lernt im Hintergrund, solange gespielt wird; speichert alle 3 Minuten."""

    def __init__(self, lerner, speicher, seed=0):
        super().__init__(daemon=True)
        self.lerner, self.speicher = lerner, speicher
        self.rng = np.random.default_rng(seed)
        self._stopp = threading.Event()
        self.fehler = None
        self.hier = 0

    def stopp(self):
        self._stopp.set()

    def run(self):
        letzte = time.monotonic()
        basis = max(START_LERNEN, self.speicher.gesamt)   # nach Stopp/Start nicht "nachholen"
        try:
            while not self._stopp.is_set():
                erlaubt = (self.speicher.gesamt - basis) * VERHAELTNIS
                if self.speicher.n >= START_LERNEN and self.hier < erlaubt:
                    self.lerner.update(self.speicher, self.rng)
                    self.hier += 1
                else:
                    self._stopp.wait(0.01)
                if time.monotonic() - letzte > 180:
                    self.lerner.speichern()
                    letzte = time.monotonic()
        except Exception as e:   # noqa: BLE001
            self.fehler = e
        finally:
            try:
                self.lerner.speichern()
            except Exception as e:   # noqa: BLE001
                self.fehler = self.fehler or e


# ---------------------------------------------------------------- Belohnung

class Neugier:
    """Kleiner Bonus für Bilder, die selten vorkamen (zählt grobe Bild-Fingerabdrücke)."""

    def __init__(self, bits=32, seed=7):
        self.P = np.random.default_rng(seed).standard_normal((bits, (BH // 4) * (BW // 4)))
        self.n = {}

    def bonus(self, f):
        g = grau(f.astype(np.float32)).reshape(BH // 4, 4, BW // 4, 4).mean((1, 3)).ravel()
        key = np.packbits(self.P @ (g - g.mean()) > 0).tobytes()
        c = self.n.get(key, 0) + 1
        self.n[key] = c
        if len(self.n) > 300000:
            self.n.clear()
        return NEUGIER / math.sqrt(c)


class EndeErkennung:
    """Merkt, wann eine Runde vorbei ist: Bild steht still oder Game-Over-Bild ist zu sehen."""

    def __init__(self, stillstand=True, gameover=()):
        self.stillstand = stillstand
        self.go = list(gameover)
        self.go_verlauf = [[] for _ in self.go]
        self.vorher = None
        self.still_n = 0
        self.still_max = int(STILL_SEK * TAKT)

    @staticmethod
    def _scharf(bild):
        """Graubild bis 320 Pixel breit: genau genug, um kleine Bewegungen zu sehen."""
        g = bild.convert('L')
        fak = max(1, g.size[0] // 320)
        return np.asarray(g.reduce(fak) if fak > 1 else g, np.int16)

    def pruefe(self, bild, f, im_spiel):
        k = self._scharf(bild)
        still = False
        if self.vorher is not None and self.vorher.shape == k.shape:
            geaendert = int(np.count_nonzero(np.abs(k - self.vorher) > 12))
            still = geaendert <= max(3, int(0.0005 * k.size))
        self.vorher = k
        self.still_n = self.still_n + 1 if still else 0
        ende = self.stillstand and self.still_n >= self.still_max
        for i, (rel, vorlage) in enumerate(self.go):
            abst = float(np.mean(np.abs(ausschnitt(bild, rel, GO_GROESSE) - vorlage)))
            v = self.go_verlauf[i]
            schwelle = float(np.clip(0.35 * np.median(v), 6, 35)) if len(v) >= 20 else 15.0
            if abst < schwelle:
                ende = True
            elif im_spiel:
                v.append(abst)
                del v[:-300]
        return ende, still


# ---------------------------------------------------------------- Üben (die KI spielt)

class Ueben:
    """Ein Takt = Bild ansehen, Belohnung verbuchen, nächsten Zug wählen und Tasten drücken."""

    def __init__(self, backend, eingaben, hwnd, bereich, projekt, lerner, speicher, seed=None):
        self.backend, self.eingaben, self.hwnd, self.bereich = backend, eingaben, hwnd, bereich
        self.projekt, self.lerner, self.speicher = projekt, lerner, speicher
        info = projekt.info
        self.akt = lerner.aktionen
        self.akt_index = {frozenset(a): i for i, a in enumerate(self.akt)}
        self.alle_tasten = set().union(*[set(a) for a in self.akt])
        self.scan = projekt.scan_info()
        self.erkenner = EndeErkennung(info.get('stillstand', True), projekt.gameover_bilder())
        self.punkte_rel = info.get('punkte')
        self.punkte_vorher = None
        self.neustart = info.get('neustart', 'vk:32')
        self.go_rel = info['gameover'][0]['rel'] if info.get('gameover') else None
        self.neugier = Neugier()
        self.rng = np.random.default_rng(seed)
        self.ring, self.warte = [], []
        self.vorher = None
        self.neu_start = True
        self.phase, self.ende_takte, self.ok_takte = 'ende', TAKT // 2 - 1, 0
        self.ki_haelt, self.tipp = set(), None
        self.zufall_a, self.zufall_rest = 0, 0
        self.runde_takte, self.runde_punkte, self.runde_r = 0, 0, 0.0
        self.status = 'KI startet …'
        self.letzte_zeit = None
        eingaben.abholen()

    # --- Tasten
    def _druecken(self, vk, unten):
        if unten:
            if vk in MAUS:
                self.backend.maus_setzen(*self._punkt(None))
            self.ki_haelt.add(vk)
        else:
            self.ki_haelt.discard(vk)
        self.backend.taste(vk, unten, self.scan.get(vk))

    def _punkt(self, rel):
        x, y, w, h = self.bereich
        if rel is None:
            return x + w // 2, y + h // 2
        return x + int((rel[0] + rel[2] / 2) * w), y + int((rel[1] + rel[3] / 2) * h)

    def alle_los(self):
        for vk in list(self.ki_haelt):
            if self.eingaben.haelt(vk):
                self.ki_haelt.discard(vk)
            else:
                self._druecken(vk, False)

    def _anwenden(self, a):
        soll = set(self.akt[a])
        for vk in list(self.ki_haelt - soll):
            self._druecken(vk, False)
        for vk in sorted(soll - self.ki_haelt):
            self._druecken(vk, True)

    # --- Speicher
    def _festschreiben(self, behalten):
        while len(self.warte) > behalten:
            e = self.warte.pop(0)
            self.speicher.hinzu(e['f'], e['a'], e['r'], e['ende'], e['s'])

    def _unterbrechen(self, text):
        self.alle_los()
        self._festschreiben(0)
        self.vorher, self.ring, self.neu_start = None, [], True
        self.status = text

    def _runde_vorbei(self):
        weg = 0
        while self.warte and self.warte[-1]['still']:   # stehende Bilder gehören nicht zur Runde
            self.warte.pop()
            weg += 1
        if self.warte:
            self.warte[-1]['r'] = TOD
            self.warte[-1]['ende'] = True
        self._festschreiben(0)
        dauer = max(0, self.runde_takte - weg) / TAKT
        self.runde_r += TOD
        self.lerner.runden.append([round(dauer, 2), self.runde_punkte, round(self.runde_r, 2)])
        self.alle_los()
        self.vorher, self.ring = None, []
        self.phase, self.ende_takte, self.ok_takte = 'ende', 0, 0

    def _neustart_druecken(self):
        self.ende_takte += 1
        warte = TAKT // 2
        if self.ende_takte < warte or (self.ende_takte - warte) % TAKT:
            return
        ns = self.neustart
        if ns.startswith('vk:'):
            vk = int(ns[3:])
        elif ns in ('klick_go', 'klick_mitte'):
            vk = 0x01
            self.backend.maus_setzen(*self._punkt(self.go_rel if ns == 'klick_go' else None))
        else:
            return
        self.backend.taste(vk, True, self.scan.get(vk))
        self.tipp = vk

    # --- ein Takt
    def schritt(self):
        b = self.backend
        jetzt = time.monotonic()
        if self.letzte_zeit is not None:
            self.lerner.zeit += min(1.0, jetzt - self.letzte_zeit)
        self.letzte_zeit = jetzt
        if self.tipp is not None:
            b.taste(self.tipp, False, self.scan.get(self.tipp))
            self.tipp = None
        if b.vorne() != self.hwnd:
            self._unterbrechen('KI pausiert – das Spiel ist nicht vorne')
            self.letzte_zeit = None
            return
        bild = b.bild(self.bereich)
        f = verkleinern(bild)
        mensch = self.eingaben.abholen()
        mensch_aktiv = bool(mensch) or self.eingaben.sekunden_seit_letzter() < UEBERNAHME_SEK
        ende, still = self.erkenner.pruefe(bild, f, self.phase == 'spiel')

        if self.phase == 'ende':
            if ende or still:   # erst weiter, wenn sich das Bild wirklich wieder bewegt
                self.ok_takte = 0
                if not mensch_aktiv:
                    self._neustart_druecken()
                self.status = 'Runde vorbei – starte neu …'
                return
            self.ok_takte += 1
            if self.ok_takte < 3:
                return
            self.phase = 'spiel'
            self.ring, self.vorher, self.neu_start = [], None, True
            self.runde_takte, self.runde_punkte, self.runde_r = 0, 0, 0.0
            self.punkte_vorher = None

        # Belohnung für den letzten Zug
        if self.vorher is not None:
            r = LEBEN + self.neugier.bonus(f)
            if self.punkte_rel:
                pk = ausschnitt(bild, self.punkte_rel, PUNKTE_GROESSE)
                if (self.punkte_vorher is not None and self.runde_takte > TAKT
                        and float(np.mean(np.abs(pk - self.punkte_vorher))) > 4):
                    r += PUNKTE
                    self.runde_punkte += 1
                self.punkte_vorher = pk
            r = float(np.clip(r, -1, 1))
            self.runde_r += r
            vf, va, vs, vstill = self.vorher
            self.warte.append({'f': vf, 'a': va, 'r': r, 'ende': False, 's': vs, 'still': vstill})
        if ende:
            self._runde_vorbei()
            self.status = 'Verloren – merke mir das …'
            return
        self.runde_takte += 1
        self._festschreiben(self.erkenner.still_max + 1)

        # nächsten Zug wählen
        self.ring.append(f)
        del self.ring[:-STAPEL]
        if mensch_aktiv:
            self.alle_los()
            a = self.akt_index.get(frozenset(mensch & self.alle_tasten), -1)
            self.status = 'Du steuerst – die KI schaut zu'
        elif self.erkenner.still_n >= STILL_WARTEN and self.erkenner.stillstand:
            # Bild steht: nichts drücken, sonst startet sie das Spiel aus Versehen neu,
            # bevor sie merkt, dass sie verloren hat
            a = self.akt_index[frozenset()]
            self._anwenden(a)
            self.zufall_rest = 0
            self.status = 'Bild steht still – ist die Runde vorbei?'
        else:
            eps = self.lerner.zufall()
            if self.zufall_rest > 0:
                a = self.zufall_a
                self.zufall_rest -= 1
            elif self.rng.random() < eps:
                a = int(self.rng.integers(len(self.akt)))
                self.zufall_a, self.zufall_rest = a, int(self.rng.integers(0, 4))
            else:
                a = self.lerner.wahl(ring_stapel(self.ring))
            self._anwenden(a)
            self.lerner.schritte += 1
            self.status = f'KI übt  ·  drückt: {aktion_name(self.akt[a])}'
        self.vorher = (f, a, self.neu_start, still)
        self.neu_start = False

    def ende(self):
        self.alle_los()
        if self.tipp is not None:
            self.backend.taste(self.tipp, False, self.scan.get(self.tipp))
            self.tipp = None
        self._festschreiben(0)
        self.projekt.scan_merken(self.eingaben.scan)
        self.projekt.speichern()


# ---------------------------------------------------------------- Takt-Schleife

class Takt(threading.Thread):
    """Ruft obj.schritt() TAKT-mal pro Sekunde auf, bis stopp() kommt; danach obj.ende()."""

    def __init__(self, obj, fps=TAKT, fertig=None):
        super().__init__(daemon=True)
        self.obj, self.fps, self.fertig = obj, fps, fertig
        self._stopp = threading.Event()
        self.fehler = None
        self.zu_langsam = 0

    def stopp(self):
        self._stopp.set()

    def run(self):
        dt = 1.0 / self.fps
        naechster = time.perf_counter()
        try:
            while not self._stopp.is_set():
                self.obj.schritt()
                naechster += dt
                rest = naechster - time.perf_counter()
                if rest > 0:
                    self._stopp.wait(rest)
                else:
                    self.zu_langsam += 1
                    naechster = time.perf_counter()
        except Exception as e:   # noqa: BLE001 – Fehler an die Oberfläche melden
            self.fehler = e
        finally:
            try:
                self.obj.ende()
            except Exception as e:   # noqa: BLE001
                self.fehler = self.fehler or e
            if self.fertig:
                self.fertig(self)
