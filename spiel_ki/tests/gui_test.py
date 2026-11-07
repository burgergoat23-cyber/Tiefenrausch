"""Startet das Fenster mit einem Schein-Bildschirm (Testspiel) und macht Bildschirmfotos.

Aufruf (Linux mit Xvfb):  xvfb-run -s "-screen 0 1400x1000x24" python tests/gui_test.py <ordner>
Prüft: Fenster baut sich auf, Üben startet/stoppt, Gelerntes wird gespeichert.
"""
import os
import sys
import tempfile
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import ki_kern as K  # noqa: E402
import spiel_ki  # noqa: E402
from testspiel import LEER, RUNTER, Laeufer  # noqa: E402

aus = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp()
os.makedirs(aus, exist_ok=True)


class GuiSchein:
    def __init__(self):
        self.spiel = Laeufer(3)
        self.tasten, self.neu = set(), set()
        self.pieps = []

    def start(self, bei_taste, bei_hotkey):
        self.bei_hotkey = bei_hotkey

    def stopp(self):
        pass

    def vorne(self):
        return 42

    def fenster_pruefen(self, hwnd, bereich):
        return None if hwnd == 42 else 'falsches Fenster'

    def gesamtbildschirm(self):
        return 0, 0, 1400, 1000

    def bild(self, bereich):
        self.spiel.tick(self.tasten | self.neu)
        self.neu = set()
        return self.spiel.zeichnen()

    def taste(self, vk, unten, scan=None):
        (self.tasten.add if unten else self.tasten.discard)(vk)
        if unten:
            self.neu.add(vk)

    def maus_setzen(self, x, y):
        pass

    def maus_pos(self):
        return 0, 0

    def piep(self, art):
        self.pieps.append(art)


def foto(root, name):
    import mss
    from PIL import Image
    root.update()
    time.sleep(0.3)
    root.update()
    x, y = root.winfo_rootx(), root.winfo_rooty()
    w, h = root.winfo_width(), root.winfo_height()
    with (getattr(mss, 'MSS', None) or mss.mss)() as sct:
        raw = sct.grab({'left': x, 'top': y, 'width': w, 'height': h})
    Image.frombytes('RGB', raw.size, raw.bgra, 'raw', 'BGRX').save(os.path.join(aus, name))
    print('Foto:', os.path.join(aus, name), w, 'x', h)


def warte(root, sek):
    ende = time.time() + sek
    while time.time() < ende:
        root.update()
        time.sleep(0.02)


def main():
    spiel_ki.SPIELE = os.path.join(tempfile.mkdtemp(), 'spiele')
    tk, root = spiel_ki.tk_laden()
    be = GuiSchein()
    app = spiel_ki.App(be, tk, root)
    root.geometry('+20+20')
    warte(root, 1.0)
    print('natürliche Größe:', root.winfo_reqwidth(), 'x', root.winfo_reqheight())
    while not app.torch_bereit:
        warte(root, 0.2)
    foto(root, 'gui_1_leer.png')
    assert app.projekt.name == 'Mein Spiel'

    # Erklärung eintippen und übernehmen -> Tasten und Neustart werden eingestellt
    app._erkl_fokus(True)
    app.erkl.insert('1.0', 'Mit A und D laufen, mit Leertaste springen. Nach Game Over mit Enter '
                           'neu starten. Sammle Punkte!')
    app._erklaerung_uebernehmen()
    assert app.projekt.info['tasten'] == sorted([0x41, 0x44, LEER]), app.projekt.info['tasten']
    assert app.projekt.info['neustart'] == 'vk:13', app.projekt.info['neustart']
    assert app.tasten_vars[0x41].get() and app.tasten_vars[LEER].get()
    warte(root, 0.3)
    foto(root, 'gui_0_erklaert.png')
    print('Erklärung:', app.status.cget('text').replace(chr(10), ' | '))
    app.tasten_vars[0x41].set(False)
    app._taste_umschalten(0x41)
    app.tasten_vars[0x44].set(False)
    app._taste_umschalten(0x44)
    app.projekt.info['neustart'] = 'vk:32'

    # Einstellungen wie ein Nutzer: Bereich, Tasten
    app.projekt.info['bereich'] = [100, 100, 240, 160]
    app.projekt.speichern()
    app._anzeigen()
    for vk in (LEER, RUNTER):
        app.tasten_vars[vk].set(True)
        app._taste_umschalten(vk)
    assert app.projekt.info['tasten'] == sorted([LEER, RUNTER]), app.projekt.info['tasten']

    # F8 wie über den Haken -> startet
    be.bei_hotkey(K.F8)
    warte(root, 0.5)
    assert app.laeuft(), app.status.cget('text')
    warte(root, 20)
    foto(root, 'gui_2_uebt.png')
    n_runden = len(app.lerner.runden)
    print('Runden nach 20 s:', n_runden, '| Status:', app.status.cget('text'))
    be.bei_hotkey(K.F8)
    for _ in range(100):
        warte(root, 0.2)
        if not app.laeuft():
            break
    assert not app.laeuft()
    assert app.projekt.hat_modell(), 'gehirn.pt fehlt'
    st = app.projekt.info.get('statistik')
    assert st and st['runden'] == n_runden or st['runden'] >= n_runden, st
    print('Status nach Stopp:', app.status.cget('text'))
    print('Pieptöne:', be.pieps)

    # Knopf statt F8: Countdown 3 s, dann läuft es; nochmal Knopf = Stopp
    app._start_knopf()
    warte(root, 1.0)
    assert not app.laeuft() and 'Start in' in app.status.cget('text'), app.status.cget('text')
    warte(root, 3.0)
    assert app.laeuft(), 'Countdown startet nicht: ' + app.status.cget('text')
    warte(root, 2.0)
    app._start_knopf()
    for _ in range(100):
        warte(root, 0.2)
        if not app.laeuft():
            break
    assert not app.laeuft()
    # Countdown abbrechen
    app._start_knopf()
    warte(root, 0.5)
    app._start_knopf()
    warte(root, 4.0)
    assert not app.laeuft(), 'abgebrochener Countdown hat trotzdem gestartet'
    print('Countdown-Knopf OK')

    # Nach Neustart des Programms: Statistik wird ohne Training angezeigt
    app.lerner = None
    app._projekt_waehlen('Mein Spiel')
    # Schau-Kurve: ausgedachter Verlauf, damit man das Diagramm im Foto sieht
    app.projekt.info['statistik']['verlauf'] = [3 + i * 0.12 + (i % 7) * 0.6 for i in range(120)]
    app.projekt.info['statistik'].update(runden=120, best=19.3, zeit=2700, zufall=0.08)
    app._zahlen_zeigen()
    foto(root, 'gui_3_kurve.png')
    app.schliessen()
    print('OK')


if __name__ == '__main__':
    main()
