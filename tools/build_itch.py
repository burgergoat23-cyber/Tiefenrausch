#!/usr/bin/env python3
"""Baut die ZIP für itch.io: nur index.html (Art: HTML, „This file will be played in the browser“).
Aufruf:  python3 tools/build_itch.py [Zielordner]   ->  <Ziel>/tiefenrausch_itch.zip  (Standard: downloads/)
Die ZIP liegt danach auch online: https://burgergoat23-cyber.github.io/Tiefenrausch/downloads/tiefenrausch_itch.zip"""
import os, sys, zipfile
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'downloads')
os.makedirs(out, exist_ok=True)
z = os.path.join(out, 'tiefenrausch_itch.zip')
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    f.write(os.path.join(root, 'index.html'), 'index.html')
print('fertig:', z, '|', os.path.getsize(z) // 1024, 'KB')
