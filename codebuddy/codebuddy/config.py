"""Einstellungen in ~/.codebuddy/config.json (wird beim ersten Start angelegt)."""

import json
import os
from pathlib import Path
from urllib.parse import urlparse

DEFAULTS = {
    "modell": "qwen2.5-coder:7b",
    "temperatur": 0.2,
    "sprache": "de",
    "ollama_url": "http://127.0.0.1:11434",
    "kontext": 8192,
    "max_schritte": 20,
    "web_port": 8765,
}

LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")


def config_dir():
    return Path(os.environ.get("CODEBUDDY_HOME", Path.home() / ".codebuddy"))


def config_path():
    return config_dir() / "config.json"


def is_local_url(url):
    return urlparse(url).hostname in LOCAL_HOSTS


def load():
    path = config_path()
    cfg = dict(DEFAULTS)
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            cfg.update({k: v for k, v in data.items() if k in DEFAULTS})
        except (OSError, ValueError):
            pass  # kaputte Datei: Standardwerte nehmen
    else:
        save(cfg)
    if cfg["sprache"] not in ("de", "en"):
        cfg["sprache"] = "de"
    # Sicherheitsregel: nie Daten ins Internet – nur ein Ollama auf diesem PC.
    if not is_local_url(cfg["ollama_url"]):
        cfg["ollama_url"] = DEFAULTS["ollama_url"]
    return cfg


def save(cfg):
    path = config_path()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except OSError:
        pass
