#!/usr/bin/env python3
"""Erzeugt die Platzhalter-Texturen (Vorgabe Abschnitt 5.4, Schritt 1).

Ein Platzhalter ist ein einfarbiges Feld mit den Anfangsbuchstaben des Items.
So startet das Spiel ohne fehlende Texturen, und man sieht sofort, dass die
richtige Textur noch aussteht.

In der Liste PLATZHALTER stehen nur Texturen, die noch Platzhalter sind.
Sobald eine richtige Textur entsteht, wird ihr Eintrag hier gelöscht, damit
dieses Skript sie nicht wieder überschreibt.

Aufruf (im Projektordner):  python3 tools/texturen/platzhalter.py
Braucht nur Python 3, keine Zusatzpakete.
"""

import struct
import zlib
from pathlib import Path

GROESSE = 16
PROJEKT_ORDNER = Path(__file__).resolve().parents[2]
TEXTUR_ORDNER = PROJEKT_ORDNER / "src/main/resources/assets/brotzeitdelight/textures"

# (Datei unterhalb von textures/, Buchstaben, Füllfarbe)
PLATZHALTER = [
    ("item/pretzel.png", "B", "#9C5524"),
]

SCHRIFTFARBE = (255, 255, 255, 255)
DURCHSICHTIG = (0, 0, 0, 0)

# Pixelschrift, 5 breit und 7 hoch.
SCHRIFT = {
    "A": (".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "B": ("####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."),
    "C": (".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."),
    "D": ("####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."),
    "E": ("#####", "#....", "#....", "####.", "#....", "#....", "#####"),
    "F": ("#####", "#....", "#....", "####.", "#....", "#....", "#...."),
    "G": (".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".###."),
    "H": ("#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"),
    "I": (".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "J": ("..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."),
    "K": ("#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"),
    "L": ("#....", "#....", "#....", "#....", "#....", "#....", "#####"),
    "M": ("#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"),
    "N": ("#...#", "##..#", "#.#.#", "#..##", "#...#", "#...#", "#...#"),
    "O": (".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "P": ("####.", "#...#", "#...#", "####.", "#....", "#....", "#...."),
    "Q": (".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"),
    "R": ("####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"),
    "S": (".####", "#....", "#....", ".###.", "....#", "....#", "####."),
    "T": ("#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."),
    "U": ("#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    "V": ("#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."),
    "W": ("#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"),
    "X": ("#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"),
    "Y": ("#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."),
    "Z": ("#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"),
    "0": (".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."),
    "1": ("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
    "2": (".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
    "3": ("####.", "....#", "....#", ".###.", "....#", "....#", "####."),
}
ZEICHEN_BREITE = 5
ZEICHEN_HOEHE = 7
ZEICHEN_ABSTAND = 1


def farbe(hex_wert):
    """Wandelt '#RRGGBB' in (R, G, B, 255)."""
    wert = hex_wert.lstrip("#")
    return tuple(int(wert[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


def dunkler(rgba, faktor=0.6):
    return tuple(int(kanal * faktor) for kanal in rgba[:3]) + (255,)


def zeichne(buchstaben, fuellfarbe):
    """Liefert das Bild als Liste von Zeilen mit je 16 Farbwerten."""
    if not 1 <= len(buchstaben) <= 2:
        raise ValueError(f"Ein Platzhalter hat ein oder zwei Zeichen, nicht: {buchstaben!r}")

    fuellung = farbe(fuellfarbe)
    rand = dunkler(fuellung)
    bild = [[DURCHSICHTIG] * GROESSE for _ in range(GROESSE)]

    # Feld von 1 bis 14, rundum 1 Pixel frei, mit dunklerem Rand.
    for y in range(1, GROESSE - 1):
        for x in range(1, GROESSE - 1):
            am_rand = x in (1, GROESSE - 2) or y in (1, GROESSE - 2)
            bild[y][x] = rand if am_rand else fuellung

    breite = len(buchstaben) * ZEICHEN_BREITE + (len(buchstaben) - 1) * ZEICHEN_ABSTAND
    start_x = (GROESSE - breite) // 2
    start_y = (GROESSE - ZEICHEN_HOEHE) // 2
    for nummer, zeichen in enumerate(buchstaben):
        muster = SCHRIFT[zeichen]
        links = start_x + nummer * (ZEICHEN_BREITE + ZEICHEN_ABSTAND)
        for zeile, punkte in enumerate(muster):
            for spalte, punkt in enumerate(punkte):
                if punkt == "#":
                    bild[start_y + zeile][links + spalte] = SCHRIFTFARBE
    return bild


def png_block(art, daten):
    return (struct.pack(">I", len(daten)) + art + daten
            + struct.pack(">I", zlib.crc32(art + daten) & 0xFFFFFFFF))


def schreibe_png(pfad, bild):
    """Schreibt ein RGBA-PNG mit 8 Bit pro Kanal."""
    roh = b"".join(b"\x00" + bytes(kanal for pixel in zeile for kanal in pixel) for zeile in bild)
    kopf = struct.pack(">IIBBBBB", GROESSE, GROESSE, 8, 6, 0, 0, 0)
    pfad.parent.mkdir(parents=True, exist_ok=True)
    pfad.write_bytes(b"\x89PNG\r\n\x1a\n" + png_block(b"IHDR", kopf)
                     + png_block(b"IDAT", zlib.compress(roh, 9)) + png_block(b"IEND", b""))


def main():
    for datei, buchstaben, fuellfarbe in PLATZHALTER:
        ziel = TEXTUR_ORDNER / datei
        schreibe_png(ziel, zeichne(buchstaben, fuellfarbe))
        print(f"Platzhalter geschrieben: {ziel.relative_to(PROJEKT_ORDNER)}")


if __name__ == "__main__":
    main()
