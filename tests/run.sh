#!/usr/bin/env bash
# Tiefenrausch-Tests. Aufruf aus dem Repo:  bash tests/run.sh          (Spiel-Tests)
#                                          bash tests/run.sh --firebase (zusätzlich Konten + Koop mit Emulator)
# Voraussetzung: Node 18+, Playwright mit Chromium (npm i -g playwright oder vorinstalliert).
set -u; cd "$(dirname "$0")"
cp ../index.html cur.html
for t in feat mon vill_t dpr best3 lade crazy teilen; do echo "== $t"; timeout 400 node $t.js 2>&1 | tail -4; done
echo "== fuzz (Zufallsspiel, 4 Bildschirmgrößen)"; timeout 600 node fuzz.js 2>&1 | grep ERR | grep -v "guest click" || echo "keine Fehler"
echo "== deep (Story bis Ende, Endlos/Tageslauf tief)"; timeout 600 node deep.js 2>&1 | tail -4
if [ "${1:-}" = "--firebase" ]; then
  cd fb; [ -d node_modules ] || npm i --silent; cp ../../firestore.rules .
  (npx firebase emulators:start --project tiefenrausch > emu.log 2>&1 &)
  for i in $(seq 1 60); do grep -q "All emulators ready" emu.log && break; sleep 2; done
  for t in e2e coop_t gast_t; do curl -s -X DELETE "http://127.0.0.1:8080/emulator/v1/projects/tiefenrausch/databases/(default)/documents" >/dev/null
    curl -s -X DELETE http://127.0.0.1:9099/emulator/v1/projects/tiefenrausch/accounts >/dev/null; echo "== $t"; timeout 400 node $t.js 2>&1 | grep -E "FAIL|BESTANDEN|FEHLGESCHLAGEN|JS-Fehler"; done
  pkill -f "emulators:start" 2>/dev/null; pkill -f "cloud-firestore-emulator" 2>/dev/null   # Emulator beenden (sonst alte Daten beim nächsten Lauf)
  cd ..; echo "== upd (Update-Hinweis)"; timeout 200 node upd.js 2>&1 | tail -2
fi
