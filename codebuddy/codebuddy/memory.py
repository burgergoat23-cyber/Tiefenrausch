"""Projekt-Gedächtnis: Regeln aus CODEBUDDY.md und eine Übersicht der Dateien."""

from .tools import IGNORE_DIRS

RULES_FILE = "CODEBUDDY.md"
MAX_RULES = 8_000
MAX_ENTRIES = 150
MAX_DEPTH = 3


def load_rules(root):
    p = root / RULES_FILE
    if not p.is_file():
        return ""
    text = p.read_text(encoding="utf-8", errors="replace")
    return text[:MAX_RULES]


def overview(root):
    """Kurzer Dateibaum (höchstens 3 Ebenen, 150 Einträge)."""
    lines = []

    def walk(folder, depth):
        try:
            entries = sorted(folder.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except OSError:
            return
        for e in entries:
            if e.name in IGNORE_DIRS or e.name.startswith("."):
                continue
            if len(lines) >= MAX_ENTRIES:
                return
            lines.append("  " * depth + e.name + ("/" if e.is_dir() else ""))
            if e.is_dir() and depth + 1 < MAX_DEPTH:
                walk(e, depth + 1)

    walk(root, 0)
    if len(lines) >= MAX_ENTRIES:
        lines.append("… (mehr Dateien vorhanden – mit list_files ansehen)")
    return "\n".join(lines) or "(Ordner ist leer)"
