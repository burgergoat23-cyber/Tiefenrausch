"""Windows-Teil der Spiel-KI.

- Bildschirm lesen (mss)
- erkennen, was der Mensch drückt (Tastatur-Haken über pynput)
- selbst Tasten drücken und klicken (SendInput mit Scan-Codes, das verstehen auch Spiele)
Eigene Tastendrücke tragen die Kennung MAGIC, damit der Haken sie nicht für menschliche hält.
"""
import ctypes
import os
import threading
from ctypes import wintypes

from PIL import Image

import ki_kern as K

MAGIC = 0x5449454B   # "TIEK"

user32 = ctypes.WinDLL('user32', use_last_error=True)


def dpi_bewusst():
    """Echte Bildschirm-Pixel benutzen (sonst stimmen Bereiche bei 125 %/150 % Skalierung nicht)."""
    try:
        ctypes.WinDLL('shcore').SetProcessDpiAwareness(2)
        return
    except (OSError, AttributeError):
        pass
    try:
        user32.SetProcessDPIAware()
    except (OSError, AttributeError):
        pass


ULONG_PTR = ctypes.c_size_t


class MOUSEINPUT(ctypes.Structure):
    _fields_ = [('dx', ctypes.c_int32), ('dy', ctypes.c_int32), ('mouseData', ctypes.c_uint32),
                ('dwFlags', ctypes.c_uint32), ('time', ctypes.c_uint32),
                ('dwExtraInfo', ULONG_PTR)]


class KEYBDINPUT(ctypes.Structure):
    _fields_ = [('wVk', ctypes.c_uint16), ('wScan', ctypes.c_uint16),
                ('dwFlags', ctypes.c_uint32), ('time', ctypes.c_uint32),
                ('dwExtraInfo', ULONG_PTR)]


class HARDWAREINPUT(ctypes.Structure):
    _fields_ = [('uMsg', ctypes.c_uint32), ('wParamL', ctypes.c_uint16),
                ('wParamH', ctypes.c_uint16)]


class _EINGABE(ctypes.Union):
    _fields_ = [('mi', MOUSEINPUT), ('ki', KEYBDINPUT), ('hi', HARDWAREINPUT)]


class INPUT(ctypes.Structure):
    _anonymous_ = ('u',)
    _fields_ = [('type', ctypes.c_uint32), ('u', _EINGABE)]


INPUT_MOUSE, INPUT_KEYBOARD = 0, 1
KEYEVENTF_EXTENDEDKEY, KEYEVENTF_KEYUP, KEYEVENTF_SCANCODE = 0x0001, 0x0002, 0x0008
MAUS_FLAGS = {0x01: (0x0002, 0x0004), 0x02: (0x0008, 0x0010), 0x04: (0x0020, 0x0040)}
ERWEITERT = {0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0xA3, 0xA5, 0x6F, 0x90}
VERBOTENE_KLASSEN = {'ConsoleWindowClass', 'CASCADIA_HOSTING_WINDOW_CLASS', 'Shell_TrayWnd',
                     'Progman', 'WorkerW', 'PseudoConsoleWindow', 'Shell_SecondaryTrayWnd'}

user32.SendInput.argtypes = [ctypes.c_uint, ctypes.POINTER(INPUT), ctypes.c_int]
user32.SendInput.restype = ctypes.c_uint
user32.MapVirtualKeyW.argtypes = [ctypes.c_uint, ctypes.c_uint]
user32.MapVirtualKeyW.restype = ctypes.c_uint
user32.GetForegroundWindow.argtypes = []
user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetAncestor.argtypes = [wintypes.HWND, ctypes.c_uint]
user32.GetAncestor.restype = wintypes.HWND
user32.WindowFromPoint.argtypes = [wintypes.POINT]
user32.WindowFromPoint.restype = wintypes.HWND
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
user32.GetCursorPos.argtypes = [ctypes.POINTER(wintypes.POINT)]
user32.SetCursorPos.argtypes = [ctypes.c_int, ctypes.c_int]
user32.IsIconic.argtypes = [wintypes.HWND]


def _scan(vk):
    r = user32.MapVirtualKeyW(vk, 4)          # MAPVK_VK_TO_VSC_EX
    sc, ext = r & 0xFF, (r >> 8) in (0xE0, 0xE1) or vk in ERWEITERT
    if sc == 0:
        sc = user32.MapVirtualKeyW(vk, 0) & 0xFF
    return sc, ext


def _senden(inp):
    user32.SendInput(1, ctypes.byref(inp), ctypes.sizeof(INPUT))


