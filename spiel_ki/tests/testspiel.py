"""Kleines Testspiel + Schein-Bildschirm, damit man die KI ohne Windows prüfen kann.

Läufer: über Blöcke springen (Leertaste), unter Stangen ducken (Pfeil runter halten).
Bei Zusammenstoß friert das Bild mit "GAME OVER" ein; Leertaste startet neu
(erst nach 0,75 s, wie beim Dino-Spiel in Chrome).
"""
import random

from PIL import Image, ImageDraw

LEER, RUNTER = 0x20, 0x28
W, H, BODEN = 240, 160, 130


class Laeufer:
    def __init__(self, seed=0):
        self.rnd = random.Random(seed)
        self.vorher = set()
        self.neu()
        self.runden = []     # überstandene Hindernisse je Runde

    def neu(self):
        self.y, self.vy, self.t, self.punkte = 0.0, 0.0, 0, 0
        self.hin = []
        self.naechstes = 120
        self.vorbei = False
        self.bild = None

    def tick(self, tasten):
        neu_gedrueckt = tasten - self.vorher
        self.vorher = set(tasten)
        if self.vorbei:
            self.sperre -= 1           # wie im Dino-Spiel: kurz nach Game Over kein Neustart
            if LEER in neu_gedrueckt and self.sperre <= 0:
                self.runden.append(self.punkte)
                self.neu()
            return
        self.t += 1
        v = min(7.0, 4.0 + self.t * 0.002)
        am_boden = self.y <= 0
        self.duckt = RUNTER in tasten and am_boden
        if LEER in tasten and am_boden and not self.duckt:
            self.vy = 8.5
        self.vy -= 0.9
        self.y = max(0.0, self.y + self.vy)
        if self.y == 0:
            self.vy = 0.0
        for h in self.hin:
            h['x'] -= v
        vorher = len(self.hin)
        self.hin = [h for h in self.hin if h['x'] + h['w'] > 0]
        self.punkte += vorher - len(self.hin)
        self.naechstes -= v
        if self.naechstes <= 0:
            if self.rnd.random() < 0.65:
                self.hin.append({'x': W, 'w': self.rnd.randint(12, 22), 'art': 'block',
                                 'h': self.rnd.randint(18, 24)})
            else:
                self.hin.append({'x': W, 'w': 30, 'art': 'stange'})
            self.naechstes = self.rnd.randint(110, 200)
        # Zusammenstoß
        hoehe = 12 if self.duckt else 26
        px0, px1 = 40, 54
        py1 = BODEN - self.y           # Füße
        py0 = py1 - hoehe              # Kopf
        for h in self.hin:
            if h['x'] < px1 and h['x'] + h['w'] > px0:
                if h['art'] == 'block':
                    oy0, oy1 = BODEN - h['h'], BODEN
                else:
                    oy0, oy1 = BODEN - 26, BODEN - 16
                if py0 < oy1 and py1 > oy0:
                    self.vorbei = True
                    self.sperre = 15

    def zeichnen(self):
        if self.vorbei and self.bild is not None:
            return self.bild
        img = Image.new('RGB', (W, H), (150, 200, 240))
        d = ImageDraw.Draw(img)
        for i in range(3):   # Wolken (bewegen sich langsam)
            x = (i * 97 - self.t * 0.5) % (W + 40) - 40
            d.ellipse([x, 20 + i * 15, x + 40, 34 + i * 15], fill=(240, 245, 250))
        d.rectangle([0, BODEN, W, H], fill=(120, 90, 60))
        for i in range(12):   # Bodenstriche (laufen mit)
            x = (i * 23 - self.t * 4) % W
            d.line([x, BODEN + 8, x + 6, BODEN + 8], fill=(90, 65, 40), width=2)
        for h in self.hin:
            if h['art'] == 'block':
                d.rectangle([h['x'], BODEN - h['h'], h['x'] + h['w'], BODEN], fill=(200, 40, 40))
            else:
                d.rectangle([h['x'], BODEN - 26, h['x'] + h['w'], BODEN - 16], fill=(130, 40, 170))
        hoehe = 12 if getattr(self, 'duckt', False) else 26
        py1 = BODEN - self.y
        d.rectangle([40, py1 - hoehe, 54, py1], fill=(30, 160, 60))
        d.text((W - 40, 6), f'{self.punkte:04d}', fill=(20, 20, 20))
        if self.vorbei:
            d.rectangle([60, 55, 180, 85], fill=(30, 30, 30))
            d.text((88, 64), 'GAME OVER', fill=(255, 255, 255))
            self.bild = img
        return img


class ScheinBackend:
    """Tut so, als wäre es der Windows-Bildschirm: jedes bild() = ein Spieltakt."""

    def __init__(self, spiel):
        self.spiel = spiel
        self.tasten = set()
        self.neu = set()     # kurz gedrückt seit dem letzten Takt (wie Tasten-Ereignisse im Spiel)

    def vorne(self):
        return 1

    def bild(self, bereich):
        self.spiel.tick(self.tasten | self.neu)
        self.neu = set()
        return self.spiel.zeichnen()

    def taste(self, vk, unten, scan=None):
        if unten:
            self.tasten.add(vk)
            self.neu.add(vk)
        else:
            self.tasten.discard(vk)

    def maus_setzen(self, x, y):
        pass

    def rad(self, richtung):
        pass

    def ist_eigenes(self, hwnd):
        return False

    def nach_vorne(self, hwnd):
        pass

    def maus_bewegen(self, dx, dy):
        pass

    def maus_pos(self):
        return (0, 0)
