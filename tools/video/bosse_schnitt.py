#!/usr/bin/env python3
"""Schneidet die Boss-Aufnahme (long.js Modus „bosse“) zusammen: je Boss bis zu 3 Niederlagen kurz (Tod + „Gefallen“),
dann der Sieg-Versuch komplett, mit Einblendung „Versuch N“. Ergebnis: <ordner>/bosse_schnitt_roh.mkv + _ereignisse.json
(danach: node tools/video/long_mix.js <ordner>/bosse_schnitt).   Aufruf: python3 tools/video/bosse_schnitt.py <ordner>"""
import json, os, subprocess, sys
D = sys.argv[1]; E = json.load(open(os.path.join(D, 'bosse_ereignisse.json'))); dur = E['dur']; ev = E['ev']
bs = [e for e in ev if e['k'] == 'ebene']; ende = next(e for e in ev if e['k'] == 'ende')
segs, nev, t = [], [], 0.0
def keep(a, b):
    global t
    a = max(0, a); b = min(dur, b)
    if b - a < .2: return
    segs.append((a, b)); t += b - a
for i, b in enumerate(bs):
    b1 = bs[i + 1]['t'] if i + 1 < len(bs) else ende['t']
    tods = [e['t'] for e in ev if e['k'] == 'tod' and b['t'] <= e['t'] < b1]
    nev.append({'t': t, 'k': 'ebene', 'fl': b['fl'], 'boss': b['boss'], 'deaths': b['deaths']})
    show = tods[-3:] if len(tods) > 3 else tods
    if not tods:
        keep(b['t'], b1)
    else:
        keep(b['t'], min(b['t'] + 3, show[0] - 1.5)) if show[0] - 1.5 > b['t'] + .5 else None   # kurzer Einstieg
        for d in show:
            nev.append({'t': t + 1.5, 'k': 'tod'}); keep(d - 1.5, d + 1.4)
        nev.append({'t': t, 'k': 'versuch', 'n': len(tods) + 1}); keep(tods[-1] + 2.0, b1)       # Sieg-Versuch
nev.append({'t': t, 'k': 'ende', 'fl': ende.get('fl', 0), 'deaths': ende.get('deaths', 0)}); keep(ende['t'], dur)
src = os.path.join(D, 'bosse_roh.mkv'); parts = []; tmp = os.path.join(D, 'schnitt'); os.makedirs(tmp, exist_ok=True)
for k, (a, b) in enumerate(segs):   # jedes Stück einzeln (wenig Speicher), danach zusammenfügen
    f = os.path.join(tmp, f'{k:03d}.mkv'); parts.append(f)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{a:.3f}', '-i', src, '-t', f'{b - a:.3f}', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
                    '-pix_fmt', 'yuv420p', '-r', '30', '-c:a', 'pcm_s16le', '-ar', '32000', '-ac', '2', f], check=True)
open(os.path.join(tmp, 'liste.txt'), 'w').write(''.join(f"file '{f}'\n" for f in parts))
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', os.path.join(tmp, 'liste.txt'), '-c', 'copy', os.path.join(D, 'bosse_schnitt_roh.mkv')], check=True)
json.dump({'dur': t, 'ev': nev}, open(os.path.join(D, 'bosse_schnitt_ereignisse.json'), 'w'), indent=1)
print('Schnitt:', round(t / 60, 1), 'min,', len(segs), 'Stücke,', sum(1 for e in ev if e['k'] == 'tod'), 'Tode insgesamt')
