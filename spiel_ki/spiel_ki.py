# /// script
# requires-python = "==3.12.*"
# dependencies = ["torch>=2.4", "numpy", "pillow", "mss>=9", "pynput>=1.7.6"]
# ///
"""Spiel-KI – bringt sich Spiele selbst bei.

Starten: START.bat doppelklicken (lädt beim ersten Mal alles Nötige).
Die KI schaut auf den markierten Bildschirmbereich, drückt die erlaubten Tasten und
lernt aus Belohnung (im Spiel bleiben, Punkte) und Strafe (verlieren). F8 = Start/Stopp.
"""
import glob
import os
import queue
import sys
import threading
import time
import traceback

HIER = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HIER)
import ki_kern as K  # noqa: E402

SPIELE = os.path.join(HIER, 'spiele')
LOG = os.path.join(HIER, 'fehler.log')


def log_fehler(text):
    try:
        with open(LOG, 'a', encoding='utf-8') as f:
            f.write(time.strftime('%Y-%m-%d %H:%M:%S ') + text + '\n')
    except OSError:
        pass


def tk_laden():
    import tkinter as tk
    try:
        return tk, tk.Tk()
    except tk.TclError:
        # manche Python-Pakete finden ihre Tcl/Tk-Dateien nicht von selbst
        for muster, var in (('tcl8*', 'TCL_LIBRARY'), ('tk8*', 'TK_LIBRARY')):
            for d in (glob.glob(os.path.join(sys.base_prefix, 'tcl', muster)) +
                      glob.glob(os.path.join(sys.base_prefix, 'lib', muster))):
                if os.path.isdir(d):
                    os.environ[var] = d
        return tk, tk.Tk()


FARBE = {'bg': '#f4f1ea', 'karte': '#ffffff', 'text': '#222222', 'leise': '#6b6b6b',
         'gruen': '#1f7a3a', 'rot': '#b3261e', 'blau': '#1d4f91', 'gelb': '#8a6d00',
         'balken': '#9cc3e6', 'linie': '#1d4f91'}


