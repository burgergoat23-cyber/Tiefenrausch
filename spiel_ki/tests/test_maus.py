"""Prüft Mausrad, Mausbewegung und Klicks der KI (ohne Windows, mit Schein-Bildschirm)."""
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
import ki_kern as K  # noqa: E402
from testspiel import Laeufer, ScheinBackend  # noqa: E402


class Protokoll(ScheinBackend):
    def __init__(self, spiel):
        super().__init__(spiel)
        self.log, self.pos = [], (50, 50)

    def rad(self, r):
        self.log.append(('rad', r))

    def maus_bewegen(self, dx, dy):
        self.pos = (self.pos[0] + dx, self.pos[1] + dy)
        self.log.append(('bewegen', dx, dy))

    def maus_setzen(self, x, y):
        self.pos = (x, y)
        self.log.append(('setzen', x, y))

    def maus_pos(self):
        return self.pos

    def taste(self, vk, unten, scan=None):
        super().taste(vk, unten, scan)
        self.log.append(('taste', vk, unten))


def main():
    proj = K.Projekt(tempfile.mkdtemp())
    proj.info['tasten'] = [K.RAD_HOCH, K.RAD_RUNTER, 0x01] + K.MAUS_BEWEGEN
    lerner = K.Lerner(proj, proj.aktionen(), threads=1)
    be = Protokoll(Laeufer(1))
    bereich = (0, 0, 240, 160)
    ue = K.Ueben(be, K.Eingaben(), 1, bereich, proj, lerner, K.Speicher(500), seed=0)
    akt = {a: i for i, a in enumerate(ue.akt)}
    fehler = []

    def pruefe(bed, text):
        print(('OK    ' if bed else 'FEHLER') + '  ' + text)
        if not bed:
            fehler.append(text)

    pruefe(len(ue.akt) == 1 + 7, f'Züge ohne Paare bei 7 Tasten: {len(ue.akt)}')
    be.log.clear()
    ue._anwenden(akt[(K.RAD_HOCH,)])
    ue._anwenden(akt[(K.RAD_HOCH,)])
    pruefe([e for e in be.log if e[0] == 'rad'] == [('rad', 1), ('rad', 1)],
           f'Mausrad dreht jeden Takt: {be.log}')
    pruefe(not ue.ki_haelt, 'Mausrad wird nicht "gehalten"')
    be.log.clear()
    for _ in range(20):
        ue._anwenden(akt[(K.MAUS_LINKS,)])
    x, y = be.pos
    pruefe(0 <= x < 240 and 0 <= y < 160, f'Maus bleibt im Spielfeld: {be.pos}')
    be.pos = (120, 80)
    ue._anwenden(akt[(K.MAUS_RECHTS,)])
    pruefe(be.pos == (120 + ue.schritt_px, 80), f'Maus bewegt sich nach rechts: {be.pos}')
    be.log.clear()
    ue._anwenden(akt[(0x01,)])
    pruefe(('taste', 0x01, True) in be.log and not any(e[0] == 'setzen' for e in be.log),
           f'Klick dort, wo die Maus gerade ist: {be.log}')
    ue._anwenden(akt[()])
    pruefe(('taste', 0x01, False) in be.log and not ue.ki_haelt, 'Klick wird losgelassen')
    # Ohne "Maus bewegen": Klick immer in die Mitte des Spielfelds
    proj2 = K.Projekt(tempfile.mkdtemp())
    proj2.info['tasten'] = [0x01]
    l2 = K.Lerner(proj2, proj2.aktionen(), threads=1)
    be2 = Protokoll(Laeufer(1))
    ue2 = K.Ueben(be2, K.Eingaben(), 1, bereich, proj2, l2, K.Speicher(500), seed=0)
    ue2._anwenden(1)
    pruefe(('setzen', 120, 80) in be2.log, f'ohne Mausbewegung: Klick in die Mitte {be2.log}')
    # ein paar echte Takte mit allen Zügen laufen lassen
    for _ in range(300):
        ue.schritt()
    pruefe(True, f'300 Takte mit Maus-Zügen ohne Fehler (Runden: {len(lerner.runden)})')
    print('ALLES OK' if not fehler else f'{len(fehler)} FEHLER')
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
