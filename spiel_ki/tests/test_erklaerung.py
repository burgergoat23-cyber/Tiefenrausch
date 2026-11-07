"""Prüft, ob das Programm Spiel-Erklärungen richtig in Einstellungen übersetzt."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import ki_kern as K  # noqa: E402

L, H, R, U, LEER, ENTER, KLICK = 0x25, 0x26, 0x27, 0x28, 0x20, 0x0D, 0x01

FAELLE = [
    ('Mit Leertaste springen, mit Pfeil runter ducken. Nach Game Over mit Enter neu starten.',
     dict(tasten=[LEER, U], neustart='vk:13', gameover_erwaehnt=True)),
    ('Man läuft mit A und D und springt mit W. Wenn man stirbt bleibt das Bild stehen, '
     'dann mit Leertaste nochmal.',
     dict(tasten=[0x41, 0x44, 0x57], neustart='vk:32', stillstand=True)),
    ('Steuerung mit den Pfeiltasten. Sammle möglichst viele Münzen!',
     dict(tasten=[L, H, R, U], punkte_erwaehnt=True)),
    ('Klicken damit der Vogel fliegt. Neustart durch Klick auf Game Over.',
     dict(tasten=[KLICK], neustart='klick_go')),
    ('WASD zum Laufen, Shift zum Rennen, E-Taste zum Benutzen. Drück nicht Q!',
     dict(tasten=[0x57, 0x41, 0x53, 0x44, 0xA0, 0x45])),
    ('Press space to jump. Press R to restart.', dict(tasten=[LEER], neustart='vk:82')),
    ('Pfeil nach links und Pfeil nach rechts zum Ausweichen. Das Spiel startet von selbst neu.',
     dict(tasten=[L, R], neustart='')),
    ('Ein Spiel mit 2 Leben, man drückt die Taste „X“ zum Schießen.', dict(tasten=[0x58])),
    ('Mit dem Mausrad zoomen, mit Rechtsklick bauen und mit Linksklick abbauen.',
     dict(tasten=[K.RAD_HOCH, K.RAD_RUNTER, 0x02, KLICK])),
    ('Mit der Maus zielen und mit Klick schießen. Laufen mit WASD.',
     dict(tasten=K.MAUS_BEWEGEN + [KLICK, 0x57, 0x41, 0x53, 0x44])),
    ('Die KI darf die ganze Tastatur benutzen.', dict(tasten=K.GANZE_TASTATUR)),
    ('', dict(tasten=[], neustart=None)),
]


def main():
    fehler = 0
    for text, soll in FAELLE:
        ist = K.erklaerung_verstehen(text)
        falsch = {k: (ist[k], v) for k, v in soll.items() if ist[k] != v}
        print(('OK    ' if not falsch else 'FEHLER') + f'  {text[:60]!r}' +
              (f'  -> {falsch}' if falsch else f'  -> {[K.tasten_name(v) for v in ist["tasten"]]}'))
        fehler += bool(falsch)
    print('ALLES OK' if not fehler else f'{fehler} FEHLER')
    sys.exit(1 if fehler else 0)


if __name__ == '__main__':
    main()
