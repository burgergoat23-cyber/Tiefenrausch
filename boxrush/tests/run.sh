#!/usr/bin/env bash
# BOXRUSH-Tests (Playwright mit Chromium). Aufruf aus dem Repo: bash boxrush/tests/run.sh
set -u; cd "$(dirname "$0")"; export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
echo "== Regeln (Edit-Formen, Kollision, Sicht, Bauen)"; node regeln.js
echo "== Edit-Peek-Zeit (echte Tastatur/Maus)"; node editpeek.js
echo "== Oberfläche (Menüs, Pause, Touch, Training)"; node oberflaeche.js
for lv in easy medium hard pro; do echo "== Bot-Match duel $lv"; node bots.js duel $lv | grep -E '"R|maxStill|ERRORS'; done
