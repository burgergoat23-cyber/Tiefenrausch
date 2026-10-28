"""Alle Texte der Oberfläche auf Deutsch und Englisch."""

TEXTS = {
    "de": {
        "hello": "CodeBuddy – deine lokale Coding-KI. Modell: {model}  Ordner: {root}",
        "help": "Befehle: /clear (Verlauf löschen)  /model (Modell wechseln)  /config (Einstellungen)  /exit (beenden)",
        "you": "Du> ",
        "bye": "Tschüss!",
        "cleared": "Verlauf gelöscht.",
        "no_ollama": "Ollama läuft nicht. Starte zuerst die Ollama-App (oder im Terminal: ollama serve).",
        "no_model": "Das Modell „{model}“ ist nicht installiert. Lade es mit:  ollama pull {model}",
        "models": "Installierte Modelle:",
        "pick_model": "Nummer oder Name eingeben (Enter = abbrechen): ",
        "model_set": "Modell gewechselt zu {model}.",
        "unknown_cmd": "Unbekannter Befehl. ",
        "yes_no": " (j/n) ",
        "apply": "Übernehmen?",
        "run": "Befehl ausführen?",
        "delete_warn": "ACHTUNG: Dieser Befehl kann Dateien LÖSCHEN!",
        "delete_confirm": "Wirklich löschen? Tippe das Wort  löschen  zum Bestätigen: ",
        "delete_word": "löschen",
        "outside_warn": "Hinweis: Der Befehl nennt Pfade, die evtl. außerhalb des Projektordners liegen.",
        "continue": "Ich habe schon {n} Schritte gemacht. Weitermachen?",
        "stopped": "Angehalten.",
        "interrupted": "(abgebrochen)",
        "text_mode": "Hinweis: Dieses Modell kann kein Tool-Calling – ich nutze das Textformat.",
        "compacting": "Fasse ältere Teile des Gesprächs zusammen …",
        "error": "Fehler: {msg}",
        "config": "Einstellungen: {path}",
        "status_list_files": "Schaue in den Ordner {path} …",
        "status_read_file": "Lese {path} …",
        "status_search": "Suche nach „{text}“ …",
        "status_write_file": "Schreibe {path} …",
        "status_edit_file": "Ändere {path} …",
        "status_run_command": "Führe aus: {command}",
        "status_other": "Nutze {name} …",
        "web_start": "Web-Oberfläche: {url}  (nur auf diesem PC, Strg+C zum Beenden)",
    },
    "en": {
        "hello": "CodeBuddy – your local coding AI. Model: {model}  Folder: {root}",
        "help": "Commands: /clear (clear history)  /model (switch model)  /config (settings)  /exit (quit)",
        "you": "You> ",
        "bye": "Bye!",
        "cleared": "History cleared.",
        "no_ollama": "Ollama is not running. Start the Ollama app first (or in a terminal: ollama serve).",
        "no_model": "The model \"{model}\" is not installed. Download it with:  ollama pull {model}",
        "models": "Installed models:",
        "pick_model": "Enter number or name (Enter = cancel): ",
        "model_set": "Switched model to {model}.",
        "unknown_cmd": "Unknown command. ",
        "yes_no": " (y/n) ",
        "apply": "Apply?",
        "run": "Run command?",
        "delete_warn": "WARNING: This command may DELETE files!",
        "delete_confirm": "Really delete? Type the word  delete  to confirm: ",
        "delete_word": "delete",
        "outside_warn": "Note: The command mentions paths that may be outside the project folder.",
        "continue": "I have already done {n} steps. Continue?",
        "stopped": "Stopped.",
        "interrupted": "(interrupted)",
        "text_mode": "Note: This model cannot do tool calling – using the text format.",
        "compacting": "Summarizing older parts of the conversation …",
        "error": "Error: {msg}",
        "config": "Settings: {path}",
        "status_list_files": "Looking into {path} …",
        "status_read_file": "Reading {path} …",
        "status_search": "Searching for \"{text}\" …",
        "status_write_file": "Writing {path} …",
        "status_edit_file": "Editing {path} …",
        "status_run_command": "Running: {command}",
        "status_other": "Using {name} …",
        "web_start": "Web interface: {url}  (only on this PC, Ctrl+C to quit)",
    },
}

YES = ("j", "ja", "y", "yes")


class Texts:
    def __init__(self, lang="de"):
        self.lang = lang if lang in TEXTS else "de"

    def __call__(self, key, **kw):
        text = TEXTS[self.lang].get(key, key)
        try:
            return text.format(**kw)
        except (KeyError, IndexError):
            return text
