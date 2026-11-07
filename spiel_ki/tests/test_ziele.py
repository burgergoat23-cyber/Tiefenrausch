"""Prüft, wie die Erklärung das Lernen beeinflusst: Ziel-Richtung, wichtige und verbotene Tasten."""
import os
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
import ki_kern as K  # noqa: E402
from testspiel import LEER, RUNTER, Laeufer, ScheinBackend  # noqa: E402

fehler = []


def pruefe(bed, text):
    print(('OK    ' if bed else 'FEHLER') + '  ' + text)
    if not bed:
        fehler.append(text)


def main():
    # 1) Text -> Ziel-Richtung, wichtige und verbotene Tasten
    e = K.erklaerung_verstehen('Mit D läuft man nach rechts, mit Leertaste springen. Das Ziel ist, so '
                               'weit wie möglich nach rechts zu kommen. Drück niemals Q!')
    pruefe(e['richtung'] == 'rechts', f'Ziel-Richtung erkannt: {e["richtung"]}')
    pruefe(e['verboten'] == [0x51], f'verbotene Taste: {e["verboten"]}')
    pruefe(e['tasten'] == [0x44, LEER], f'wichtige Tasten: {e["tasten"]}')
    e = K.erklaerung_verstehen('Mit D läuft man nach rechts.')
    pruefe(e['richtung'] is None, 'Steuerung "nach rechts" ist noch kein Ziel')
    e = K.erklaerung_verstehen('Du musst nach oben klettern, mit W.')
    pruefe(e['richtung'] == 'oben', f'Ziel nach oben: {e["richtung"]}')

    # 2) Bildbewegung messen
    rng = np.random.default_rng(1)
    gross = (rng.random((140, 260)) * 255).astype(np.float32)
    a, b = gross[10:122, 20:180], gross[10:122, 25:185]   # Kamera 5 px nach rechts
    pruefe(K.verschiebung(a, b) == (-5, 0), f'Verschiebung 5 px: {K.verschiebung(a, b)}')
    c = gross[13:125, 20:180]                               # Kamera 3 px nach unten
    pruefe(K.verschiebung(a, c) == (0, -3), f'Verschiebung nach unten: {K.verschiebung(a, c)}')
    pruefe(K.richtungs_bonus('rechts', -5, 0, 160) > 0 > K.richtungs_bonus('links', -5, 0, 160),
           'Bonus nur in Ziel-Richtung')
    spiel = Laeufer(2)
    boni = []
    vorher = None
    for _ in range(60):
        spiel.tick(set())
        k = K._klein_grau(spiel.zeichnen())
        if vorher is not None and not spiel.vorbei:
            dx, dy = K.verschiebung(vorher, k)
            boni.append(K.richtungs_bonus('rechts', dx, dy, k.shape[1]))
        vorher = k
    pruefe(np.mean(boni) > 0, f'Testspiel läuft nach rechts -> Bonus {np.mean(boni):.3f}')

    # 3) erklärte Tasten werden beim Zufall öfter probiert
    proj = K.Projekt(tempfile.mkdtemp())
    proj.info['tasten'] = K.GANZE_TASTATUR
    proj.info['wichtig'] = [LEER, RUNTER]
    proj.info['ziel_richtung'] = 'rechts'
    lerner = K.Lerner(proj, proj.aktionen(), threads=1)
    ue = K.Ueben(ScheinBackend(Laeufer(1)), K.Eingaben(), 1, (0, 0, 240, 160), proj, lerner,
                 K.Speicher(500), seed=3)
    gezogen = []
    alt = ue._anwenden
    ue._anwenden = lambda a: (gezogen.append(a), alt(a))
    for _ in range(600):
        ue.schritt()
    wichtig = sum(1 for a in gezogen if set(ue.akt[a]) & {LEER, RUNTER}) / max(1, len(gezogen))
    gleich = 2 / len(ue.akt)
    pruefe(wichtig > 0.4, f'erklärte Tasten: {wichtig:.0%} der Züge (ohne Erklärung ~{gleich:.0%})')
    r = [e['r'] for e in ue.warte] + list(ue.speicher.r[:ue.speicher.n])
    pruefe(max(r) > K.LEBEN + K.NEUGIER, f'Richtungs-Bonus kommt in der Belohnung an (max {max(r):.3f})')
    print('ALLES OK' if not fehler else f'{len(fehler)} FEHLER')
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
