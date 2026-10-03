#!/usr/bin/env bash
# Bringt den Ton eines fertigen Videos auf ~-14 LUFS (YouTube), Bild bleibt unverändert.  Aufruf: bash tools/video/laut.sh datei.mp4
f="$1"; I=$(ffmpeg -hide_banner -nostats -i "$f" -af ebur128=framelog=quiet -f null - 2>&1 | sed -n '/Summary/,$p' | grep -m1 -oE 'I:\s+-?[0-9.]+' | grep -oE '\-?[0-9.]+')
G=$(python3 -c "print(max(0,min(24,-14-($I))))"); echo "$f: $I LUFS -> +$G dB"
ffmpeg -y -loglevel error -i "$f" -c:v copy -af "volume=${G}dB,alimiter=limit=0.89:level=false" -c:a aac -b:a 192k -movflags +faststart "${f%.mp4}.tmp.mp4" && mv "${f%.mp4}.tmp.mp4" "$f"
