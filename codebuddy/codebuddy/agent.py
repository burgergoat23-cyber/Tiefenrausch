"""Die Agent-Schleife: Modell fragen → Werkzeug nutzen → Ergebnis zurückgeben → weiter."""

import json
import re

from . import memory
from .ollama_client import ToolsNotSupported
from .tools import TOOL_NAMES, TOOL_SPECS

KEEP_RECENT = 6          # so viele neueste Nachrichten bleiben beim Zusammenfassen erhalten
CHARS_PER_TOKEN = 3      # grobe, vorsichtige Schätzung
RESULT_PREFIX = "[Ergebnis von "

PROMPT = {
    "de": """Du bist CodeBuddy, ein hilfsbereiter Programmier-Assistent. Du läufst lokal auf dem PC des Nutzers.
Der Nutzer ist kein Profi: Erkläre einfach und kurz, auf Deutsch.
Du arbeitest im Projektordner und kannst Werkzeuge benutzen: list_files, read_file, search, write_file, edit_file, run_command.
Regeln:
- Lies Dateien, bevor du sie änderst. Für kleine Änderungen nimm edit_file, für neue Dateien write_file.
- Pfade immer relativ zum Projektordner. Nie außerhalb arbeiten.
- Lösche nichts, außer der Nutzer will es ausdrücklich.
- Der Nutzer bestätigt jede Änderung und jeden Befehl. Wenn er ablehnt, frag nach, was er stattdessen möchte.
- Arbeite Schritt für Schritt. Wenn die Aufgabe erledigt ist, sag kurz, was du gemacht hast.""",
    "en": """You are CodeBuddy, a helpful programming assistant running locally on the user's PC.
The user is not a professional: explain things simply and briefly, in English.
You work inside the project folder and can use tools: list_files, read_file, search, write_file, edit_file, run_command.
Rules:
- Read files before changing them. Use edit_file for small changes, write_file for new files.
- Paths are always relative to the project folder. Never work outside of it.
- Never delete anything unless the user explicitly wants it.
- The user confirms every change and every command. If they decline, ask what they want instead.
- Work step by step. When the task is done, briefly say what you did.""",
}

TEXT_FORMAT = """
WERKZEUG-FORMAT: Um ein Werkzeug zu benutzen, schreibe genau so (ein Aufruf pro Block):
<tool>{"name": "read_file", "args": {"path": "main.py"}}</tool>
Danach STOPP – warte auf das Ergebnis, es kommt in der nächsten Nachricht.
Verfügbare Werkzeuge:
%s"""


def tool_list_text():
    lines = []
    for spec in TOOL_SPECS:
        f = spec["function"]
        args = ", ".join(f["parameters"]["properties"])
        lines.append("- %s(%s): %s" % (f["name"], args, f["description"]))
    return "\n".join(lines)


class ToolTagFilter:
    """Versteckt <tool>…</tool>-Blöcke beim Streamen, damit der Nutzer nur Text sieht."""
    OPEN, CLOSE = "<tool>", "</tool>"

    def __init__(self):
        self.buf, self.inside = "", False

    def feed(self, text):
        self.buf += text
        out = ""
        while True:
            if self.inside:
                i = self.buf.find(self.CLOSE)
                if i < 0:
                    return out
                self.buf, self.inside = self.buf[i + len(self.CLOSE):], False
            else:
                i = self.buf.find(self.OPEN)
                if i >= 0:
                    out += self.buf[:i]
                    self.buf, self.inside = self.buf[i + len(self.OPEN):], True
                    continue
                keep = 0  # Ende könnte der Anfang von "<tool>" sein
                for n in range(1, len(self.OPEN)):
                    if self.buf.endswith(self.OPEN[:n]):
                        keep = n
                out += self.buf[:len(self.buf) - keep]
                self.buf = self.buf[len(self.buf) - keep:]
                return out

    def flush(self):
        out = "" if self.inside else self.buf
        self.buf, self.inside = "", False
        return out


def _parse_args(raw):
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except ValueError:
            return {}
    return raw if isinstance(raw, dict) else {}


def _call_from_obj(obj):
    if not isinstance(obj, dict) or obj.get("name") not in TOOL_NAMES:
        return None
    args = obj.get("args", obj.get("arguments", obj.get("parameters", {})))
    return {"name": obj["name"], "args": _parse_args(args)}


def parse_text_calls(content):
    """Findet Werkzeug-Aufrufe im Text (Fallback für Modelle ohne Tool-Calling)."""
    calls = []
    for block in re.findall(r"<tool>(.*?)</tool>", content, re.DOTALL):
        try:
            call = _call_from_obj(json.loads(block.strip()))
        except ValueError:
            call = None
        if call:
            calls.append(call)
    if calls:
        return calls
    # Manche Modelle schreiben nur ein JSON-Objekt (evtl. in ```json … ```).
    stripped = re.sub(r"^```\w*\s*|\s*```$", "", content.strip())
    if stripped.startswith("{") and stripped.endswith("}"):
        try:
            call = _call_from_obj(json.loads(stripped))
        except ValueError:
            call = None
        if call:
            return [call]
    return []


