#!/usr/bin/env python3
"""Baut promo/videos.html: alle YouTube-Videos zum Ansehen und Speichern (iPad: Video antippen → Teilen → „Video sichern“)."""
import os, glob
P = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'promo')
NAMEN = {'clip_kosmische_waffe': 'Clip: Kosmische Waffe', 'youtube_short': 'Short: Tiefenrausch', 'youtube_trailer': 'Trailer',
         'short_ebene1_vs_100': 'Short: Ebene 1 gegen Ebene 100', 'short_seltenheiten': 'Short: Alle Seltenheiten',
         'short_ausweichen': 'Short: Ausweichen im Boss-Hagel', 'short_truhen': 'Short: Truhen-Glück', 'short_tageslauf': 'Short: Tageslauf',
         'short_endlos_chaos': 'Short: Endlos-Chaos ab Ebene 60', 'endlos100': 'Langvideo: Endlos bis Ebene 100',
         'story_komplett': 'Langvideo: Story-Modus komplett', 'edit_traurig_16s': 'Edit: Trauriger Edit 16 s (0,5-s-Schnitte)', 'edit_traurig': 'Edit: Trauriger Edit (Musik, 1-Sekunden-Schnitte)', 'bosse': 'Langvideo: Alle Bosse',
         'edit_phonk_bosse': 'Phonk-Edit: Bosse im Takt', 'edit_phonk_speedramp': 'Phonk-Edit: Speedramp', 'edit_phonk_glowup': 'Phonk-Edit: Ebene 1 bis 100'}
def titel(f):
    b = os.path.basename(f)[:-4]
    sp = '🇬🇧 Englisch (mit KI-Stimme)' if b.endswith('_en') else '🇩🇪 Deutsch'
    if b.startswith('edit_phonk'): sp = '🔇 Ohne Musik (Trend-Sound in der App wählen)' if b.endswith('_ohne_musik') else '🎵 Mit Phonk-Musik'
    for k, v in NAMEN.items():
        if b.startswith(k): return v, sp
    return b, sp
vids = sorted(glob.glob(os.path.join(P, '*.mp4')), key=lambda f: (os.path.basename(f).startswith(('endlos100', 'story', 'bosse', 'alle_bosse', 'youtube_trailer')), f))
vids = [v for v in vids if 'video_landscape' not in v and 'video_portrait' not in v]
h = ['<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tiefenrausch – Videos</title>',
     '<style>body{margin:0;background:#140f0b;color:#f4efe6;font:17px Georgia,serif;padding:16px}h1{color:#ffd166}h2{color:#ffd98a;margin:28px 0 6px}',
     '.k{background:#221a13;border:1px solid #5a4630;border-radius:8px;padding:12px;margin:10px 0}video{width:100%;max-height:70vh;background:#000;border-radius:6px}',
     'a.b{display:inline-block;margin:8px 0;padding:12px 18px;background:#c8913f;color:#140f0b;border-radius:6px;text-decoration:none;font-weight:bold}small{color:#ab9e86}</style></head><body>',
     '<h1>🎬 Tiefenrausch – Videos</h1><div class="k"><b>So speicherst du ein Video auf dem iPad:</b><br>1. Auf „⬇ Speichern“ tippen.<br>2. Das Video öffnet sich. Unten/oben auf das Teilen-Symbol (Quadrat mit Pfeil) tippen.<br>3. „Video sichern“ wählen → es liegt in der Fotos-App.<br><b>Bilder:</b> lange auf das Bild drücken → „Zu Fotos hinzufügen“.<br><small>Titel und Beschreibungen zum Kopieren: <a style="color:#ffd166" href="https://github.com/burgergoat23-cyber/Tiefenrausch/blob/claude/tiefen-raush-code-review-jb306f/promo/youtube.md">youtube.md</a></small></div>']
h.append('<h2>🖼️ Hintergrundbilder</h2>')
for f, t in [('youtube_banner_2560x1440.jpg', 'YouTube-Kanalbanner (2560×1440)'), ('hintergrund_ipad_2048x2732.jpg', 'iPad-Hintergrund (hochkant)'), ('hintergrund_pc_1920x1080.jpg', 'PC-Hintergrund (1920×1080)'), ('youtube_thumbnail_1280x720.jpg', 'Vorschaubild für Videos (1280×720)')]:
    if os.path.exists(os.path.join(P, f)): h.append(f'<div class="k">{t}<img src="{f}" style="width:100%;border-radius:6px"><a class="b" href="{f}">⬇ Speichern</a></div>')
last = None
for v in vids:
    t, sp = titel(v); f = os.path.basename(v); mb = os.path.getsize(v) / 1e6
    if t != last: h.append(f'<h2>{t}</h2>'); last = t
    txt = f[:-4] + '_kapitel.txt'
    kap = f' · <a style="color:#ffd166" href="{txt}">Kapitel</a>' if os.path.exists(os.path.join(P, txt)) else ''
    h.append(f'<div class="k">{sp} <small>({mb:.0f} MB)</small><video src="{f}" controls playsinline preload="metadata"></video><a class="b" href="{f}">⬇ Speichern</a>{kap}</div>')
h.append('</body></html>')
open(os.path.join(P, 'videos.html'), 'w', encoding='utf-8').write('\n'.join(h))
print('promo/videos.html:', len(vids), 'Videos')
