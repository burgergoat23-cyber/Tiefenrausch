"""Tests für die Werkzeuge: python -m unittest discover -s tests"""

import sys
import tempfile
import unittest
from pathlib import Path

from codebuddy.texts import Texts
from codebuddy.tools import Workspace, make_diff


class Answers:
    """Spielt den Nutzer: antwortet automatisch mit j/n und merkt sich die Fragen."""

    def __init__(self, ok=True, text=""):
        self.ok, self.text, self.asked = ok, text, []

    def confirm(self, question, details, kind):
        self.asked.append((kind, details))
        return self.ok

    def ask_text(self, question):
        self.asked.append(("text", question))
        return self.text


class ToolTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "projekt"
        self.root.mkdir()
        (self.root / "main.py").write_text("print('hallo')\nx = 1\n", encoding="utf-8")
        (self.root / "src").mkdir()
        (self.root / "src" / "util.py").write_text("def hilfe():\n    return 42\n", encoding="utf-8")
        (self.root.parent / "geheim.txt").write_text("streng geheim", encoding="utf-8")
        self.user = Answers()
        self.ws = Workspace(self.root, self.user.confirm, self.user.ask_text, Texts("de"))

    def tearDown(self):
        self.tmp.cleanup()

    def run_tool(self, name, **args):
        return self.ws.execute(name, args)

    # --- lesen ---------------------------------------------------------------
    def test_list_files(self):
        out = self.run_tool("list_files", path=".")
        self.assertEqual(out.splitlines(), ["src/", "main.py"])

    def test_read_file(self):
        self.assertIn("print('hallo')", self.run_tool("read_file", path="main.py"))

    def test_read_missing_file(self):
        self.assertTrue(self.run_tool("read_file", path="gibtsnicht.py").startswith("FEHLER"))

    def test_search(self):
        out = self.run_tool("search", text="RETURN")
        self.assertIn("src/util.py:2:", out)
        self.assertEqual(self.run_tool("search", text="xyz123"), "Keine Treffer.")

    # --- Sicherheit: nur im Projektordner -----------------------------------
    def test_outside_folder_is_blocked(self):
        for path in ["../geheim.txt", str(self.root.parent / "geheim.txt"), "src/../../geheim.txt"]:
            out = self.run_tool("read_file", path=path)
            self.assertIn("außerhalb des Projektordners", out, path)
        out = self.run_tool("write_file", path="../neu.txt", content="x")
        self.assertIn("außerhalb", out)
        self.assertFalse((self.root.parent / "neu.txt").exists())
        self.assertEqual(self.user.asked, [])

    # --- schreiben nur nach "j" ---------------------------------------------
    def test_write_file_asks_and_writes(self):
        out = self.run_tool("write_file", path="neu/zahlen.py", content="print(1)\n")
        self.assertIn("Gespeichert", out)
        self.assertEqual((self.root / "neu" / "zahlen.py").read_text(), "print(1)\n")
        kind, diff = self.user.asked[0]
        self.assertEqual(kind, "diff")
        self.assertIn("+print(1)", diff)

    def test_write_file_declined(self):
        self.user.ok = False
        out = self.run_tool("write_file", path="main.py", content="kaputt\n")
        self.assertIn("NICHT", out)
        self.assertIn("hallo", (self.root / "main.py").read_text())

    def test_emptying_file_needs_extra_confirmation(self):
        out = self.run_tool("write_file", path="main.py", content="")
        self.assertIn("NICHT", out)  # Wort "löschen" wurde nicht getippt
        self.assertIn("hallo", (self.root / "main.py").read_text())

    def test_edit_file(self):
        out = self.run_tool("edit_file", path="main.py", old_text="x = 1", new_text="x = 2")
        self.assertIn("Geändert", out)
        self.assertIn("x = 2", (self.root / "main.py").read_text())
        self.assertIn("-x = 1", self.user.asked[0][1])

    def test_edit_file_errors(self):
        self.assertIn("nicht vor", self.run_tool("edit_file", path="main.py", old_text="gibtsnicht", new_text="a"))
        (self.root / "doppelt.txt").write_text("a\na\n")
        self.assertIn("2-mal", self.run_tool("edit_file", path="doppelt.txt", old_text="a", new_text="b"))

    def test_edit_file_declined(self):
        self.user.ok = False
        self.run_tool("edit_file", path="main.py", old_text="x = 1", new_text="x = 2")
        self.assertIn("x = 1", (self.root / "main.py").read_text())

    # --- Befehle ------------------------------------------------------------
    def test_run_command(self):
        out = self.run_tool("run_command", command='"%s" main.py' % sys.executable)
        self.assertIn("Exit-Code: 0", out)
        self.assertIn("hallo", out)
        self.assertEqual(self.user.asked[0][0], "command")

    def test_run_command_declined(self):
        self.user.ok = False
        out = self.run_tool("run_command", command="echo hallo > neu.txt")
        self.assertIn("NICHT", out)
        self.assertFalse((self.root / "neu.txt").exists())

    def test_delete_command_needs_word(self):
        out = self.run_tool("run_command", command="rm main.py")
        self.assertIn("NICHT", out)
        self.assertTrue((self.root / "main.py").exists())
        self.assertEqual(self.user.asked[0][0], "danger")
        self.assertEqual(self.user.asked[1][0], "text")

    def test_delete_command_with_word(self):
        self.user.text = "löschen"
        cmd = '"%s" -c "import os; os.remove(\'main.py\')"' % sys.executable
        self.assertIn("Exit-Code: 0", self.run_tool("run_command", command=cmd))
        self.assertFalse((self.root / "main.py").exists())

    def test_unknown_tool_and_bad_args(self):
        self.assertIn("Unbekanntes Werkzeug", self.run_tool("format_disk"))
        self.assertIn("Falsche Argumente", self.ws.execute("read_file", {"datei": "main.py"}))

    def test_make_diff(self):
        self.assertIn("+b", make_diff("a\n", "a\nb\n", "x.txt"))
        self.assertEqual(make_diff("a\n", "a\n", "x.txt"), "(keine Änderung)\n")


if __name__ == "__main__":
    unittest.main()