class Agent:
    def __init__(self, cfg, client, workspace, ui, texts):
        self.cfg = cfg
        self.client = client
        self.ws = workspace
        self.ui = ui
        self.t = texts
        self.text_mode = False
        self.rules = memory.load_rules(workspace.root)
        self.overview = memory.overview(workspace.root)
        self.reset()

    # --- Verlauf ------------------------------------------------------------
    def system_prompt(self):
        lang = self.cfg.get("sprache", "de")
        parts = [PROMPT.get(lang, PROMPT["de"]),
                 "\nProjektordner: %s\nÜbersicht der Dateien:\n%s" % (self.ws.root, self.overview)]
        if self.rules:
            parts.append("\nRegeln des Nutzers für dieses Projekt (CODEBUDDY.md):\n" + self.rules)
        if self.text_mode:
            parts.append(TEXT_FORMAT % tool_list_text())
        return "\n".join(parts)

    def reset(self):
        self.messages = [{"role": "system", "content": self.system_prompt()}]

    def options(self):
        return {"temperature": self.cfg["temperatur"], "num_ctx": self.cfg["kontext"]}

    # --- Hauptschleife ------------------------------------------------------
    def ask(self, user_text):
        self.messages.append({"role": "user", "content": user_text})
        steps = 0
        pending = []
        try:
            while True:
                self.compact_if_needed()
                content, calls, native = self._model_turn()
                msg = {"role": "assistant", "content": content}
                if native:
                    msg["tool_calls"] = [{"function": {"name": c["name"], "arguments": c["args"]}}
                                         for c in calls]
                self.messages.append(msg)
                if not calls:
                    return content
                pending = list(calls)
                for call in calls:
                    self.ui.status(self.describe(call))
                    result = self.ws.execute(call["name"], call["args"])
                    self.ui.tool_result(call["name"], result)
                    self._add_result(call["name"], result, native)
                    pending.pop(0)
                steps += 1
                if steps >= self.cfg["max_schritte"]:
                    if not self.ui.confirm(self.t("continue", n=steps), "", "continue"):
                        self.ui.info(self.t("stopped"))
                        return None
                    steps = 0
        except KeyboardInterrupt:
            for call in pending:  # Verlauf in Ordnung halten
                self._add_result(call["name"], "Vom Nutzer abgebrochen.", native)
            self.ui.text_end()
            self.ui.info(self.t("interrupted"))
            return None

    def _add_result(self, name, result, native):
        if native:
            self.messages.append({"role": "tool", "content": result, "tool_name": name})
        else:
            self.messages.append({"role": "user", "content": RESULT_PREFIX + name + "]\n" + result})

    def _model_turn(self):
        try:
            return self._stream(None if self.text_mode else TOOL_SPECS)
        except ToolsNotSupported:
            self.text_mode = True
            self.messages[0]["content"] = self.system_prompt()
            self.ui.info(self.t("text_mode"))
            return self._stream(None)

    def _stream(self, tools):
        content, native_calls = "", []
        filt = ToolTagFilter()
        try:
            for chunk in self.client.chat_stream(self.cfg["modell"], self.messages, tools, self.options()):
                msg = chunk.get("message") or {}
                piece = msg.get("content") or ""
                if piece:
                    content += piece
                    visible = filt.feed(piece)
                    if visible:
                        self.ui.text(visible)
                for tc in msg.get("tool_calls") or []:
                    fn = tc.get("function", {})
                    native_calls.append({"name": fn.get("name", ""), "args": _parse_args(fn.get("arguments", {}))})
        finally:
            rest = filt.flush()
            if rest:
                self.ui.text(rest)
            self.ui.text_end()
        if native_calls:
            return content, native_calls, True
        return content, parse_text_calls(content), False

    def describe(self, call):
        a = call["args"]
        key = "status_" + call["name"]
        if call["name"] in TOOL_NAMES:
            return self.t(key, path=a.get("path", "."), text=a.get("text", ""), command=a.get("command", ""))
        return self.t("status_other", name=call["name"])

    # --- Gedächtnis: zu langen Verlauf zusammenfassen -----------------------
    def size(self):
        return sum(len(m.get("content") or "") + len(json.dumps(m.get("tool_calls", ""))) for m in self.messages)

    def compact_if_needed(self):
        limit = int(self.cfg["kontext"] * CHARS_PER_TOKEN * 0.75)
        if self.size() <= limit:
            return
        cut = len(self.messages) - KEEP_RECENT
        # Schnitt nur vor einer echten Nutzer-Nachricht (nicht mitten in Werkzeug-Aufrufen)
        while cut > 1 and not self._is_user_turn(self.messages[cut]):
            cut -= 1
        if cut <= 1:
            self._shorten_old_results()
            return
        self.ui.status(self.t("compacting"))
        old = self.messages[1:cut]
        transcript = "\n\n".join("%s: %s" % (m["role"], (m.get("content") or "")[:3000]) for m in old)
        try:
            summary = self.client.chat(self.cfg["modell"], [
                {"role": "system", "content": "Fasse das folgende Gespräch zwischen Nutzer und Programmier-Assistent "
                                              "knapp zusammen: Ziele, wichtige Dateien, was erledigt ist, was offen ist."},
                {"role": "user", "content": transcript}], self.options())
        except Exception:  # Zusammenfassung ist nur ein Extra – notfalls einfach kürzen
            summary = "(Ältere Nachrichten wurden entfernt.)"
        self.messages = ([self.messages[0],
                          {"role": "user", "content": "[Zusammenfassung des bisherigen Gesprächs]\n" + summary},
                          {"role": "assistant", "content": "Verstanden."}]
                         + self.messages[cut:])

    @staticmethod
    def _is_user_turn(m):
        return m["role"] == "user" and not (m.get("content") or "").startswith(RESULT_PREFIX)

    def _shorten_old_results(self):
        for m in self.messages[1:-1]:
            content = m.get("content") or ""
            if len(content) > 2000 and (m["role"] == "tool" or content.startswith(RESULT_PREFIX)):
                m["content"] = content[:2000] + "\n… (gekürzt)"
