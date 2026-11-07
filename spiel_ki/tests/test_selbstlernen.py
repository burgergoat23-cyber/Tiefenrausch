"""Prüft, ob die KI das Testspiel ganz allein lernt (ohne Vormachen, ohne Windows).

Aufruf:  python tests/test_selbstlernen.py [Schritte]
Vergleicht am Ende: Zufall vs. gelernte KI (überstandene Hindernisse pro Runde).
"""
import os
import sys
import tempfile
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import ki_kern as K  # noqa: E402
from testspiel import LEER, RUNTER, Laeufer, ScheinBackend  # noqa: E402


def runde_mit(lerner, zufall, n_takte, seed):
    """Spielt n_takte mit fester Strategie (ohne Lernen) und gibt Punkte je Runde zurück."""
    spiel = Laeufer(seed)
    be = ScheinBackend(spiel)
    proj = K.Projekt(tempfile.mkdtemp())
    proj.info.update({'tasten': [LEER, RUNTER], 'neustart': 'vk:32'})
    sp = K.Speicher(2000)
    ue = K.Ueben(be, K.Eingaben(), 1, (0, 0, 240, 160), proj, lerner, sp, seed=seed)
    alt = lerner.zufall
    gemerkt = lerner.schritte, len(lerner.runden), lerner.zeit
    lerner.zufall = lambda: zufall
    try:
        for _ in range(n_takte):
            ue.schritt()
    finally:
        lerner.zufall = alt
        lerner.schritte, lerner.zeit = gemerkt[0], gemerkt[2]
        del lerner.runden[gemerkt[1]:]
    return spiel.runden


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('schritte', type=int, nargs='?', default=40000)
    ap.add_argument('--zufall', type=int, default=K.ZUFALL_SCHRITTE, help='Takte bis 10 %% Zufall')
    ap.add_argument('--verhaeltnis', type=float, default=K.VERHAELTNIS, help='Lernschritte je Takt')
    ap.add_argument('--pruefen', type=int, default=0, help='alle N Takte ohne Zufall testen')
    ap.add_argument('--threads', type=int, default=3)
    arg = ap.parse_args()
    schritte = arg.schritte
    K.ZUFALL_SCHRITTE = arg.zufall
    print(f'Zufall bis {arg.zufall} Takte, {arg.verhaeltnis} Lernschritte je Takt')
    ordner = tempfile.mkdtemp()
    proj = K.Projekt(ordner)
    proj.info.update({'tasten': [LEER, RUNTER], 'neustart': 'vk:32', 'stillstand': True})
    lerner = K.Lerner(proj, proj.aktionen(), threads=arg.threads)
    print('Züge:', [K.aktion_name(a) for a in lerner.aktionen])
    spiel = Laeufer(1)
    be = ScheinBackend(spiel)
    sp = K.Speicher(K.SPEICHER)
    ue = K.Ueben(be, K.Eingaben(), 1, (0, 0, 240, 160), proj, lerner, sp, seed=1)
    rng = np.random.default_rng(0)
    t0 = time.time()
    guthaben = 0.0
    for i in range(1, schritte + 1):
        ue.schritt()
        if sp.n >= K.START_LERNEN:
            guthaben += arg.verhaeltnis
            while guthaben >= 1:
                lerner.update(sp, rng)
                guthaben -= 1
        if arg.pruefen and i % arg.pruefen == 0:
            lerner.sync()
            ki = runde_mit(lerner, 0.0, 1500, seed=7)
            print(f'        Prüfung ohne Zufall nach {i} Takten ({i / K.TAKT / 60:.0f} min): '
                  f'{np.mean(ki) if ki else 0:.2f} Hindernisse/Runde', flush=True)
        if i % 2000 == 0:
            r = spiel.runden[-30:]
            d = [x[0] for x in lerner.runden[-30:]]
            print(f'{i:6d} Takte  {time.time() - t0:5.0f}s  Zufall {lerner.zufall():.2f}  '
                  f'Runden {len(spiel.runden):4d}  Hindernisse/Runde {np.mean(r) if r else 0:5.2f}  '
                  f'Sek/Runde {np.mean(d) if d else 0:5.1f}', flush=True)
    lerner.speichern()
    print('Gespeichert:', os.path.getsize(proj.modell_pfad) // 1024, 'KB')
    # neu laden (wie nach einem Neustart des Programms) und vergleichen
    l2 = K.Lerner(proj, proj.aktionen(), threads=3)
    assert l2.geladen and l2.schritte == lerner.schritte
    zuf = runde_mit(l2, 1.0, 4000, seed=99)
    ki = runde_mit(l2, 0.0, 4000, seed=99)
    print(f'Zufall:     {np.mean(zuf) if zuf else 0:.2f} Hindernisse/Runde ({len(zuf)} Runden)')
    print(f'Gelernte KI: {np.mean(ki) if ki else 0:.2f} Hindernisse/Runde ({len(ki)} Runden)')


if __name__ == '__main__':
    main()
