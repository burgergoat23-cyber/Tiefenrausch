"""Phase 0: Hardware prüfen und passende Coding-Modelle vorschlagen."""

import ctypes
import platform
import re
import shutil
import subprocess


def _run(cmd):
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=15).stdout
    except (OSError, subprocess.SubprocessError):
        return ""


def ram_gb():
    system = platform.system()
    try:
        if system == "Linux":
            with open("/proc/meminfo") as f:
                kb = int(re.search(r"MemTotal:\s+(\d+)", f.read()).group(1))
            return kb / 1024 / 1024
        if system == "Darwin":
            return int(_run(["sysctl", "-n", "hw.memsize"]).strip()) / 1024 ** 3
        if system == "Windows":
            class MEMSTAT(ctypes.Structure):
                _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong),
                            ("ullTotalPhys", ctypes.c_ulonglong), ("ullAvailPhys", ctypes.c_ulonglong),
                            ("ullTotalPageFile", ctypes.c_ulonglong), ("ullAvailPageFile", ctypes.c_ulonglong),
                            ("ullTotalVirtual", ctypes.c_ulonglong), ("ullAvailVirtual", ctypes.c_ulonglong),
                            ("ullAvailExtendedVirtual", ctypes.c_ulonglong)]
            st = MEMSTAT()
            st.dwLength = ctypes.sizeof(MEMSTAT)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(st))
            return st.ullTotalPhys / 1024 ** 3
    except (OSError, ValueError, AttributeError):
        pass
    return 0.0


def gpus():
    """Liste von (Name, VRAM in GB oder None)."""
    found = []
    if shutil.which("nvidia-smi"):
        out = _run(["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        for line in out.splitlines():
            if "," in line:
                name, mb = line.rsplit(",", 1)
                try:
                    found.append((name.strip(), int(mb) / 1024))
                except ValueError:
                    found.append((name.strip(), None))
    if found:
        return found
    system = platform.system()
    if system == "Darwin":
        out = _run(["system_profiler", "SPDisplaysDataType"])
        for m in re.finditer(r"Chipset Model:\s*(.+)", out):
            found.append((m.group(1).strip(), None))
    elif system == "Windows":
        out = _run(["powershell", "-NoProfile", "-Command",
                    "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name }"])
        found = [(l.strip(), None) for l in out.splitlines() if l.strip()]
    elif system == "Linux" and shutil.which("lspci"):
        out = _run(["lspci"])
        found = [(l.split(":", 2)[-1].strip(), None) for l in out.splitlines()
                 if "VGA" in l or "3D controller" in l]
    return found


def apple_silicon():
    return platform.system() == "Darwin" and platform.machine() == "arm64"


# (Modellname, ungefähre Downloadgröße, kurze Beschreibung)
MODELS = {
    "gross": [
        ("qwen3-coder:30b", "19 GB", "sehr gut für Code und Werkzeuge, schnell (MoE)"),
        ("devstral:24b", "14 GB", "speziell für Agenten-Aufgaben gebaut"),
        ("qwen2.5-coder:32b", "20 GB", "sehr gute Code-Qualität"),
    ],
    "mittel": [
        ("qwen2.5-coder:14b", "9 GB", "gute Mischung aus Qualität und Tempo"),
        ("deepseek-coder-v2:16b", "9 GB", "schnell, gut bei Code"),
        ("qwen2.5-coder:7b", "4,7 GB", "kleiner und schneller"),
    ],
    "klein": [
        ("qwen2.5-coder:7b", "4,7 GB", "beste Wahl bei wenig Speicher"),
        ("llama3.1:8b", "4,9 GB", "kann Werkzeuge gut benutzen"),
        ("qwen2.5-coder:3b", "1,9 GB", "sehr klein, falls 7b zu langsam ist"),
    ],
    "winzig": [
        ("qwen2.5-coder:3b", "1,9 GB", "läuft auch auf schwachen PCs"),
        ("qwen2.5-coder:1.5b", "1 GB", "Notlösung, eher schwach"),
    ],
}


def recommend(ram, vram, is_apple=False):
    """Gibt (Stufe, Begründung) zurück."""
    if is_apple:
        usable = ram * 0.7  # Mac teilt den Speicher zwischen CPU und Grafik
        why = "Mac mit Apple-Chip: ca. %.0f GB nutzbar für das Modell" % usable
    elif vram:
        usable = vram
        why = "Grafikkarte mit %.0f GB VRAM" % vram
    else:
        usable = min(ram - 2, 14)  # ohne Grafikkarte rechnet die CPU – größer wird zu langsam
        why = "keine passende Grafikkarte gefunden – die CPU rechnet (langsamer)"
    if usable >= 22:
        tier = "gross"
    elif usable >= 11:
        tier = "mittel"
    elif usable >= 6:
        tier = "klein"
    else:
        tier = "winzig"
    return tier, why


def report():
    ram = ram_gb()
    gpu_list = gpus()
    vram = max((v for _, v in gpu_list if v), default=0)
    tier, why = recommend(ram, vram, apple_silicon())
    lines = [
        "=== Hardware-Check ===",
        "Betriebssystem: %s %s (%s)" % (platform.system(), platform.release(), platform.machine()),
        "Arbeitsspeicher (RAM): %.1f GB" % ram,
    ]
    if gpu_list:
        for name, v in gpu_list:
            lines.append("Grafikkarte: %s%s" % (name, " – %.1f GB VRAM" % v if v else ""))
    else:
        lines.append("Grafikkarte: keine gefunden")
    lines += ["", "Einschätzung: " + why, "", "Vorschläge (das erste ist meine Empfehlung):"]
    for i, (name, size, note) in enumerate(MODELS[tier], 1):
        lines.append("  %d. %-24s ~%-7s %s" % (i, name, size, note))
    first = MODELS[tier][0][0]
    lines += ["", "Herunterladen:  ollama pull " + first,
              "Testen:         ollama run %s \"Schreib Hallo Welt in Python\"" % first,
              "Dann in CodeBuddy:  /model  und das Modell auswählen."]
    if not shutil.which("ollama"):
        lines += ["", "Ollama ist noch nicht installiert: https://ollama.com/download"]
    return "\n".join(lines)