class App:
    def __init__(self, backend, tk, root):
        from tkinter import font as tkfont
        from tkinter import messagebox, simpledialog, ttk
        self.tk, self.root, self.ttk = tk, root, ttk
        self.msg, self.frage = messagebox, simpledialog
        self.backend = backend
        self.eingaben = K.Eingaben()
        self.q = queue.Queue()
        self.projekt = None
        self.takt = self.lern = self.lerner = self.speicher = None
        self.lerner_schluessel = None
        self.torch_bereit = False
        self._cd_job = None
        self.zu = False

        familien = set(tkfont.families())
        fam = 'Segoe UI' if 'Segoe UI' in familien else 'DejaVu Sans'
        self.f = {'n': (fam, 10), 'b': (fam, 10, 'bold'), 'k': (fam, 9),
                  'gross': (fam, 16, 'bold'), 'status': (fam, 12, 'bold')}
        root.title('Spiel-KI')
        root.configure(bg=FARBE['bg'])
        root.minsize(540, 560)
        st = ttk.Style(root)
        try:
            st.theme_use('clam')
        except tk.TclError:
            pass
        st.configure('.', font=self.f['n'])
        st.configure('TFrame', background=FARBE['bg'])
        st.configure('Karte.TLabelframe', background=FARBE['bg'])
        st.configure('Karte.TLabelframe.Label', font=self.f['b'], background=FARBE['bg'])
        st.configure('TLabel', background=FARBE['bg'])
        st.configure('TCheckbutton', background=FARBE['bg'])
        st.configure('Leise.TLabel', foreground=FARBE['leise'], font=self.f['k'])
        st.configure('Gross.TButton', font=self.f['status'], padding=8)
        self._bauen()
        root.protocol('WM_DELETE_WINDOW', self.schliessen)
        root.report_callback_exception = self._tk_fehler

        backend.start(self._taste_vom_haken, lambda vk: self.q.put(('hotkey', vk)))
        threading.Thread(target=self._torch_vorladen, daemon=True).start()
        self._projekte_laden()
        root.after(100, self._schleife)

    # ------------------------------------------------------------ Aufbau
    def _bauen(self):
        tk, ttk, r = self.tk, self.ttk, self.root
        haupt = ttk.Frame(r, padding=(14, 8))
        haupt.pack(fill='both', expand=True)
        kopf = ttk.Frame(haupt)
        kopf.pack(fill='x')
        ttk.Label(kopf, text='Spiel-KI', font=self.f['gross']).pack(side='left')
        ttk.Label(kopf, text='  bringt sich Spiele selbst bei', style='Leise.TLabel').pack(
            side='left', pady=(6, 0))

        zeile = ttk.Frame(haupt)
        zeile.pack(fill='x', pady=(6, 2))
        ttk.Label(zeile, text='Spiel:').pack(side='left')
        self.wahl = tk.StringVar()
        self.wahl_box = ttk.Combobox(zeile, textvariable=self.wahl, state='readonly', width=26)
        self.wahl_box.pack(side='left', padx=6)
        self.wahl_box.bind('<<ComboboxSelected>>', lambda e: self._projekt_waehlen(self.wahl.get()))
        ttk.Button(zeile, text='Neues Spiel …', command=self._neues_projekt).pack(side='left')

        # Erklärung (freiwillig): das Programm liest sie und stellt Tasten/Neustart passend ein
        k0 = ttk.LabelFrame(haupt, text=' Erklär das Spiel (freiwillig) ', style='Karte.TLabelframe',
                            padding=(8, 4))
        k0.pack(fill='x', pady=3)
        self.erkl = tk.Text(k0, height=2, width=40, wrap='word', font=self.f['n'], relief='solid', bd=1,
                            highlightthickness=0, padx=4, pady=2)
        self.erkl.pack(side='left', fill='x', expand=True)
        ttk.Button(k0, text='Übernehmen', command=self._erklaerung_uebernehmen).pack(
            side='right', padx=(6, 0), fill='y')
        self.erkl.bind('<FocusIn>', lambda e: self._erkl_fokus(True))
        self.erkl.bind('<FocusOut>', lambda e: self._erkl_fokus(False))
        self._erkl_leer = True

        # 1 Bereich
        k1 = ttk.LabelFrame(haupt, text=' 1 · Wo ist das Spiel? ', style='Karte.TLabelframe',
                            padding=(8, 4))
        k1.pack(fill='x', pady=3)
        self.bereich_txt = ttk.Label(k1, text='')
        self.bereich_txt.pack(side='left', fill='x', expand=True)
        ttk.Button(k1, text='Spielfeld markieren', command=self._bereich_waehlen).pack(side='right')

        # 2 Tasten
        k2 = ttk.LabelFrame(haupt, text=' 2 · Welche Tasten darf die KI drücken? (nur die nötigen) ', style='Karte.TLabelframe', padding=(8, 4))
        k2.pack(fill='x', pady=3)
        self.tasten_rahmen = ttk.Frame(k2)
        self.tasten_rahmen.pack(fill='x')
        self.fang_knopf = None
        self.tasten_vars = {}

        # 3 Verlieren
        k3 = ttk.LabelFrame(haupt, text=' 3 · Woran merkt sie, dass sie verloren hat? ',
                            style='Karte.TLabelframe', padding=(8, 4))
        k3.pack(fill='x', pady=3)
        self.still_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(k3, text=f'Wenn das Bild {K.STILL_SEK:.1f} Sekunden stehen bleibt'.replace('.', ','),
                        variable=self.still_var, command=self._einst_speichern).grid(
            row=0, column=0, columnspan=3, sticky='w')
        ttk.Label(k3, text='„Game Over“-Bild:').grid(row=1, column=0, sticky='w', pady=1)
        self.go_txt = ttk.Label(k3, text='')
        self.go_txt.grid(row=1, column=1, sticky='w', padx=6)
        gz = ttk.Frame(k3)
        gz.grid(row=1, column=2, sticky='e')
        ttk.Button(gz, text='Markieren', command=self._gameover_waehlen).pack(side='left')
        ttk.Button(gz, text='Löschen', command=self._gameover_loeschen).pack(side='left', padx=(4, 0))
        ttk.Label(k3, text='Neustart mit:').grid(row=2, column=0, sticky='w', pady=1)
        self.neustart_var = tk.StringVar()
        self.neustart_box = ttk.Combobox(k3, textvariable=self.neustart_var, state='readonly',
                                         width=30, values=[n for n, _ in K.NEUSTARTS])
        self.neustart_box.grid(row=2, column=1, columnspan=2, sticky='w', padx=6)
        self.neustart_box.bind('<<ComboboxSelected>>', lambda e: self._einst_speichern())
        ttk.Label(k3, text='Punkte (freiwillig):').grid(row=3, column=0, sticky='w', pady=1)
        self.pk_txt = ttk.Label(k3, text='')
        self.pk_txt.grid(row=3, column=1, sticky='w', padx=6)
        pz = ttk.Frame(k3)
        pz.grid(row=3, column=2, sticky='e')
        ttk.Button(pz, text='Markieren', command=self._punkte_waehlen).pack(side='left')
        ttk.Button(pz, text='Löschen', command=self._punkte_loeschen).pack(side='left', padx=(4, 0))
        k3.columnconfigure(1, weight=1)

        # 4 Üben
        k4 = ttk.LabelFrame(haupt, text=' 4 · Üben lassen ', style='Karte.TLabelframe',
                            padding=(8, 4))
        k4.pack(fill='both', expand=True, pady=3)
        self.start_knopf = ttk.Button(k4, text='▶  Üben starten  (F8)', style='Gross.TButton',
                                      command=self._start_knopf)
        self.start_knopf.pack(fill='x')
        self.status = tk.Label(k4, text='Lade KI-Bausteine …', font=self.f['status'],
                               bg=FARBE['bg'], fg=FARBE['leise'], anchor='w', justify='left',
                               wraplength=480)
        self.status.pack(fill='x', pady=(6, 0))
        self.zahlen = ttk.Label(k4, text='', wraplength=480)
        self.zahlen.pack(fill='x')
        self.bild = tk.Canvas(k4, height=70, bg=FARBE['karte'], highlightthickness=1,
                              highlightbackground='#d8d2c4')
        self.bild.pack(fill='both', expand=True, pady=(4, 3))
        u = ttk.Frame(k4)
        u.pack(fill='x')
        ttk.Button(u, text='Gelerntes löschen', command=self._gehirn_loeschen).pack(side='right')
        ttk.Label(u, text='Klick ins Spiel und drück F8. Nochmal F8 = sofort Stopp.',
                  style='Leise.TLabel').pack(side='left')

        ttk.Label(haupt, text='⚠  Nur für Spiele ohne andere Spieler – in Online-Spielen sind '
                  'Bots verboten (Sperre!).', style='Leise.TLabel').pack(fill='x', pady=(4, 0))

    # ------------------------------------------------------------ Projekte
    def _projekte_laden(self, waehle=None):
        os.makedirs(SPIELE, exist_ok=True)
        namen = K.projekte(SPIELE)
        if not namen:
            os.makedirs(os.path.join(SPIELE, 'Mein Spiel'), exist_ok=True)
            namen = ['Mein Spiel']
        self.wahl_box['values'] = namen
        waehle = waehle if waehle in namen else namen[0]
        self.wahl.set(waehle)
        self._projekt_waehlen(waehle)

    def _projekt_waehlen(self, name):
        if self.laeuft():
            self.wahl.set(self.projekt.name)
            return
        self.projekt = K.Projekt(os.path.join(SPIELE, name))
        self.lerner = self.speicher = self.lerner_schluessel = None
        self._anzeigen()

    def _neues_projekt(self):
        if self.laeuft():
            return
        name = self.frage.askstring('Neues Spiel', 'Wie heißt das Spiel?', parent=self.root)
        name = K.projekt_name_ok(name or '')
        if not name:
            return
        os.makedirs(os.path.join(SPIELE, name), exist_ok=True)
        self._projekte_laden(name)

    # ------------------------------------------------------------ Anzeige
    def _anzeigen(self):
        p = self.projekt
        b = p.info.get('bereich')
        self.bereich_txt.config(text=f'Markiert: {b[2]} × {b[3]} Pixel' if b else
                                'Noch nicht markiert – zieh einen Rahmen um das Spielfeld.')
        for w in self.tasten_rahmen.winfo_children():
            w.destroy()
        self.tasten_vars = {}
        an = set(p.info.get('tasten', []))
        liste = list(K.VORSCHLAG) + sorted(an - set(K.VORSCHLAG))
        for i, vk in enumerate(liste):
            v = self.tk.BooleanVar(value=vk in an)
            self.tasten_vars[vk] = v
            self.ttk.Checkbutton(self.tasten_rahmen, text=K.tasten_name(vk), variable=v,
                                 command=lambda vk=vk: self._taste_umschalten(vk)).grid(
                row=i // 7, column=i % 7, sticky='w', padx=(0, 10))
        n = len(liste)
        self.fang_knopf = self.ttk.Button(self.tasten_rahmen, text='Andere Taste …',
                                          command=self._taste_fangen)
        self.fang_knopf.grid(row=n // 7, column=n % 7, columnspan=7 - n % 7, sticky='w')
        self._erkl_setzen(p.info.get('erklaerung', ''))
        self.still_var.set(bool(p.info.get('stillstand', True)))
        ns = p.info.get('neustart', 'vk:32')
        self.neustart_var.set(next((n for n, c in K.NEUSTARTS if c == ns), K.NEUSTARTS[0][0]))
        n_go = len(p.info.get('gameover', []))
        self.go_txt.config(text=f'{n_go} markiert' if n_go else 'keins (freiwillig)')
        self.pk_txt.config(text='markiert' if p.info.get('punkte') else 'nicht markiert')
        self._zahlen_zeigen()

    def _zahlen_zeigen(self):
        if self.lerner is not None:
            st = K.statistik(self.lerner)
        else:
            st = self.projekt.info.get('statistik') if self.projekt.hat_modell() else None
        if not st or not st.get('runden'):
            self.zahlen.config(text='Noch nichts gelernt.' if not st else
                               f'Geübt: {st["zeit"] // 60} min · noch keine Runde fertig')
            self._kurve([])
            return
        verlauf = st['verlauf']
        letzte = sum(verlauf[-10:]) / len(verlauf[-10:])
        self.zahlen.config(
            text=f'Runden: {st["runden"]}  ·  zuletzt im Schnitt {letzte:.1f} s  ·  '
                 f'Bestwert {st["best"]:.1f} s  ·  geübt {st["zeit"] // 60} min  ·  '
                 f'probiert noch zufällig: {st["zufall"] * 100:.0f} %'.replace('.', ','))
        self._kurve(verlauf)

    def _kurve(self, werte):
        c = self.bild
        c.delete('all')
        w, h = max(c.winfo_width(), 300), max(c.winfo_height(), 100)
        c.create_text(8, 6, anchor='nw', text='Sekunden pro Runde', fill=FARBE['leise'],
                      font=self.f['k'])
        if not werte:
            c.create_text(w // 2, h // 2, text='Hier siehst du, wie die KI besser wird.',
                          fill=FARBE['leise'], font=self.f['n'])
            return
        werte = werte[-150:]
        oben = max(max(werte), 1.0) * 1.1
        x0, y0, y1 = 8, 22, h - 8
        bw = (w - 16) / max(len(werte), 20)
        for i, v in enumerate(werte):
            x = x0 + i * bw
            c.create_rectangle(x, y1 - (y1 - y0) * v / oben, x + max(bw - 1, 1), y1,
                               fill=FARBE['balken'], width=0)
        pts = []
        for i in range(len(werte)):
            fenster = werte[max(0, i - 9):i + 1]
            pts += [x0 + i * bw + bw / 2, y1 - (y1 - y0) * (sum(fenster) / len(fenster)) / oben]
        if len(pts) >= 4:
            c.create_line(*pts, fill=FARBE['linie'], width=2, smooth=True)
        c.create_text(w - 8, 6, anchor='ne', text=f'max {max(werte):.1f} s'.replace('.', ','),
                      fill=FARBE['leise'], font=self.f['k'])

    def _status(self, text, farbe='text'):
        self.status.config(text=text, fg=FARBE[farbe])

    # ------------------------------------------------------------ Einstellungen
    def _tasten_aendern(self, neu):
        """Neue Tastenauswahl übernehmen (fragt nach, wenn schon gelernt wurde)."""
        if self.laeuft():
            return False
        neu = sorted(set(neu))
        alt = self.projekt.gehirn_tasten()
        if alt and neu != alt:
            if not self.msg.askyesno('Andere Tasten', 'Mit anderen Tasten muss die KI von vorne '
                                     'anfangen. Das bisher Gelernte geht verloren. Trotzdem ändern?',
                                     parent=self.root):
                return False
            self.projekt.gehirn_loeschen()
        self.projekt.info['tasten'] = neu
        self.projekt.speichern()
        self.lerner = self.speicher = self.lerner_schluessel = None
        self._zahlen_zeigen()
        return True

    def _taste_umschalten(self, vk):
        neu = [k for k, v in self.tasten_vars.items() if v.get()]
        if not self._tasten_aendern(neu):
            self.tasten_vars[vk].set(not self.tasten_vars[vk].get())

    def _taste_fangen(self):
        if self.laeuft():
            return
        self.fang_knopf.config(text='Drück jetzt die Taste …')
        self.eingaben.fangen = lambda vk: self.q.put(('gefangen', vk))

    def _einst_speichern(self):
        p = self.projekt
        p.info['stillstand'] = bool(self.still_var.get())
        p.info['neustart'] = dict(K.NEUSTARTS).get(self.neustart_var.get(), 'vk:32')
        p.speichern()

    # ------------------------------------------------------------ Erklärung
    BEISPIEL = ('Zum Beispiel: Mit Leertaste springen, mit Pfeil runter ducken. '
                'Nach Game Over mit Leertaste neu starten.')

    def _erkl_setzen(self, text):
        self.erkl.delete('1.0', 'end')
        self._erkl_leer = not text
        self.erkl.insert('1.0', text or self.BEISPIEL)
        self.erkl.config(fg=FARBE['leise'] if self._erkl_leer else FARBE['text'])

    def _erkl_fokus(self, rein):
        if rein and self._erkl_leer:
            self.erkl.delete('1.0', 'end')
            self.erkl.config(fg=FARBE['text'])
            self._erkl_leer = False
        elif not rein and not self.erkl.get('1.0', 'end').strip():
            self._erkl_setzen('')

    def _erkl_text(self):
        return '' if self._erkl_leer else self.erkl.get('1.0', 'end').strip()

    def _erklaerung_uebernehmen(self):
        if self.laeuft():
            self._status('Erst stoppen (F8), dann die Erklärung übernehmen.', 'rot')
            return
        p, text = self.projekt, self._erkl_text()
        p.info['erklaerung'] = text
        e = K.erklaerung_verstehen(text)
        teile, tipps = [], []
        if e['tasten']:
            if self._tasten_aendern(e['tasten']):
                teile.append('Tasten ' + ', '.join(K.tasten_name(v) for v in e['tasten']))
            else:
                teile.append('Tasten nicht geändert')
        if e['neustart'] is not None:
            p.info['neustart'] = e['neustart']
            teile.append('Neustart: ' + next((n for n, c in K.NEUSTARTS if c == e['neustart']),
                                             e['neustart']))
        if e['stillstand']:
            p.info['stillstand'] = True
            teile.append('Verloren = Bild bleibt stehen')
        if e['gameover_erwaehnt'] and not p.info.get('gameover'):
            tipps.append('Markier das „Game Over“-Bild (Schritt 3).')
        if e['punkte_erwaehnt'] and not p.info.get('punkte'):
            tipps.append('Markier die Punkte-Anzeige (Schritt 3).')
        p.speichern()
        self._anzeigen()
        if not teile:
            self._status('Ich habe keine Tasten gefunden. Schreib zum Beispiel: '
                         '„Mit Leertaste springen, mit A und D laufen.“', 'rot')
        else:
            self._status('Verstanden: ' + ' · '.join(teile) +
                         ('\nTipp: ' + ' '.join(tipps) if tipps else ''), 'blau')

    def _gehirn_loeschen(self):
        if self.laeuft():
            return
        if self.msg.askyesno('Gelerntes löschen', 'Soll die KI alles vergessen und von vorne '
                             'anfangen?', parent=self.root):
            self.projekt.gehirn_loeschen()
            self.lerner = self.speicher = self.lerner_schluessel = None
            self._anzeigen()

    # ------------------------------------------------------------ Rahmen ziehen
    def _rahmen(self, text, fertig):
        """Durchsichtige Fläche über dem Bildschirm; der Nutzer zieht einen Rahmen."""
        if self.laeuft():
            return
        tk = self.tk
        self.root.iconify()
        x, y, w, h = self.backend.gesamtbildschirm()

        def zeigen():
            top = tk.Toplevel(self.root)
            top.overrideredirect(True)
            top.attributes('-topmost', True)
            try:
                top.attributes('-alpha', 0.35)
            except tk.TclError:
                pass
            top.geometry(f'{w}x{h}+{x}+{y}')
            c = tk.Canvas(top, bg='black', highlightthickness=0, cursor='crosshair')
            c.pack(fill='both', expand=True)
            c.create_text(w // 2, 60, text=text + '\n(Esc = abbrechen)', fill='white',
                          font=self.f['gross'], justify='center')
            zustand = {}

            def runter(e):
                zustand['a'] = (e.x_root, e.y_root)
                zustand['id'] = c.create_rectangle(e.x, e.y, e.x, e.y, outline='#ffd400', width=3)

            def ziehen(e):
                if 'a' in zustand:
                    ax, ay = zustand['a']
                    c.coords(zustand['id'], ax - x, ay - y, e.x, e.y)

            def hoch(e):
                if 'a' not in zustand:
                    return
                ax, ay = zustand['a']
                r = (min(ax, e.x_root), min(ay, e.y_root), abs(e.x_root - ax), abs(e.y_root - ay))
                top.destroy()
                self.root.after(300, lambda: self._rahmen_fertig(fertig, r))

            def abbruch(e=None):
                top.destroy()
                self.root.deiconify()

            c.bind('<ButtonPress-1>', runter)
            c.bind('<B1-Motion>', ziehen)
            c.bind('<ButtonRelease-1>', hoch)
            top.bind('<Escape>', abbruch)
            top.focus_force()

        self.root.after(400, zeigen)

    def _rahmen_fertig(self, fertig, r):
        try:
            if r[2] < 8 or r[3] < 8:
                self.msg.showinfo('Zu klein', 'Der Rahmen war zu klein. Bitte nochmal ziehen.',
                                  parent=self.root)
            else:
                fertig(r)
        finally:
            self.root.deiconify()
            self._anzeigen()

    def _relativ(self, r):
        b = self.projekt.info.get('bereich')
        if not b:
            self.msg.showinfo('Erst das Spielfeld', 'Markier zuerst das Spielfeld (Schritt 1).',
                              parent=self.root)
            return None
        x0, y0 = max(r[0], b[0]), max(r[1], b[1])
        x1, y1 = min(r[0] + r[2], b[0] + b[2]), min(r[1] + r[3], b[1] + b[3])
        if x1 - x0 < 4 or y1 - y0 < 4:
            self.msg.showinfo('Außerhalb', 'Der Rahmen muss im Spielfeld liegen.', parent=self.root)
            return None
        return [(x0 - b[0]) / b[2], (y0 - b[1]) / b[3], (x1 - x0) / b[2], (y1 - y0) / b[3]]

    def _bereich_waehlen(self):
        def fertig(r):
            self.projekt.info['bereich'] = [int(v) for v in r]
            self.projekt.speichern()
        self._rahmen('Zieh einen Rahmen um das Spielfeld', fertig)

    def _gameover_waehlen(self):
        if not self.projekt.info.get('bereich'):
            self._relativ((0, 0, 0, 0))
            return
        if not self.msg.askokcancel('„Game Over“-Bild', 'Lass das Spiel einmal verlieren, sodass '
                                    '„Game Over“ (oder der Neustart-Knopf) zu sehen ist.\n\nDann OK '
                                    'drücken und einen engen Rahmen um diese Schrift ziehen.',
                                    parent=self.root):
            return

        def fertig(r):
            rel = self._relativ(r)
            if rel is None:
                return
            b = self.projekt.info['bereich']
            ganz = self.backend.bild(b)
            self.projekt.gameover_hinzu(rel, ganz.crop((
                int(rel[0] * b[2]), int(rel[1] * b[3]),
                int((rel[0] + rel[2]) * b[2]), int((rel[1] + rel[3]) * b[3]))))
        self._rahmen('Zieh einen engen Rahmen um „Game Over“', fertig)

    def _gameover_loeschen(self):
        self.projekt.gameover_loeschen()
        self._anzeigen()

    def _punkte_waehlen(self):
        def fertig(r):
            rel = self._relativ(r)
            if rel is not None:
                self.projekt.info['punkte'] = rel
                self.projekt.speichern()
        self._rahmen('Zieh einen Rahmen um die Punkte-Anzeige', fertig)

    def _punkte_loeschen(self):
        self.projekt.info['punkte'] = None
        self.projekt.speichern()
        self._anzeigen()

    # ------------------------------------------------------------ Üben
    def laeuft(self):
        return self.takt is not None

    def _start_knopf(self):
        if self.laeuft():
            self.stoppen()
        elif self._cd_job:
            self._cd_abbrechen()
            self._status('Abgebrochen.', 'leise')
        elif self._bereit_pruefen():
            self._countdown(3)

    def _countdown(self, n):
        if n == 0:
            self._cd_job = None
            self.starten()
            return
        self.backend.piep('tick')
        self._status(f'Klick jetzt ins Spiel!  Start in {n} …', 'gelb')
        self._cd_job = self.root.after(1000, lambda: self._countdown(n - 1))

    def _cd_abbrechen(self):
        if self._cd_job:
            self.root.after_cancel(self._cd_job)
            self._cd_job = None

    def _bereit_pruefen(self):
        p = self.projekt
        fehlt = None
        if not self.torch_bereit:
            fehlt = 'Die KI-Bausteine laden noch. Einen Moment bitte.'
        elif not p.info.get('bereich'):
            fehlt = 'Markier zuerst das Spielfeld (Schritt 1).'
        elif not p.info.get('tasten'):
            fehlt = 'Hak mindestens eine Taste an (Schritt 2).'
        elif not p.info.get('stillstand') and not p.info.get('gameover'):
            fehlt = 'Die KI muss merken können, wann sie verloren hat (Schritt 3).'
        if fehlt:
            self.backend.piep('fehler')
            self._status(fehlt, 'rot')
            return False
        return True

    def starten(self):
        self._cd_abbrechen()
        if self.laeuft() or not self._bereit_pruefen():
            return
        p = self.projekt
        hwnd = self.backend.vorne()
        grund = self.backend.fenster_pruefen(hwnd, p.info['bereich'])
        if grund:
            self.backend.piep('fehler')
            self._status(grund, 'rot')
            return
        schluessel = (p.name, tuple(p.aktionen()))
        if self.lerner is None or self.lerner_schluessel != schluessel:
            self.lerner = K.Lerner(p, p.aktionen(),
                                   threads=max(1, min(4, (os.cpu_count() or 2) // 2)))
            self.speicher = K.Speicher()
            self.lerner_schluessel = schluessel
        self.eingaben.fangen = None
        ue = K.Ueben(self.backend, self.eingaben, hwnd, p.info['bereich'], p, self.lerner,
                     self.speicher)
        self.ueben = ue
        self.lern = K.LernThread(self.lerner, self.speicher)
        self.takt = K.Takt(ue)
        self.lern.start()
        self.takt.start()
        self.backend.piep('start')
        self.start_knopf.config(text='■  Stopp  (F8)')
        self._status('KI übt …', 'gruen')

    def stoppen(self):
        if not self.laeuft():
            return
        self.takt.stopp()
        self.lern.stopp()
        self.backend.piep('stopp')
        self._status('Speichere das Gelernte …', 'leise')

    def _aufraeumen(self):
        fehler = self.takt.fehler or self.lern.fehler
        langsam = self.takt.zu_langsam
        self.takt = self.lern = None
        self.start_knopf.config(text='▶  Üben starten  (F8)')
        if fehler:
            log_fehler(''.join(traceback.format_exception(fehler)))
            self._status(f'Fehler: {fehler}  (Details in fehler.log)', 'rot')
        else:
            self._status('Gestoppt. Gelerntes ist gespeichert.' +
                         ('  Hinweis: Der PC war oft zu langsam.' if langsam > 100 else ''),
                         'blau')
        self._zahlen_zeigen()

    # ------------------------------------------------------------ Ereignisse
    def _taste_vom_haken(self, vk, unten, scan, ext):
        self.eingaben.ereignis(vk, unten, scan, ext)

    def _torch_vorladen(self):
        try:
            import torch  # noqa: F401
            K.baue_netz(4)
            self.q.put(('bereit', None))
        except Exception as e:   # noqa: BLE001
            self.q.put(('torch_fehler', e))

    def _schleife(self):
        if self.zu:
            return
        try:
            while True:
                art, wert = self.q.get_nowait()
                if art == 'hotkey' and wert == K.F8:
                    if self.laeuft():
                        self.stoppen()
                    else:
                        self.starten()
                elif art == 'gefangen':
                    self.fang_knopf.config(text='Andere Taste …')
                    tasten = self.projekt.info.get('tasten', [])
                    if wert not in K.NIE and wert not in K.MAUS and wert not in tasten:
                        self.projekt.scan_merken(self.eingaben.scan)
                        if self._tasten_aendern(tasten + [wert]):
                            self._anzeigen()
                elif art == 'bereit':
                    self.torch_bereit = True
                    self._status('Bereit. Klick ins Spiel und drück F8.', 'text')
                elif art == 'torch_fehler':
                    log_fehler(''.join(traceback.format_exception(wert)))
                    self._status(f'KI-Bausteine fehlen: {wert}', 'rot')
        except queue.Empty:
            pass
        if self.takt is not None:
            if not self.takt.is_alive() and not self.lern.is_alive():
                self._aufraeumen()
            elif self.takt.is_alive():
                farbe = 'gelb' if 'pausiert' in self.ueben.status or 'Du ' in self.ueben.status \
                    else 'gruen'
                self._status(self.ueben.status, farbe)
                if int(time.monotonic() * 2) % 4 == 0:
                    self._zahlen_zeigen()
        self.root.after(250, self._schleife)

    def _tk_fehler(self, typ, wert, tb):
        log_fehler(''.join(traceback.format_exception(typ, wert, tb)))
        self._status(f'Fehler: {wert}  (Details in fehler.log)', 'rot')

    def schliessen(self):
        if self.laeuft():
            self.takt.stopp()
            self.lern.stopp()
            self.takt.join(3)
            self.lern.join(15)   # Gelerntes speichern
        self.zu = True
        self.backend.stopp()
        self.root.destroy()


def main():
    if sys.platform != 'win32':
        print('Die Spiel-KI läuft nur unter Windows.')
        sys.exit(1)
    # Die großen KI-Bausteine VOR dem Fenster laden: beim ersten Mal prüft der Virenscanner
    # die Dateien (kann 1–2 Minuten dauern). Liefe das neben dem Fenster, hinge das Fenster
    # ("reagiert nicht") und Tastendrücke am ganzen PC würden verzögert.
    print('  Lade die KI-Bausteine ... beim ersten Mal kann das 1-2 Minuten dauern.', flush=True)
    t0 = time.time()
    try:
        import torch  # noqa: F401
        K.baue_netz(4)
    except Exception:
        log_fehler(traceback.format_exc())
        raise
    print(f'  Fertig ({time.time() - t0:.0f} s). Das Fenster "Spiel-KI" geht jetzt auf.', flush=True)
    print('  Dieses schwarze Fenster bitte offen lassen.', flush=True)
    import ki_windows
    ki_windows.dpi_bewusst()
    tk, root = tk_laden()
    try:
        App(ki_windows.WindowsBackend(), tk, root)
        root.mainloop()
    except Exception:
        log_fehler(traceback.format_exc())
        raise


if __name__ == '__main__':
    main()
