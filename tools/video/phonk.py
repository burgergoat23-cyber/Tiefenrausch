#!/usr/bin/env python3
"""Eigene Musik im Phonk-Stil für Gaming-Edits (selbst erzeugt, kein fremdes Urheberrecht):
808-Bass mit Verzerrung, Cowbell-Melodie, Clap auf 2 und 4, schnelle Hi-Hats. Intro leise (nur Cowbell + Filter), dann „Drop“.
Aufruf: python3 tools/video/phonk.py <ausgabe.wav> <sekunden> [intro=2] [bpm=120]"""
import sys, wave, numpy as np
out, dur = sys.argv[1], float(sys.argv[2]); intro = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
bpm = float(sys.argv[4]) if len(sys.argv) > 4 else 120.0
SR = 48000; N = int(SR * (dur + 2)); L = np.zeros(N); R = np.zeros(N); beat = 60 / bpm; rng = np.random.default_rng(7)
f = lambda n: 440.0 * 2 ** ((n - 69) / 12)
def add(t0, s, v=1., pan=0.):
    i0 = int(t0 * SR)
    if i0 >= N: return
    s = s[:N - i0] * v; L[i0:i0 + len(s)] += s * (1 - pan); R[i0:i0 + len(s)] += s * (1 + pan)
def kick():
    t = np.arange(int(.35 * SR)) / SR; fr = 50 + 140 * np.exp(-t * 30)
    return np.tanh(3 * np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7))
def b808(n, d, glide=0):
    t = np.arange(int(d * SR)) / SR; fr = f(n) * (1 + glide * np.minimum(1, t / d)) ; ph = 2 * np.pi * np.cumsum(fr) / SR
    return np.tanh(2.8 * np.sin(ph) * np.exp(-t * 1.4)) * np.minimum(1, t / .005) * np.minimum(1, (d - t) / .02)
def clap():
    t = np.arange(int(.25 * SR)) / SR; nz = rng.standard_normal(len(t))
    env = np.exp(-t * 18) + .6 * np.exp(-np.maximum(0, t - .012) * 30) * (t > .012)
    s = np.convolve(nz, np.ones(3) / 3, 'same') * env; return s - np.convolve(s, np.ones(40) / 40, 'same')
def hat(open_=False):
    t = np.arange(int((.12 if open_ else .04) * SR)) / SR; nz = rng.standard_normal(len(t))
    hp = nz - np.convolve(nz, np.ones(6) / 6, 'same'); return hp * np.exp(-t * (25 if open_ else 90))
def cowbell(n, d=.22):
    t = np.arange(int(d * SR)) / SR; fr = f(n)
    s = np.sign(np.sin(2 * np.pi * fr * t)) * .6 + np.sign(np.sin(2 * np.pi * fr * 1.48 * t)) * .4
    s = s - np.convolve(s, np.ones(12) / 12, 'same'); return s * np.exp(-t * 11) * np.minimum(1, t / .002)
# Muster (16tel): Cowbell-Riff in e-Moll (typischer „Drift“-Phonk), Bass folgt den Grundtönen
RIFF = [76, None, 76, 79, None, 76, 74, None, 71, None, 71, 74, None, 71, 69, None]
BASS = [40, 40, 43, 38]       # E1, E1, G1, D1 je Takt
sx = beat / 4
nb = int((dur - .2) / beat)
for b in range(nb):
    t = b * beat; drop = t >= intro - 1e-6; bar = b // 4
    for s in range(4):
        st = (b % 4) * 4 + s; n = RIFF[st]
        if n: add(t + s * sx, cowbell(n), .16 if drop else .1, .2 * ((st % 3) - 1))
        if drop: add(t + s * sx, hat(st % 8 == 6), .12 if s % 2 else .2, -.3)
    if drop:
        if b % 2 == 0: add(t, kick(), .9)
        if b % 2 == 1: add(t, clap(), .55)
        if b % 4 == 0: add(t, b808(BASS[bar % 4], beat * 3.6, -.25 if bar % 4 == 3 else 0), .55)
    elif b == int(intro / beat) - 1:
        rs = np.linspace(0, 1, int(beat * SR)) ** 2 * rng.standard_normal(int(beat * SR)) * .25; add(t, rs)   # Rauschen vor dem Drop
mix = np.stack([L, R], 1)[:int(SR * dur)]
mix = np.tanh(mix * 1.4) ; mix /= max(1e-6, np.abs(mix).max()) / .85
fo = int(SR * .6); mix[-fo:] *= np.linspace(1, 0, fo)[:, None]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype('<i2').tobytes())
print('Phonk:', out, dur, 's,', bpm, 'BPM')
