#!/bin/bash
# Test des Bildklickers unter Linux (Mono). Braucht: mono-mcs, libgdiplus, Playwright.
#   sudo apt-get install -y mono-mcs mono-runtime libmono-system-windows-forms4.0-cil libmono-system-drawing4.0-cil libgdiplus
set -e
cd "$(dirname "$0")/../.."
OUT="${1:-$(mktemp -d)}"
mkdir -p "$OUT"
REFS="-r:System.dll -r:System.Drawing.dll -r:System.Windows.Forms.dll"

echo "== Übersetzen wie Windows PowerShell 5.1 (C# 5, nur System/Drawing/Forms)"
mcs -noconfig -langversion:5 -warnaserror -target:library $REFS -out:"$OUT/bk.dll" bildklicker/Bildklicker.cs

echo "== Testbilder erzeugen"
node bildklicker/test/bilder.js "$OUT/bilder" >/dev/null

echo "== Bildsuche testen"
mcs -noconfig -langversion:5 -main:TestMain -warnaserror $REFS -out:"$OUT/test.exe" bildklicker/Bildklicker.cs bildklicker/test/TestMatcher.cs
LANG=C.UTF-8 mono "$OUT/test.exe" "$OUT/bilder"

echo "== Tasten-Drücker testen"
mcs -noconfig -langversion:5 -main:TestTasten -warnaserror $REFS -out:"$OUT/tasten.exe" bildklicker/Bildklicker.cs bildklicker/test/TestTasten.cs
LANG=C.UTF-8 mono "$OUT/tasten.exe"
