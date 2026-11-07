"""Das Testspiel (Läufer) als echtes Fenster mit eigener Uhr – wie ein richtiges PC-Spiel.

Aufruf: python tests/fenster_spiel.py [protokoll.txt]
Schreibt jede beendete Runde (überstandene Hindernisse) und gezählte Tastendrücke ins Protokoll.
"""
import os
import sys
import tkinter as tk

from PIL import ImageTk

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from testspiel import LEER, RUNTER, Laeufer  # noqa: E402

protokoll = sys.argv[1] if len(sys.argv) > 1 else None
spiel = Laeufer(5)
gedrueckt, neu = set(), set()
druecke = {'Leertaste': 0, 'runter': 0}
TASTEN = {'space': LEER, 'Down': RUNTER}

root = tk.Tk()
root.title('Testspiel')
root.geometry('480x320+600+120')
c = tk.Canvas(root, width=480, height=320, highlightthickness=0)
c.pack()
bild_id = c.create_image(0, 0, anchor='nw')
runden_vorher = 0


def ab(e):
    vk = TASTEN.get(e.keysym)
    if vk and vk not in gedrueckt:
        neu.add(vk)
        druecke['Leertaste' if vk == LEER else 'runter'] += 1
    if vk:
        gedrueckt.add(vk)


def auf(e):
    vk = TASTEN.get(e.keysym)
    if vk:
        gedrueckt.discard(vk)


def takt():
    global runden_vorher
    spiel.tick(gedrueckt | neu)
    neu.clear()
    img = spiel.zeichnen().resize((480, 320))
    c.tkimg = ImageTk.PhotoImage(img)
    c.itemconfig(bild_id, image=c.tkimg)
    if protokoll and len(spiel.runden) != runden_vorher:
        runden_vorher = len(spiel.runden)
        with open(protokoll, 'w') as f:
            f.write(f'runden={spiel.runden}\ndruecke={druecke}\n')
    root.after(50, takt)     # 20 Takte pro Sekunde, egal was die KI macht


root.bind('<KeyPress>', ab)
root.bind('<KeyRelease>', auf)
root.after(50, takt)
root.mainloop()
