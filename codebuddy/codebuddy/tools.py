"""Die Werkzeuge der KI. Alles bleibt im Projektordner, Änderungen nur nach „j“."""

import difflib
import re
import subprocess
from pathlib import Path

IGNORE_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", ".idea",
               ".vscode", "dist", "build", ".mypy_cache", ".pytest_cache", ".codebuddy"}
MAX_READ = 100_000
MAX_OUTPUT = 8_000
MAX_LIST = 300
MAX_HITS = 100
COMMAND_TIMEOUT = 120

# Befehle, die Dateien löschen können → extra Nachfrage.
DELETE_RE = re.compile(
    r"(^|[\s;&|(])(rm|rmdir|del|erase|rd|unlink|shred|rimraf|Remove-Item|ri|mkfs\S*|format)(\s|$)"
    r"|git\s+clean|git\s+reset\s+--hard|git\s+checkout\s+--\s|shutil\.rmtree|os\.remove|os\.unlink",
    re.IGNORECASE,
)
# Pfade, die aus dem Projektordner herausführen könnten → Hinweis.
OUTSIDE_RE = re.compile(r"\.\.|~|(^|[\s\"'=])(/|[A-Za-z]:[\\/]|\\\\)")


class ToolError(Exception):
    pass


def _spec(name, description, props, required):
    return {"type": "function", "function": {
        "name": name, "description": description,
        "parameters": {"type": "object", "properties": props, "required": required}}}


def _s(desc):
    return {"type": "string", "description": desc}


TOOL_SPECS = [
    _spec("list_files", "Zeigt den Inhalt eines Ordners im Projekt (Ordner enden mit /).",
          {"path": _s("Ordner relativ zum Projekt, z. B. '.' oder 'src'")}, []),
    _spec("read_file", "Liest eine Textdatei aus dem Projekt.",
          {"path": _s("Datei relativ zum Projekt")}, ["path"]),
    _spec("search", "Sucht Text in allen Dateien des Projekts (Groß/klein egal).",
          {"text": _s("Gesuchter Text"), "path": _s("Ordner, in dem gesucht wird (Standard '.')")},
          ["text"]),
    _spec("write_file", "Schreibt eine ganze Datei (neu oder überschreiben). Der Nutzer bestätigt vorher.",
          {"path": _s("Datei relativ zum Projekt"), "content": _s("Kompletter neuer Inhalt")},
          ["path", "content"]),
    _spec("edit_file", "Ersetzt in einer Datei genau eine Textstelle. old_text muss genau einmal vorkommen.",
          {"path": _s("Datei relativ zum Projekt"), "old_text": _s("Bisheriger Text (exakt)"),
           "new_text": _s("Neuer Text")}, ["path", "old_text", "new_text"]),
    _spec("run_command", "Führt einen Terminal-Befehl im Projektordner aus. Der Nutzer bestätigt vorher.",
          {"command": _s("Der Befehl, z. B. 'python main.py'")}, ["command"]),
]
TOOL_NAMES = [t["function"]["name"] for t in TOOL_SPECS]


def make_diff(old, new, name):
    lines = difflib.unified_diff(old.splitlines(keepends=True), new.splitlines(keepends=True),
                                 fromfile="a/" + name, tofile="b/" + name)
    out = "".join(l if l.endswith("\n") else l + "\n" for l in lines)
    return out or "(keine Änderung)\n"


