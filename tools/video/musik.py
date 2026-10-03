#!/usr/bin/env python3
"""Eigene traurige Musik für Edits (Klavier + Streicher-Fläche, a-Moll, 60 BPM → jede Sekunde ein Schlag = ein Schnitt).
Selbst erzeugt, kein fremdes Urheberrecht.   Aufruf: python3 tools/video/musik.py <ausgabe.wav> <sekunden> [intro=3]"""
import sys, wave, numpy as np
out, dur = sys.argv[1], float(sys.argv[2]); intro = float(sys.argv[3]) if len(sys.argv) > 3 else 3.0
SR = 48000; N = int(SR * (dur + 3)); L = np.zeros(N); R = np.zeros(N)
f = lambda n: 440.0 * 2 ** ((n - 69) / 12)          # MIDI → Hz
def piano(t0, n, v=.3, d=2.6, pan=0.):
    i0 = int(t0 * SR); m = min(N - i0, int(d * SR))
    if m <= 0: return
    t = np.arange(m) / SR; fr = f(n); s = np.zeros(m)
    for k, a in enumerate([1, .55, .32, .18, .1, .06], 1):          # Obertöne, höhere klingen schneller ab
        s += a * np.sin(2 * np.pi * fr * k * t * (1 + .0004 * k)) * np.exp(-t * (1.6 + k * .9))
    s *= np.minimum(1, t / .004) * v
    L[i0:i0 + m] += s * (1 - pan) ; R[i0:i0 + m] += s * (1 + pan)
def pad(t0, notes, d, v=.05):
    i0 = int(t0 * SR); m = min(N - i0, int(d * SR))
    if m <= 0: return
    t = np.arange(m) / SR; s = np.zeros(m)
    for n in notes:
        for det in (-.003, .003):
            ph = 2 * np.pi * f(n) * (1 + det) * t
            s += (np.sin(ph) + .3 * np.sin(2 * ph) + .12 * np.sin(3 * ph))
    env = np.minimum(1, t / 1.2) * np.minimum(1, (d - t) / 1.2)
    s *= env * v / len(notes)
    L[i0:i0 + m] += s ; R[i0:i0 + m] += s
# Akkorde (je 4 Schläge): Am – F – C – G, Bass + Mittellage
CH = [(45, [57, 60, 64]), (41, [57, 60, 65]), (48, [55, 60, 64]), (43, [55, 59, 62])]
MEL = [76, 74, 72, 71, 72, 69, 71, 67, 69, 72, 74, 76, 74, 72, 71, 69]   # traurige Melodie (wiederholt)
t = 0.0
pad(0, [57, 60, 64], intro + .5, .06); piano(.4, 69, .18, 3.5); piano(1.6, 64, .14, 3); piano(intro - .6, 72, .16, 3)   # Intro: leise
beat = 0; t = intro
while t < dur - 3.5:
    b, ns = CH[(beat // 4) % 4]
    if beat % 4 == 0:
        piano(t, b, .34, 4.2, -.2); pad(t, ns, 4.2)
    piano(t + .02, ns[beat % 3], .16, 1.8, .15)
    if beat >= 4: piano(t + .5 * (beat % 2), MEL[(beat - 4) % len(MEL)], .2 if beat % 2 == 0 else .13, 2.2, .25)
    beat += 1; t += 1.0
# Schluss: Am lange ausklingen lassen
piano(t, 45, .32, 5); piano(t + .05, 57, .2, 5); piano(t + .1, 60, .18, 5); piano(t + .15, 64, .18, 5); piano(t + .8, 69, .16, 5); pad(t, [57, 60, 64], 4.5, .06)
# Hall: einfache Kammfilter + Allpass (Schroeder)
def reverb(x):
    y = np.zeros_like(x)
    for dl, g in ((1557, .78), (1617, .77), (1491, .79), (1422, .8)):
        d = int(dl * SR / 44100); buf = x.copy()
        for i in range(d, len(buf), d): buf[i:i + d] += g * buf[i - d:i][:len(buf[i:i + d])]
        y += buf
    return y / 4
wet = .35; L = L * (1 - wet) + reverb(L) * wet; R = R * (1 - wet) + reverb(np.roll(R, 37)) * wet
m = max(np.abs(L).max(), np.abs(R).max()) or 1; L /= m / .8; R /= m / .8
n = int(SR * dur); st = np.stack([L[:n], R[:n]], 1)
fade = int(SR * 3); st[-fade:] *= np.linspace(1, 0, fade)[:, None]; st[:int(SR * .8)] *= np.linspace(0, 1, int(SR * .8))[:, None]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((st * 32767).astype('<i2').tobytes())
print('Musik:', out, dur, 's')
