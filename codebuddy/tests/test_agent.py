"""Tests für Chat, Agent-Schleife, Fallback und Gedächtnis – mit nachgebautem Ollama."""

import io
import tempfile
import unittest
from pathlib import Path

from codebuddy.agent import Agent, ToolTagFilter, parse_text_calls
from codebuddy.config import DEFAULTS
from codebuddy.hardware import recommend
from codebuddy.ollama_client import Ollama, OllamaError
from codebuddy.render import StreamRenderer
from codebuddy.texts import Texts
from codebuddy.tools import Workspace

from fake_ollama import FakeOllama, call


class FakeUI:
    def __init__(self, ok=True):
        self.ok = ok
        self.out, self.statuses, self.infos, self.questions = "", [], [], []

    def text(self, chunk):
        self.out += chunk

    def text_end(self):
        pass

    def status(self, msg):
        self.statuses.append(msg)

    def info(self, msg):
        self.infos.append(msg)

    def tool_result(self, name, result):
        pass

    def confirm(self, question, details, kind):
        self.questions.append(kind)
        return self.ok

    def ask_text(self, question):
        return ""


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.fake = None

    def tearDown(self):
        if self.fake:
            self.fake.close()
        self.tmp.cleanup()

    def make(self, script, ui=None, **kw):
        self.fake = FakeOllama(script, **kw)
        cfg = dict(DEFAULTS, modell="test:latest")
        self.ui = ui or FakeUI()
        ws = Workspace(self.root, self.ui.confirm, self.ui.ask_text, Texts("de"))
        return Agent(cfg, Ollama(self.fake.url), ws, self.ui, Texts("de"))

    def test_chat_streams_and_keeps_history(self):
        agent = self.make([{"content": "Hallo! Wie kann ich helfen?"}, {"content": "Du heißt Tom."}])
        agent.ask("Hi, ich bin Tom")
        self.assertEqual(self.ui.out, "Hallo! Wie kann ich helfen?")
        agent.ask("Wie heiße ich?")
        sent = self.fake.requests[-1]["messages"]
        self.assertEqual([m["role"] for m in sent], ["system", "user", "assistant", "user"])
        self.assertIn("Tom", sent[1]["content"])
        agent.reset()
        self.assertEqual(len(agent.messages), 1)

    def test_task_numbers_1_to_10(self):
        """Die Beispiel-Aufgabe aus dem Plan: Skript erstellen und ausführen."""
        script = [
            {"content": "", "tool_calls": [call("write_file", path="zahlen.py",
                                                content="for i in range(1, 11):\n    print(i)\n")]},
            {"content": "", "tool_calls": [call("run_command", command="python3 zahlen.py")]},
            {"content": "Fertig! Das Skript gibt die Zahlen 1 bis 10 aus."},
        ]
        agent = self.make(script)
        answer = agent.ask("Erstelle ein Python-Skript, das Zahlen von 1–10 ausgibt, und führ es aus")
        self.assertIn("Fertig", answer)
        self.assertTrue((self.root / "zahlen.py").exists())
        self.assertEqual(self.ui.questions, ["diff", "command"])
        self.assertEqual(self.ui.statuses, ["Schreibe zahlen.py …", "Führe aus: python3 zahlen.py"])
        result = [m for m in agent.messages if m["role"] == "tool"][-1]["content"]
        self.assertIn("Exit-Code: 0", result)
        self.assertIn("10", result)
        self.assertTrue(self.fake.requests[0]["tools"])

    def test_max_steps_asks_user(self):
        loop = [{"content": "", "tool_calls": [call("list_files", path=".")]}] * 25
        agent = self.make(loop, ui=FakeUI(ok=False))
        agent.ask("Schau dich um")
        self.assertEqual(len(self.fake.requests), 20)
        self.assertEqual(self.ui.questions, ["continue"])

    def test_text_fallback_when_tools_unsupported(self):
        (self.root / "main.py").write_text("print('x')\n")
        script = [
            {"content": 'Ich lese die Datei.\n<tool>{"name": "read_file", "args": {"path": "main.py"}}</tool>'},
            {"content": "Die Datei gibt x aus."},
        ]
        agent = self.make(script, tools_supported=False)
        agent.ask("Was macht main.py?")
        self.assertTrue(agent.text_mode)
        self.assertNotIn("<tool>", self.ui.out)
        self.assertIn("Ich lese die Datei.", self.ui.out)
        self.assertIn("WERKZEUG-FORMAT", agent.messages[0]["content"])
        self.assertTrue(any(m["content"].startswith("[Ergebnis von read_file]") for m in agent.messages))
        self.assertIn("Lese main.py …", self.ui.statuses)

    def test_rules_and_overview_in_prompt(self):
        (self.root / "CODEBUDDY.md").write_text("Immer Tabs benutzen.")
        (self.root / "app.py").write_text("")
        agent = self.make([])
        prompt = agent.messages[0]["content"]
        self.assertIn("Immer Tabs benutzen.", prompt)
        self.assertIn("app.py", prompt)

    def test_compaction(self):
        agent = self.make([{"content": "Zusammenfassung: Nutzer baut ein Spiel."}, {"content": "Ok."}])
        agent.cfg["kontext"] = 200
        for i in range(6):
            agent.messages += [{"role": "user", "content": "Frage %d " % i + "x" * 100},
                               {"role": "assistant", "content": "Antwort %d" % i}]
        agent.ask("Neue Frage")
        self.assertIn("Fasse ältere Teile", self.ui.statuses[0])
        self.assertIn("Nutzer baut ein Spiel", agent.messages[1]["content"])
        self.assertLess(len(agent.messages), 12)
        self.assertEqual(agent.messages[-2]["content"], "Neue Frage")

    def test_only_local_ollama(self):
        with self.assertRaises(OllamaError):
            Ollama("http://example.com:11434")