class Workspace:
    """confirm(frage, details, art) -> bool; ask_text(frage) -> str (für die Lösch-Nachfrage)."""

    def __init__(self, root, confirm, ask_text, texts):
        self.root = Path(root).resolve()
        self.confirm = confirm
        self.ask_text = ask_text
        self.t = texts

    # --- Hilfen -------------------------------------------------------------
    def resolve(self, path):
        if not isinstance(path, str) or not path.strip():
            path = "."
        p = (self.root / path.strip()).resolve()
        if p != self.root and self.root not in p.parents:
            raise ToolError("Zugriff verweigert: '%s' liegt außerhalb des Projektordners." % path)
        return p

    def rel(self, p):
        r = p.relative_to(self.root).as_posix()
        return r or "."

    def _iter_files(self, start):
        for p in sorted(start.rglob("*")):
            if any(part in IGNORE_DIRS for part in p.relative_to(self.root).parts):
                continue
            if p.is_file():
                yield p

    @staticmethod
    def _read_text(p):
        data = p.read_bytes()
        if b"\0" in data[:4096]:
            raise ToolError("'%s' ist keine Textdatei." % p.name)
        return data.decode("utf-8", errors="replace")

    # --- Werkzeuge ----------------------------------------------------------
    def list_files(self, path="."):
        p = self.resolve(path)
        if not p.is_dir():
            raise ToolError("'%s' ist kein Ordner." % path)
        entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        lines = [e.name + ("/" if e.is_dir() else "") for e in entries if e.name not in IGNORE_DIRS]
        if len(lines) > MAX_LIST:
            lines = lines[:MAX_LIST] + ["… (%d weitere)" % (len(lines) - MAX_LIST)]
        return "\n".join(lines) or "(leer)"

    def read_file(self, path):
        p = self.resolve(path)
        if not p.is_file():
            raise ToolError("Datei '%s' gibt es nicht." % path)
        text = self._read_text(p)
        if len(text) > MAX_READ:
            text = text[:MAX_READ] + "\n… (gekürzt, Datei ist sehr lang)"
        return text

    def search(self, text, path="."):
        if not text:
            raise ToolError("Kein Suchtext angegeben.")
        start = self.resolve(path)
        needle = text.lower()
        hits = []
        for f in self._iter_files(start):
            if f.stat().st_size > 2_000_000:
                continue
            try:
                content = self._read_text(f)
            except ToolError:
                continue
            for n, line in enumerate(content.splitlines(), 1):
                if needle in line.lower():
                    hits.append("%s:%d: %s" % (self.rel(f), n, line.strip()[:200]))
                    if len(hits) >= MAX_HITS:
                        return "\n".join(hits) + "\n… (weitere Treffer abgeschnitten)"
        return "\n".join(hits) or "Keine Treffer."

    def write_file(self, path, content):
        p = self.resolve(path)
        if p.is_dir():
            raise ToolError("'%s' ist ein Ordner." % path)
        old = self._read_text(p) if p.exists() else ""
        diff = make_diff(old, content, self.rel(p))
        if p.exists() and old and not content.strip():
            # Datei würde geleert = so gut wie gelöscht → extra Nachfrage.
            if not self._confirm_delete(diff):
                return "Der Nutzer hat abgelehnt. Die Datei wurde NICHT geändert."
        elif not self.confirm(self.t("apply"), diff, "diff"):
            return "Der Nutzer hat abgelehnt. Die Datei wurde NICHT geändert."
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return "Gespeichert: %s" % self.rel(p)

    def edit_file(self, path, old_text, new_text):
        p = self.resolve(path)
        if not p.is_file():
            raise ToolError("Datei '%s' gibt es nicht." % path)
        old = self._read_text(p)
        count = old.count(old_text) if old_text else 0
        if count == 0:
            raise ToolError("old_text kommt in '%s' nicht vor. Lies die Datei vorher mit read_file." % path)
        if count > 1:
            raise ToolError("old_text kommt %d-mal vor. Nimm mehr umgebenden Text, damit er eindeutig ist." % count)
        new = old.replace(old_text, new_text, 1)
        if not self.confirm(self.t("apply"), make_diff(old, new, self.rel(p)), "diff"):
            return "Der Nutzer hat abgelehnt. Die Datei wurde NICHT geändert."
        p.write_text(new, encoding="utf-8")
        return "Geändert: %s" % self.rel(p)

    def _confirm_delete(self, details):
        if not self.confirm(self.t("delete_warn") + " " + self.t("run" if details.startswith("$") else "apply"),
                            details, "danger"):
            return False
        return self.ask_text(self.t("delete_confirm")).strip().lower() == self.t("delete_word")

    def run_command(self, command):
        if not command or not command.strip():
            raise ToolError("Kein Befehl angegeben.")
        details = "$ " + command
        if OUTSIDE_RE.search(command):
            details += "\n" + self.t("outside_warn")
        if DELETE_RE.search(command):
            ok = self._confirm_delete(details)
        else:
            ok = self.confirm(self.t("run"), details, "command")
        if not ok:
            return "Der Nutzer hat abgelehnt. Der Befehl wurde NICHT ausgeführt."
        try:
            r = subprocess.run(command, shell=True, cwd=str(self.root), capture_output=True,
                               text=True, errors="replace", timeout=COMMAND_TIMEOUT,
                               stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired:
            return "Abgebrochen: Der Befehl lief länger als %d Sekunden." % COMMAND_TIMEOUT
        out = (r.stdout or "") + (("\n[Fehlerausgabe]\n" + r.stderr) if r.stderr else "")
        if len(out) > MAX_OUTPUT:
            out = out[:MAX_OUTPUT // 2] + "\n… (gekürzt) …\n" + out[-MAX_OUTPUT // 2:]
        return "Exit-Code: %d\n%s" % (r.returncode, out.strip() or "(keine Ausgabe)")

    # --- Aufruf -------------------------------------------------------------
    def execute(self, name, args):
        if name not in TOOL_NAMES:
            return "FEHLER: Unbekanntes Werkzeug '%s'. Erlaubt: %s" % (name, ", ".join(TOOL_NAMES))
        if not isinstance(args, dict):
            return "FEHLER: Die Argumente müssen ein JSON-Objekt sein."
        try:
            return getattr(self, name)(**args)
        except TypeError as e:
            return "FEHLER: Falsche Argumente für %s (%s)." % (name, e)
        except ToolError as e:
            return "FEHLER: %s" % e
        except OSError as e:
            return "FEHLER: %s" % e
