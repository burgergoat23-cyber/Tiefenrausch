#!/bin/bash
# Baut downloads/minecraft-bot.zip: Bot + alle Bausteine (node_modules), damit auf dem PC
# nur Node.js nötig ist und kein "npm install". Aufruf: bash minecraft-bot/packen.sh
set -e
HIER="$(cd "$(dirname "$0")" && pwd)"
ZIEL="$HIER/../downloads/minecraft-bot.zip"
TMP="$(mktemp -d)"
B="$TMP/minecraft-bot"
mkdir -p "$B"
cp "$HIER"/{bot.js,namen.js,einstellungen.json,start.bat,ANLEITUNG.md,package.json,package-lock.json} "$B/"
(cd "$B" && npm ci --omit=dev --no-audit --no-fund >/dev/null)
NM="$B/node_modules"
# Nicht gebraucht: Bedrock-Daten (bis auf "common"), TypeScript, alte Kopien, Doku, Tests
D="$NM/minecraft-data/minecraft-data/data/bedrock"
find "$D" -mindepth 1 -maxdepth 1 ! -name common -exec rm -rf {} +
rm -rf "$NM/typescript" "$NM/mineflayer-utils/node_modules" "$NM/.bin" "$NM/.package-lock.json"
find "$NM" -type d \( -name docs -o -name examples -o -name example -o -name test -o -name tests -o -name .github \) -prune -exec rm -rf {} +
find "$NM" -type f \( -name "*.d.ts" -o -name "*.map" -o -name "*.md" -o -name "*.ts" -o -name "*.yml" -o -name "*.yaml" \) ! -name "proto.yml" -delete
rm -f "$ZIEL"
(cd "$TMP" && python3 -c "
import zipfile, os
with zipfile.ZipFile('$ZIEL', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for d, _, fs in os.walk('minecraft-bot'):
        for f in sorted(fs):
            z.write(os.path.join(d, f))
")
rm -rf "$TMP"
ls -la "$ZIEL"
