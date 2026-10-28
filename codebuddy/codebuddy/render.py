"""Farbige Ausgabe im Terminal: Code-Blöcke hervorheben, Diffs einfärben."""

import os
import re
import sys

try:  # optional: schönere Farben, wenn pygments installiert ist
    from pygments import highlight as _pyg_highlight
    from pygments.formatters import TerminalFormatter
    from pygments.lexers import get_lexer_by_name
    from pygments.util import ClassNotFound
except ImportError:
    _pyg_highlight = None

RESET, BOLD, DIM = "\033[0m", "\033[1m", "\033[2m"
RED, GREEN, YELLOW, BLUE, MAGENTA, CYAN = (
    "\033[31m", "\033[32m", "\033[33m", "\033[34m", "\033[35m", "\033[36m")


def enable_colors():
    if os.environ.get("NO_COLOR") or not sys.stdout.isatty():
        return False
    if os.name == "nt":
        os.system("")  # schaltet ANSI-Farben in der Windows-Konsole ein
    return True


COLOR = enable_colors()


def c(text, color):
    return color + text + RESET if COLOR else text


KEYWORDS = set("""
and as assert async await break case catch class const continue def default del do elif else
except export extends false False finally for from function if import in interface is lambda let
match new None nonlocal not null or pass print private public raise return self static struct
super switch this throw true True try type typeof var void while with yield fn pub use mut impl
""".split())
TOKEN_RE = re.compile(
    r"(?P<comment>#.*$|//.*$|--\s.*$)"
    r"|(?P<string>\"(?:\\.|[^\"\\])*\"?|'(?:\\.|[^'\\])*'?|`[^`]*`?)"
    r"|(?P<number>\b\d+(?:\.\d+)?\b)"
    r"|(?P<word>\b[A-Za-z_]\w*\b)")


def _simple_highlight(line):
    def repl(m):
        kind = m.lastgroup
        s = m.group(0)
        if kind == "comment":
            return c(s, DIM)
        if kind == "string":
            return c(s, GREEN)
        if kind == "number":
            return c(s, MAGENTA)
        if s in KEYWORDS:
            return c(s, BLUE + BOLD)
        return s
    return TOKEN_RE.sub(repl, line)


def highlight_line(line, lang=""):
    if not COLOR:
        return line
    if _pyg_highlight is not None:
        try:
            lexer = get_lexer_by_name(lang or "text")
            return _pyg_highlight(line, lexer, TerminalFormatter()).rstrip("\n")
        except ClassNotFound:
            pass
    return _simple_highlight(line)


def color_diff(diff):
    if not COLOR:
        return diff
    out = []
    for line in diff.splitlines():
        if line.startswith(("+++", "---")):
            out.append(c(line, BOLD))
        elif line.startswith("+"):
            out.append(c(line, GREEN))
        elif line.startswith("-"):
            out.append(c(line, RED))
        elif line.startswith("@@"):
            out.append(c(line, CYAN))
        else:
            out.append(line)
    return "\n".join(out)


class StreamRenderer:
    """Gibt gestreamten Text sofort aus; Zeilen in ```-Blöcken werden eingefärbt."""

    def __init__(self, write=None):
        self.write = write or (lambda s: (sys.stdout.write(s), sys.stdout.flush()))
        self.in_code = False
        self.lang = ""
        self.line = ""          # aktuelle, noch nicht ausgegebene Zeile (Code/Zaun)
        self.at_start = True    # sind wir am Anfang einer Zeile?
        self.raw_line = False   # aktuelle Zeile ist normaler Text und wird direkt ausgegeben

    def feed(self, text):
        for ch in text:
            self._char(ch)

    def _char(self, ch):
        if self.raw_line:
            self.write(ch)
            if ch == "\n":
                self.raw_line, self.at_start = False, True
            return
        self.line += ch
        if ch == "\n":
            self._finish_line()
            return
        if not self.in_code and len(self.line.lstrip()) >= 3 and not self.line.lstrip().startswith("```"):
            # normaler Text: ab jetzt live ausgeben
            self.write(self.line)
            self.line, self.raw_line = "", True

    def _finish_line(self):
        line = self.line.rstrip("\n")
        self.line = ""
        if line.lstrip().startswith("```"):
            if self.in_code:
                self.in_code = False
            else:
                self.in_code, self.lang = True, line.strip()[3:].strip()
            self.write(c(line, DIM) + "\n")
        elif self.in_code:
            self.write(highlight_line(line, self.lang) + "\n")
        else:
            self.write(line + "\n")

    def end(self):
        if self.line:
            self.line += "\n"
            self._finish_line()
        elif self.raw_line:
            self.write("\n")
        self.raw_line, self.in_code = False, False
