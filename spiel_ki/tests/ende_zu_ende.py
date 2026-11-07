"""Großer Test unter Windows/Wine: die echte Spiel-KI übt am Testspiel-Fenster.

Aufruf: python tests/ende_zu_ende.py [Sekunden] [Bildordner]
Ablauf wie beim Nutzer: Spielfeld + Tasten einstellen, ins Spiel klicken, F8 drücken,
üben lassen, F8 drücken. Prüft: KI drückt Tasten im Spiel, erkennt verlorene Runden,
startet neu, speichert das Gelernte, keine Fehler.
"""
import ctypes
import os
import subprocess
import sys
import tempfile
import time
from ctypes import wintypes

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HIER, '..'))
sys.path.insert(0, HIER)
import ki_kern as K  # noqa: E402
import ki_windows as W  # noqa: E402
import spiel_ki  # noqa: E402
from windows_test import mensch_klick, mensch_taste  # noqa: E402

SEK = int(sys.argv[1]) if len(sys.argv) > 1 else 90
BILDER = sys.argv[2] if len(sys.argv) > 2 else tempfile.mkdtemp()
u = W.user32
u.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
u.FindWindowW.restype = wintypes.HWND
u.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
u.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.POINT)]
u.SetForegroundWindow.argtypes = [wintypes.HWND]


def warte(root, sek):
    ende = time.time() + sek
    while time.time() < ende:
        root.update()
        time.sleep(0.01)


def main():
    os.makedirs(BILDER, exist_ok=True)
    tmp = tempfile.mkdtemp()
    proto = os.path.join(tmp, 'proto.txt')
    spiel = subprocess.Popen([sys.executable, os.path.join(HIER, 'fenster_spiel.py'), proto])
    hwnd = None
    for _ in range(100):
        time.sleep(0.2)
        hwnd = u.FindWindowW(None, 'Testspiel')
        if hwnd:
            break
    assert hwnd, 'Testspiel-Fenster nicht gefunden'
    time.sleep(1)
    r, p = wintypes.RECT(), wintypes.POINT(0, 0)
    u.GetClientRect(hwnd, ctypes.byref(r))
    u.ClientToScreen(hwnd, ctypes.byref(p))
    bereich = [p.x, p.y, r.right, r.bottom]
    print('Spielfeld:', bereich, flush=True)

    spiel_ki.SPIELE = os.path.join(tmp, 'spiele')
    W.dpi_bewusst()
    tk, root = spiel_ki.tk_laden()
    be = W.WindowsBackend()
    app = spiel_ki.App(be, tk, root)
    root.geometry('560x860+0+0')
    t0 = time.time()
    while not app.torch_bereit and time.time() - t0 < 120:
        warte(root, 0.2)
    assert app.torch_bereit, app.status.cget('text')
    app.projekt.info.update({'bereich': bereich, 'tasten': [0x20, 0x28], 'neustart': 'vk:32',
                             'stillstand': True})
    app.projekt.speichern()
    app._anzeigen()

    # wie der Nutzer: ins Spiel klicken, dann F8
    u.SetForegroundWindow(hwnd)
    be.maus_setzen(bereich[0] + bereich[2] // 2, bereich[1] + bereich[3] // 2)
    mensch_klick(True)
    mensch_klick(False)
    warte(root, 1.5)
    print('vorne:', be.titel(be.vorne()), flush=True)
    mensch_taste(K.F8, True)
    mensch_taste(K.F8, False)
    warte(root, 1.0)
    assert app.laeuft(), 'Üben startet nicht: ' + app.status.cget('text')
    print('Status:', app.status.cget('text'), flush=True)

    ende = time.time() + SEK
    foto = time.time() + min(45, SEK - 5)
    while time.time() < ende:
        warte(root, 1.0)
        if foto and time.time() > foto:
            gx, gy, gw, gh = be.gesamtbildschirm()
            be.bild((gx, gy, gw, gh)).save(os.path.join(BILDER, 'wine_uebt.png'))
            foto = None
        if int(time.time()) % 10 == 0:
            print(f'  {int(SEK - (ende - time.time()))} s: Runden={len(app.lerner.runden)}  '
                  f'Speicher={app.speicher.n}  Lernschritte={app.lerner.updates}  '
                  f'Status: {app.status.cget("text")}', flush=True)
    langsam = app.takt.zu_langsam
    mensch_taste(K.F8, True)
    mensch_taste(K.F8, False)
    for _ in range(150):
        warte(root, 0.2)
        if not app.laeuft():
            break
    print('Nach Stopp:', app.status.cget('text'), flush=True)
    fehler = []
    if app.laeuft():
        fehler.append('läuft nach F8 noch')
    runden = app.lerner.runden
    print('KI-Runden:', len(runden), [r[0] for r in runden[:10]], flush=True)
    if len(runden) < 3:
        fehler.append(f'zu wenige erkannte Runden: {len(runden)}')
    txt = open(proto).read() if os.path.exists(proto) else ''
    print('Spiel-Protokoll:', txt.replace('\n', ' | '), flush=True)
    if 'Leertaste' not in txt or "'Leertaste': 0" in txt:
        fehler.append('Spiel hat keine Leertaste bekommen')
    if not app.projekt.hat_modell():
        fehler.append('gehirn.pt fehlt')
    if os.path.exists(spiel_ki.LOG):
        fehler.append('fehler.log: ' + open(spiel_ki.LOG, encoding='utf-8').read()[-500:])
    print('Zu langsame Takte:', langsam, flush=True)
    app.schliessen()
    spiel.terminate()
    print('ALLES OK' if not fehler else 'FEHLER: ' + ' / '.join(fehler), flush=True)
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
