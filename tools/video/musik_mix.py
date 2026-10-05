#!/usr/bin/env python3
"""Legt Musik (z. B. KI-Musik von vidIQ „Generate Music“, lizenzfrei) unter ein Edit, das ohne Musik aufgenommen wurde.
Aufruf:  python3 tools/video/musik_mix.py <video_ohne_musik.mp4> <musik.wav> <ab_sekunde> <ziel.mp4> [spiel_dB]
- Musik ab <ab_sekunde> (Takt-Stelle aus dem Plan, „M0“), so lang wie das Video; kurz ein-, am Ende sanft ausgeblendet
- Spielgeräusche (Stimmen, Schritte, Türen) leise darunter: Standard 11 dB unter der Musik
- Gesamt etwa -14 LUFS (übliche Lautheit bei YouTube/TikTok), Begrenzer gegen Übersteuern; das Bild wird nur kopiert"""
import re, subprocess, sys

def lufs(args):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', *args, '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'],
                       capture_output=True, text=True).stderr
    m = re.search(r'I:\s+(-?[\d.]+) LUFS', o.split('Summary')[-1])
    return float(m.group(1)) if m else -70.0

def dauer(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())

def mische(vid, mus, ab, out, rel, extra=0.0):
    T = dauer(vid)
    lm, lg = lufs(['-ss', f'{ab:.3f}', '-t', f'{T:.3f}', '-i', mus]), lufs(['-i', vid])
    gm = -14 - lm + extra
    gg = max(-40.0, min(20.0, -14 + rel - lg + extra)) if lg > -69 else -60.0
    fc = (f'[1:a]aresample=48000,aformat=channel_layouts=stereo,volume={gm:.1f}dB,afade=t=in:d=0.08,afade=t=out:st={T - 0.9:.2f}:d=0.9[m];'
          f'[0:a]aresample=48000,aformat=channel_layouts=stereo,volume={gg:.1f}dB[g];'
          '[m][g]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89:level=false[a]')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', vid, '-ss', f'{ab:.3f}', '-t', f'{T:.3f}', '-i', mus,
                    '-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', '-shortest', out], check=True)
    return lufs(['-i', out])

if __name__ == '__main__':
    vid, mus, ab, out = sys.argv[1:5]
    rel = float(sys.argv[5]) if len(sys.argv) > 5 else -11.0
    l = mische(vid, mus, float(ab), out, rel)
    if l < -15.5:   # Begrenzer hat zu viel weggenommen → einmal lauter nachmischen
        l = mische(vid, mus, float(ab), out, rel, extra=min(6.0, -14 - l))
    print('fertig:', out, f'{l:.1f} LUFS')
