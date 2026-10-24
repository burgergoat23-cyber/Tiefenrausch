#!/usr/bin/env bash
# Veröffentlicht den gebauten Stand unter https://burgergoat23-cyber.github.io/Tiefenrausch/klangraum/
# Nutzung (aus dem Ordner klangraum/):  bash tools/publish.sh /pfad/zu/einem/leeren/arbeitsordner
# Nur mit Erlaubnis des Nutzers! Das Spiel (index.html im Pages-Branch) wird nicht angefasst.
set -euo pipefail
PAGES_BRANCH=claude/tiefen-raush-code-review-jb306f
WORK=${1:?Arbeitsordner angeben}
APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
REPO=$(cd "$APP_DIR/.." && pwd)
COMMIT=$(git -C "$REPO" rev-parse --short HEAD)

if [ -e "$APP_DIR/.env" ]; then echo "Abbruch: .env vorhanden – Schlüssel kämen in den Build." >&2; exit 1; fi
(cd "$APP_DIR" && npm run build >/dev/null)
if grep -rqE "AIza[0-9A-Za-z_-]{20,}" "$APP_DIR/dist"; then echo "Abbruch: Schlüssel im Build gefunden." >&2; exit 1; fi

git -C "$REPO" fetch -q origin "$PAGES_BRANCH"
git -C "$REPO" worktree add -q -B "$PAGES_BRANCH" "$WORK" "origin/$PAGES_BRANCH"
rm -rf "$WORK/klangraum"
mkdir -p "$WORK/klangraum"
cp -r "$APP_DIR/dist/." "$WORK/klangraum/"
git -C "$WORK" add -A klangraum
if git -C "$WORK" diff --cached --quiet; then
  echo "Nichts Neues zu veröffentlichen."
else
  git -C "$WORK" commit -q -m "Klangraum veröffentlicht (Stand $COMMIT)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01E423qHVZ2AA6dtCKwqQEs5"
  for i in 1 2 3 4; do git -C "$WORK" push -q -u origin "$PAGES_BRANCH" && break; sleep $((2 ** i)); done
  echo "Hochgeladen – in etwa 2 Minuten live."
fi
git -C "$REPO" worktree remove --force "$WORK"
