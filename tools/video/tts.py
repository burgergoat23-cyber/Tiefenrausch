#!/usr/bin/env python3
"""KI-Sprecher für die Videos: Piper-TTS mit der freien Stimme en_US-joe-medium (CC0, npm-Paket vowel-lab-voices-float).
Aufruf: python3 tools/video/tts.py <de|en> <zielordner> <zeilen.json>  → <ziel>/vo_<i>.wav, gibt Längen (s) als JSON aus.
Deutsch: dieselbe Stimme mit deutscher Aussprache (espeak 'de') – hat einen leichten englischen Akzent.
Einmalig nötig: pip install piper-tts  (Stimme lädt das Skript selbst über npm nach tools/video/voice/)."""
import json, os, subprocess, sys, wave, tarfile, glob
HERE = os.path.dirname(os.path.abspath(__file__)); VD = os.path.join(HERE, 'voice')
lang, out, lines = sys.argv[1], sys.argv[2], json.load(open(sys.argv[3], encoding='utf-8'))
os.makedirs(VD, exist_ok=True); os.makedirs(out, exist_ok=True)
model = os.path.join(VD, 'joe.onnx')
if not os.path.exists(model):
    subprocess.run(['npm', 'pack', 'vowel-lab-voices-float', '--silent'], cwd=VD, check=True)
    tgz = glob.glob(os.path.join(VD, 'vowel-lab-voices-float-*.tgz'))[0]
    with tarfile.open(tgz) as t:
        f = t.extractfile('package/float.onnx'); open(model, 'wb').write(f.read())
    os.remove(tgz)
from piper.phoneme_ids import DEFAULT_PHONEME_ID_MAP
from piper import PiperVoice, SynthesisConfig
cfg = os.path.join(VD, 'joe_%s.onnx.json' % lang)
json.dump({"audio": {"sample_rate": 22050, "quality": "medium"}, "espeak": {"voice": 'de' if lang == 'de' else 'en-us'},
           "inference": {"noise_scale": 0.667, "length_scale": 1, "noise_w": 0.8}, "phoneme_type": "espeak", "phoneme_map": {},
           "phoneme_id_map": DEFAULT_PHONEME_ID_MAP, "num_symbols": 256, "num_speakers": 1, "speaker_id_map": {},
           "piper_version": "1.0.0", "language": {"code": 'de_DE' if lang == 'de' else 'en_US'}}, open(cfg, 'w'))
v = PiperVoice.load(model, config_path=cfg)
sc = SynthesisConfig(length_scale=0.93 if lang == 'en' else 0.97, noise_scale=0.6, noise_w_scale=0.75)
durs = []
for i, txt in enumerate(lines):
    p = os.path.join(out, 'vo_%d.wav' % i)
    if not txt:
        durs.append(0); continue
    with wave.open(p, 'wb') as w:
        v.synthesize_wav(txt, w, syn_config=sc)
    with wave.open(p) as w:
        durs.append(w.getnframes() / w.getframerate())
print(json.dumps(durs))
