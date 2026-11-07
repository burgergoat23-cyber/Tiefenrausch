"""Prüft den Windows-Teil (unter echtem Windows oder unter Wine).

Aufruf:  python tests/windows_test.py
Prüft: Haken sieht "menschliche" Tasten/Klicks, eigene KI-Tasten werden ausgeblendet,
F8 kommt als Kurztaste an, Scan-Codes ergeben die richtigen Tasten, ein Fenster empfängt
die Tasten der KI, Bildschirmfoto und Fenster-Abfragen funktionieren.
"""
import ctypes
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import ki_kern as K  # noqa: E402
import ki_windows as W  # noqa: E402

fehler = []


def pruefe(bed, text):
    print(('OK    ' if bed else 'FEHLER') + '  ' + text, flush=True)
    if not bed:
        fehler.append(text)


def mensch_taste(vk=0, unten=True, scan=0, ext=False):
    """Tastendruck OHNE Kennung – so sieht es aus, wenn ein Mensch drückt."""
    inp = W.INPUT()
    inp.type = W.INPUT_KEYBOARD
    fl = (0 if unten else W.KEYEVENTF_KEYUP) | (W.KEYEVENTF_SCANCODE if scan else 0)
    fl |= W.KEYEVENTF_EXTENDEDKEY if ext else 0
    inp.ki = W.KEYBDINPUT(vk, scan, fl, 0, 0)
    W._senden(inp)


def mensch_klick(unten):
    inp = W.INPUT()
    inp.type = W.INPUT_MOUSE
    inp.mi = W.MOUSEINPUT(0, 0, 0, 0x0002 if unten else 0x0004, 0, 0)
    W._senden(inp)


def warte(sek, root=None):
    ende = time.time() + sek
    while time.time() < ende:
        if root is not None:
            root.update()
        time.sleep(0.01)


def main():
    pruefe(ctypes.sizeof(W.INPUT) == (40 if ctypes.sizeof(ctypes.c_void_p) == 8 else 28),
           f'Größe INPUT = {ctypes.sizeof(W.INPUT)}')
    W.dpi_bewusst()
    be = W.WindowsBackend()
    gesehen, kurz = [], []
    be.start(lambda vk, unten, sc, ext: gesehen.append((vk, unten, sc, ext)), kurz.append)
    warte(1.0)

    # Fenster, das die Tasten empfangen soll (wie ein Spiel)
    import tkinter as tk
    root = tk.Tk()
    root.geometry('300x200+50+50')
    angekommen = []
    root.bind('<KeyPress>', lambda e: angekommen.append(('ab', e.keysym)))
    root.bind('<KeyRelease>', lambda e: angekommen.append(('auf', e.keysym)))
    root.bind('<ButtonPress-1>', lambda e: angekommen.append(('klick', e.x, e.y)))
    root.bind('<MouseWheel>', lambda e: angekommen.append(('rad', e.delta)))
    root.update()
    root.focus_force()
    warte(1.0, root)

    # 1) eigene Tasten der KI: Fenster bekommt sie, Haken ignoriert sie
    gesehen.clear()
    for vk in (0x41, 0x20, 0x25, 0x28):
        be.taste(vk, True)
        warte(0.05, root)
        be.taste(vk, False)
        warte(0.05, root)
    warte(0.5, root)
    pruefe(gesehen == [], f'eigene KI-Tasten nicht als menschlich gezählt ({gesehen})')
    syms = [s for a, s in angekommen if a == 'ab']
    pruefe(syms == ['a', 'space', 'Left', 'Down'], f'Fenster hat KI-Tasten bekommen: {syms}')

    # 2) "menschliche" Tasten werden gesehen
    gesehen.clear()
    mensch_taste(0x41, True)
    mensch_taste(0x41, False)
    mensch_taste(0x20, True)
    mensch_taste(0x20, False)
    warte(0.5, root)
    pruefe([(v, u) for v, u, s, e in gesehen] == [(0x41, True), (0x41, False), (0x20, True),
                                                  (0x20, False)],
           f'menschliche Tasten gesehen: {gesehen}')

    # 3) Scan-Codes (so drückt die KI): richtige Taste und richtiger Scan-Code kommen an
    gesehen.clear()
    soll = []
    for vk in (0x25, 0x26, 0x27, 0x28, 0x20, 0x57):
        sc, ext = W._scan(vk)
        soll.append((vk, sc))
        mensch_taste(vk, True, sc, ext)
        mensch_taste(vk, False, sc, ext)
    warte(0.5, root)
    ist = [(v, s) for v, u, s, e in gesehen if u]
    pruefe(ist == soll, f'Scan-Codes -> Tasten: {ist} soll {soll}')
    erw = [e for v, u, s, e in gesehen if u]
    pruefe(erw[:4] == [True] * 4 and erw[4:] == [False, False], f'Pfeiltasten erweitert: {erw}')

    # 4) F8 kommt nur als Kurztaste an (auch beim Festhalten nur einmal)
    gesehen.clear()
    mensch_taste(K.F8, True)
    mensch_taste(K.F8, True)
    mensch_taste(K.F8, False)
    warte(0.5, root)
    pruefe(kurz == [K.F8] and not gesehen, f'F8 als Kurztaste: {kurz}, sonst: {gesehen}')

    # 5) Maus: eigener Klick ignoriert, menschlicher gesehen
    gesehen.clear()
    angekommen.clear()
    x0, y0 = root.winfo_rootx() + 100, root.winfo_rooty() + 80
    be.maus_setzen(x0, y0)
    warte(0.2, root)
    pruefe(abs(be.maus_pos()[0] - x0) <= 1 and abs(be.maus_pos()[1] - y0) <= 1,
           f'Maus gesetzt: {be.maus_pos()} soll {(x0, y0)}')
    be.taste(0x01, True)
    warte(0.05, root)
    be.taste(0x01, False)
    warte(0.4, root)
    pruefe(any(a[0] == 'klick' for a in angekommen), f'Fenster hat Klick bekommen: {angekommen}')
    angekommen.clear()
    be.rad(1)
    be.rad(-1)
    warte(0.4, root)
    raeder = [a[1] for a in angekommen if a[0] == 'rad']
    pruefe(len(raeder) == 2 and raeder[0] > 0 > raeder[1], f'Mausrad hoch/runter angekommen: {raeder}')
    vorher = be.maus_pos()
    be.maus_bewegen(30, -10)
    warte(0.3, root)
    nachher = be.maus_pos()
    pruefe(nachher[0] > vorher[0] and nachher[1] < vorher[1],
           f'Maus relativ bewegt: {vorher} -> {nachher}')

    # 6) Fenster und Bild
    root.focus_force()
    warte(0.5, root)
    h = be.vorne()
    pruefe(bool(h), f'Fenster vorne: {h} „{be.titel(h)}“')
    pruefe(be.fenster_pruefen(h, None) is not None, 'eigenes Fenster wird abgelehnt')
    b = be.gesamtbildschirm()
    pruefe(b[2] > 100 and b[3] > 100, f'Gesamtbildschirm {b}')
    img = be.bild((root.winfo_rootx(), root.winfo_rooty(), 120, 80))
    pruefe(img.size == (120, 80) and img.mode == 'RGB', f'Bildschirmfoto {img.size} {img.mode}')
    f = K.verkleinern(img)
    pruefe(f.shape == (K.BH, K.BW, 3), f'verkleinert {f.shape}')
    be.stopp()
    root.destroy()
    print('ALLES OK' if not fehler else f'{len(fehler)} FEHLER', flush=True)
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
