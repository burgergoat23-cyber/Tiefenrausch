"""Startpunkt: `codebuddy` im Projektordner tippen."""

import argparse
import sys
from pathlib import Path

from . import config, hardware
from .agent import Agent
from .ollama_client import Ollama, OllamaError
from .render import BOLD, CYAN, DIM, YELLOW, StreamRenderer, c, color_diff
from .texts import YES, Texts
from .tools import Workspace

try:
    import readline  # noqa: F401  (Pfeiltasten im Eingabefeld, wo verfügbar)
except ImportError:
    pass


class TerminalUI:
    def __init__(self, texts):
        self.t = texts
        self.renderer = StreamRenderer()

    def text(self, chunk):
        self.renderer.feed(chunk)

    def text_end(self):
        self.renderer.end()

    def status(self, msg):
        print(c("→ " + msg, CYAN))

    def info(self, msg):
        print(c(msg, YELLOW))

    def tool_result(self, name, result):
        first = result.strip().splitlines()[0] if result.strip() else ""
        if name == "run_command" or first.startswith("FEHLER"):
            short = result if len(result) < 1500 else result[:1500] + "\n…"
            print(c(short, DIM))

    def confirm(self, question, details, kind):
        if details:
            print(color_diff(details) if kind in ("diff", "danger") else c(details, BOLD))
        try:
            answer = input(c(question + self.t("yes_no"), BOLD + YELLOW))
        except EOFError:
            return False
        return answer.strip().lower() in YES

    def ask_text(self, question):
        try:
            return input(c(question, BOLD + YELLOW))
        except EOFError:
            return ""


def choose_model(client, cfg, t):
    try:
        models = client.list_models()
    except OllamaError as e:
        print(t("error", msg=e))
        return
    print(t("models"))
    for i, m in enumerate(models, 1):
        print("  %d. %s%s" % (i, m, "  ←" if m == cfg["modell"] else ""))
    answer = input(t("pick_model")).strip()
    if not answer:
        return
    if answer.isdigit() and 1 <= int(answer) <= len(models):
        answer = models[int(answer) - 1]
    if answer not in models and answer + ":latest" not in models:
        print(t("no_model", model=answer))
        return
    cfg["modell"] = answer
    config.save(cfg)
    print(t("model_set", model=answer))


def check_model(client, cfg, t):
    try:
        models = client.list_models()
    except OllamaError:
        return False
    name = cfg["modell"]
    if name in models or name + ":latest" in models:
        return True
    print(t("no_model", model=name))
    if models:
        print(t("models"), ", ".join(models))
    return False


def main(argv=None):
    p = argparse.ArgumentParser(prog="codebuddy", description="Lokale Coding-KI mit Ollama")
    p.add_argument("--check", action="store_true", help="Hardware prüfen und Modelle vorschlagen")
    p.add_argument("--web", action="store_true", help="Web-Oberfläche im Browser starten")
    p.add_argument("--model", help="Modell nur für diesen Start")
    p.add_argument("--ordner", default=".", help="Projektordner (Standard: aktueller Ordner)")
    args = p.parse_args(argv)

    if args.check:
        print(hardware.report())
        return

    cfg = config.load()
    if args.model:
        cfg["modell"] = args.model
    t = Texts(cfg["sprache"])
    root = Path(args.ordner).resolve()
    client = Ollama(cfg["ollama_url"])

    if client.ping() is None:
        print(t("no_ollama"))
        sys.exit(1)
    if not check_model(client, cfg, t):
        sys.exit(1)

    if args.web:
        from .web import serve
        serve(cfg, client, root, t)
        return

    ui = TerminalUI(t)
    ws = Workspace(root, ui.confirm, ui.ask_text, t)
    agent = Agent(cfg, client, ws, ui, t)
    print(c(t("hello", model=cfg["modell"], root=root), BOLD))
    print(c(t("help"), DIM))

    while True:
        try:
            line = input(c(t("you"), BOLD + CYAN)).strip()
        except (EOFError, KeyboardInterrupt):
            print("\n" + t("bye"))
            return
        if not line:
            continue
        if line.startswith("/"):
            cmd = line.split()[0].lower()
            if cmd in ("/exit", "/quit", "/ende"):
                print(t("bye"))
                return
            if cmd == "/clear":
                agent.reset()
                print(t("cleared"))
            elif cmd == "/model":
                choose_model(client, cfg, t)
            elif cmd == "/config":
                print(t("config", path=config.config_path()))
            else:
                print(t("unknown_cmd") + t("help"))
            continue
        try:
            agent.ask(line)
        except OllamaError as e:
            print(c(t("error", msg=e), YELLOW))
        print()


if __name__ == "__main__":
    main()
