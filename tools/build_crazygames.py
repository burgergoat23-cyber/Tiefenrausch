#!/usr/bin/env python3
"""Baut die CrazyGames-Version: index.html + CrazyGames-SDK, ohne eigene Anmeldung (window.TR_CG).
Aufruf:  python3 tools/build_crazygames.py [Zielordner]   ->  <Ziel>/index.html und <Ziel>/tiefenrausch_crazygames.zip"""
import os, sys, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'dist', 'crazygames')
s = open(os.path.join(root, 'index.html'), encoding='utf-8').read()
anchor = '\n<script>\nconst cv='
assert s.count(anchor) == 1, 'Anker fuer das Spielskript nicht gefunden'
inject = ('\n<script>window.TR_CG=1;</script>'
          '\n<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>')
s = s.replace(anchor, inject + anchor)
os.makedirs(out, exist_ok=True)
html = os.path.join(out, 'index.html')
open(html, 'w', encoding='utf-8').write(s)
z = os.path.join(out, 'tiefenrausch_crazygames.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    f.write(html, 'index.html')
print('fertig:', html, '|', z, '|', os.path.getsize(z) // 1024, 'KB')