class WindowsBackend:
    def __init__(self):
        import mss
        self._mss = getattr(mss, 'MSS', None) or mss.mss   # neuere mss-Versionen: MSS
        self._lokal = threading.local()
        self.eigene_pid = os.getpid()
        self.haken = []

    # --- Haken: was drückt der Mensch?
    def start(self, bei_taste, bei_hotkey):
        from pynput import keyboard
        hk_unten = set()

        def kf(msg, data):
            try:
                if (data.dwExtraInfo or 0) == MAGIC:
                    return False
                unten = msg in (0x100, 0x104)
                vk = int(data.vkCode)
                if vk in K.HOTKEYS:
                    if unten and vk not in hk_unten:
                        hk_unten.add(vk)
                        bei_hotkey(vk)
                    elif not unten:
                        hk_unten.discard(vk)
                    return False
                bei_taste(vk, unten, int(data.scanCode), bool(data.flags & 0x01))
            except Exception:   # noqa: BLE001 – der Haken darf nie abstürzen
                pass
            return False

        # Nur ein Tastatur-Haken: ein Maus-Haken würde bei jeder Mausbewegung Python aufrufen
        # und könnte die Maus am ganzen PC verlangsamen, während die KI rechnet.
        k = keyboard.Listener(win32_event_filter=kf)
        k.start()
        self.haken = [k]

    def stopp(self):
        for h in self.haken:
            try:
                h.stop()
            except Exception:   # noqa: BLE001
                pass

    # --- Fenster
    def vorne(self):
        h = user32.GetForegroundWindow()
        return (user32.GetAncestor(h, 2) or 0) if h else 0    # GA_ROOT

    def titel(self, hwnd):
        n = user32.GetWindowTextLengthW(hwnd)
        buf = ctypes.create_unicode_buffer(n + 1)
        user32.GetWindowTextW(hwnd, buf, n + 1)
        return buf.value

    def _klasse(self, hwnd):
        buf = ctypes.create_unicode_buffer(256)
        user32.GetClassNameW(hwnd, buf, 256)
        return buf.value

    def fenster_pruefen(self, hwnd, bereich):
        """None = in Ordnung, sonst eine Meldung für den Nutzer."""
        if not hwnd:
            return 'Es ist kein Fenster vorne. Klick ins Spiel und versuch es nochmal.'
        pid = wintypes.DWORD()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
        if pid.value == self.eigene_pid:
            return 'Vorne ist das Fenster der Spiel-KI. Klick zuerst ins Spiel, dann F8.'
        if self._klasse(hwnd) in VERBOTENE_KLASSEN:
            return 'Vorne ist kein Spiel (Desktop oder schwarzes Fenster). Klick zuerst ins Spiel.'
        if user32.IsIconic(hwnd):
            return 'Das Spielfenster ist minimiert.'
        if bereich:
            r = wintypes.RECT()
            user32.GetWindowRect(hwnd, ctypes.byref(r))
            cx, cy = bereich[0] + bereich[2] // 2, bereich[1] + bereich[3] // 2
            if not (r.left <= cx < r.right and r.top <= cy < r.bottom):
                return ('Der markierte Spielbereich liegt nicht in dem Fenster, das vorne ist. '
                        'Klick ins Spiel – oder markier den Spielbereich neu.')
        return None

    def gesamtbildschirm(self):
        with self._mss() as sct:
            m = sct.monitors[0]
            return m['left'], m['top'], m['width'], m['height']

    # --- Bild
    def bild(self, bereich):
        sct = getattr(self._lokal, 'sct', None)
        if sct is None:   # mss muss in jedem Thread neu angelegt werden
            sct = self._lokal.sct = self._mss()
        x, y, w, h = (int(v) for v in bereich)
        raw = sct.grab({'left': x, 'top': y, 'width': w, 'height': h})
        return Image.frombuffer('RGB', raw.size, raw.bgra, 'raw', 'BGRX', 0, 1)

    # --- Tasten und Maus
    def taste(self, vk, unten, scan=None):
        inp = INPUT()
        if vk in MAUS_FLAGS:
            inp.type = INPUT_MOUSE
            inp.mi = MOUSEINPUT(0, 0, 0, MAUS_FLAGS[vk][0 if unten else 1], 0, MAGIC)
            _senden(inp)
            return
        sc, ext = scan if scan else _scan(vk)
        flags = 0 if unten else KEYEVENTF_KEYUP
        if ext:
            flags |= KEYEVENTF_EXTENDEDKEY
        inp.type = INPUT_KEYBOARD
        if sc:   # Scan-Code (lesen auch DirectX-Spiele); wVk zusätzlich, Windows ignoriert ihn dann
            inp.ki = KEYBDINPUT(vk, sc, flags | KEYEVENTF_SCANCODE, 0, MAGIC)
        else:
            inp.ki = KEYBDINPUT(vk, 0, flags, 0, MAGIC)
        _senden(inp)

    def maus_setzen(self, x, y):
        user32.SetCursorPos(int(x), int(y))

    def maus_pos(self):
        p = wintypes.POINT()
        user32.GetCursorPos(ctypes.byref(p))
        return p.x, p.y

    def piep(self, art):
        import winsound
        ton = {'start': [(660, 90), (880, 120)], 'stopp': [(880, 90), (520, 140)],
               'tick': [(700, 60)], 'fehler': [(300, 250)]}.get(art, [(600, 80)])

        def spielen():
            for f, d in ton:
                try:
                    winsound.Beep(f, d)
                except RuntimeError:
                    pass
        threading.Thread(target=spielen, daemon=True).start()
