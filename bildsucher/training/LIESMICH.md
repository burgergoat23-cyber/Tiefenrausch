# Truhen-Modell neu trainieren

Die Truhen-Bilder des Nutzers liegen **nicht** im Repo (Pfad `IMG` oben in `daten.py` anpassen,
Dateien `1.png` … `6.png`). Benötigt: Python mit `torch`, `onnx`, `onnxruntime`, `opencv-python`.

1. `python daten.py train 8000 21 train3.npz` und `python daten.py test 300 22 test3.npz`
   (künstliche Bilder 320×320: Truhen-Bilder verzerrt, umgefärbt, halb sichtbar, verdeckt,
   auf Hintergründen aus `promo/*.mp4`; Merkmale vom 8-Bit-Netz `form_modell.onnx`).
2. `TR=train3.npz TE=test3.npz OUT=kopf.pt python lernen.py 16` (kleiner Kopf: 3×3-Conv 256→128→64, 1×1 → Truhe/Breite/Höhe; CenterNet-artiger Verlust).
3. `python export.py kopf.pt ../truhe_modell.onnx` (Netz + Kopf in einer Datei).
4. Fehlalarme sammeln: `python minen.py` → `schwer.pkl`; danach 1.–3. wiederholen (daten.py nimmt `schwer.pkl` automatisch als schwierige Gegenbeispiele).

Lernbilder aus dem echten Spiel (Taste F8 im Bildsucher, Ordner `lernbilder/`) können als
weitere Hintergründe/Gegenbeispiele bzw. – mit ausgeschnittenen Truhen – als weitere Truhen-Ansichten dienen.
