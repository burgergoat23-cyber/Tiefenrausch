#!/usr/bin/env python3
"""Baut den Bildklicker: bildklicker/Bildklicker.bat und downloads/bildklicker.zip.

Die .bat ist zugleich Batch- und PowerShell-Datei: cmd führt nur die ersten Zeilen aus
(sie starten PowerShell mit derselben Datei), PowerShell hält diese Zeilen für einen
Kommentar <# ... #> und führt den Rest aus. Der C#-Code wird beim Start übersetzt.
"""
import os
import zipfile

HIER = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HIER)

# Batch-Teil: nur ASCII, keine BOM (sonst versteht cmd die erste Zeile nicht)
KOPF = """<# : Bildklicker - zum Starten doppelt anklicken
@echo off
setlocal
set "BK_DATEI=%~f0"
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -Command "Invoke-Expression ([IO.File]::ReadAllText($env:BK_DATEI, [Text.Encoding]::UTF8))"
if errorlevel 1 pause
exit /b
#>
"""


def lies(name):
    with open(os.path.join(HIER, name), encoding='utf-8') as f:
        return f.read().replace('\r\n', '\n')


def crlf(text):
    return text.replace('\r\n', '\n').replace('\n', '\r\n')


def main():
    cs = lies('Bildklicker.cs').rstrip('\n')
    huelle = lies('huelle.ps1')
    assert KOPF.isascii()
    assert huelle.count('__CSHARP__') == 1
    # Im PowerShell-Textblock @' ... '@ darf keine Zeile mit '@ beginnen
    assert not any(z.startswith("'@") for z in cs.split('\n')), "C#-Zeile beginnt mit '@"
    assert '﻿' not in cs

    bat = crlf(KOPF + huelle.replace('__CSHARP__', cs))
    daten = bat.encode('utf-8')        # UTF-8 ohne BOM
    assert not daten.startswith(b'\xef\xbb\xbf')

    # Gegenprobe: der eingebettete C#-Code ist genau die Quelle
    innen = bat.split("$code = @'\r\n", 1)[1].split("\r\n'@", 1)[0]
    assert innen == crlf(cs), 'eingebetteter Code weicht ab'

    ziel = os.path.join(HIER, 'Bildklicker.bat')
    with open(ziel, 'wb') as f:
        f.write(daten)

    anleitung = b'\xef\xbb\xbf' + crlf(lies('Anleitung.txt')).encode('utf-8')
    os.makedirs(os.path.join(REPO, 'downloads'), exist_ok=True)
    zipname = os.path.join(REPO, 'downloads', 'bildklicker.zip')
    with zipfile.ZipFile(zipname, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('Bildklicker/Bildklicker.bat', daten)
        z.writestr('Bildklicker/Anleitung.txt', anleitung)
    print('gebaut:', os.path.relpath(ziel, REPO), len(daten), 'Bytes')
    print('gebaut:', os.path.relpath(zipname, REPO), os.path.getsize(zipname), 'Bytes')


if __name__ == '__main__':
    main()