class HelperTests(unittest.TestCase):
    def test_tool_tag_filter_split_chunks(self):
        f = ToolTagFilter()
        out = ""
        for piece in ["Hal", "lo <to", 'ol>{"name":', '"x"}</to', "ol> Ende"]:
            out += f.feed(piece)
        out += f.flush()
        self.assertEqual(out, "Hallo  Ende")

    def test_parse_text_calls(self):
        self.assertEqual(parse_text_calls('<tool>{"name": "read_file", "args": {"path": "a"}}</tool>'),
                         [{"name": "read_file", "args": {"path": "a"}}])
        self.assertEqual(parse_text_calls('```json\n{"name": "list_files", "arguments": "{}"}\n```'),
                         [{"name": "list_files", "args": {}}])
        self.assertEqual(parse_text_calls("Nur Text {mit Klammern}"), [])
        self.assertEqual(parse_text_calls('<tool>{"name": "boese"}</tool>'), [])

    def test_renderer_keeps_text(self):
        buf = io.StringIO()
        r = StreamRenderer(buf.write)
        text = "Hier:\n```python\nprint(1)\n```\nFertig"
        for i in range(0, len(text), 3):
            r.feed(text[i:i + 3])
        r.end()
        self.assertEqual(buf.getvalue(), text + "\n")  # ohne Terminal: keine Farbcodes

    def test_hardware_recommend(self):
        self.assertEqual(recommend(8, 0)[0], "klein")
        self.assertEqual(recommend(4, 0)[0], "winzig")
        self.assertEqual(recommend(16, 8)[0], "klein")
        self.assertEqual(recommend(32, 16)[0], "mittel")
        self.assertEqual(recommend(64, 24)[0], "gross")
        self.assertEqual(recommend(32, 0, is_apple=True)[0], "gross")
        self.assertEqual(recommend(16, 0, is_apple=True)[0], "mittel")


if __name__ == "__main__":
    unittest.main()
