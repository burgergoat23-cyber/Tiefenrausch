"""Baut downloads/spiel_ki.zip (Spiel-KI für Windows) aus dem Ordner spiel_ki/.

Aufruf: python3 tools/build_spiel_ki.py
Ohne Testprogramme, ohne gelernte Spiele und ohne heruntergeladene Werkzeuge.
"""
import os
import zipfile

HIER = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QUELLE = os.path.join(HIER, 'spiel_ki')
ZIEL = os.path.join(HIER, 'downloads', 'spiel_ki.zip')
DATEIEN = ['START.bat', 'ANLEITUNG.md', 'spiel_ki.py', 'ki_kern.py', 'ki_windows.py']

os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
with zipfile.ZipFile(ZIEL, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in DATEIEN:
        z.write(os.path.join(QUELLE, name), f'spiel_ki/{name}')
print(ZIEL, os.path.getsize(ZIEL) // 1024, 'KB')
