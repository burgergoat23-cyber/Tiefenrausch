#!/usr/bin/env python3
"""Erzeugt die leere Struktur für die Spieltests (GameTests).

Jeder Spieltest braucht eine Struktur, in der er läuft. Unsere Tests prüfen nur
Rezepte, Werte und Daten und brauchen keine Blöcke. Diese Datei ist deshalb eine
leere Struktur von 1×1×1 Blöcken.

Aufruf (im Projektordner):  python3 tools/strukturen/leere_teststruktur.py
"""

import gzip
import struct
from pathlib import Path

ZIEL = Path(__file__).resolve().parents[2] / "src/main/resources/data/brotzeitdelight/structure/empty.nbt"
# Datenversion von Minecraft 1.21.1
DATENVERSION = 3955

TAG_END, TAG_INT, TAG_LIST, TAG_COMPOUND = 0, 3, 9, 10


def name(text):
    roh = text.encode("utf-8")
    return struct.pack(">H", len(roh)) + roh


def int_feld(feld, wert):
    return bytes([TAG_INT]) + name(feld) + struct.pack(">i", wert)


def leere_liste(feld):
    return bytes([TAG_LIST]) + name(feld) + bytes([TAG_END]) + struct.pack(">i", 0)


def int_liste(feld, werte):
    return (bytes([TAG_LIST]) + name(feld) + bytes([TAG_INT]) + struct.pack(">i", len(werte))
            + b"".join(struct.pack(">i", w) for w in werte))


def main():
    inhalt = (int_feld("DataVersion", DATENVERSION) + int_liste("size", [1, 1, 1])
              + leere_liste("palette") + leere_liste("blocks") + leere_liste("entities"))
    daten = bytes([TAG_COMPOUND]) + name("") + inhalt + bytes([TAG_END])
    ZIEL.parent.mkdir(parents=True, exist_ok=True)
    # mtime=0, damit die Datei bei jedem Lauf gleich ist
    ZIEL.write_bytes(gzip.compress(daten, mtime=0))
    print(f"Geschrieben: {ZIEL}")


if __name__ == "__main__":
    main()
