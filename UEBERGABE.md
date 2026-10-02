# Tiefenrausch – Übergabe für neue Sitzungen

Stand: 2026-10-02. Zuerst diese Datei lesen, dann `index.html` nur gezielt (die Datei ist ~430 KB, sehr lange Zeilen).

## Der Nutzer
- Spricht Deutsch, ist kein Programmierer. Antworten **kurz, einfach, auf Deutsch**; Klick-Anleitungen **Schritt für Schritt** (eine Aktion pro Nachricht, Screenshots erbitten).
- Spielt auf dem **iPad** (Home-Bildschirm-App). Freunde spielen mit.
- GitHub-Konto `burgergoat23-cyber`, Admin-Name im Spiel `BurgerGoat44` (wird intern klein geschrieben: `burgergoat44`).

## Wo was liegt
- **Spiel online:** https://burgergoat23-cyber.github.io/Tiefenrausch/ (GitHub Pages, Branch `claude/tiefen-raush-code-review-jb306f`, Ordner `/`). Jeder Push ist nach ~2 Min. live.
- `index.html` – das ganze Spiel (eine Datei, Canvas, kein Build-Schritt). Ursprünglich aus dem claude.ai-Artifact „Tiefenrausch“ kopiert; das Artifact wird **nicht** mehr aktualisiert.
- `firestore.rules` – Firebase-Sicherheitsregeln. Nach jeder Änderung muss der **Nutzer** sie in der Konsole einfügen und veröffentlichen: https://console.firebase.google.com/project/tiefenrausch/firestore/rules (ganzen Text ersetzen → „Veröffentlichen“).
- `tests/` – Testprogramme (Playwright). `bash tests/run.sh` bzw. `bash tests/run.sh --firebase`.

## Firebase (Projekt `tiefenrausch`)
- Konfiguration steht im Code (`FB_CFG`), ist öffentlich und nicht geheim.
- Aktiv: **Authentication → E-Mail/Passwort**, **Firestore** (Standort europe-west3, Produktionsmodus + eigene Regeln). Gratis-Tarif (Spark).
- Konto = Firebase-Login mit `<name>@tiefenrausch.spiel` (Spieler sehen nur den Namen). Admin = E-Mail `burgergoat44@tiefenrausch.spiel` (in Regeln und Code `FB_OWNER`).
- Sammlungen: `data/users/<uid>/a_<name>` (Konto + Spielstände), `names/<name>`, `players/<uid>` (Admin-Panel), `banned/<uid>`, `daily/<uid>` (Tages-Rangliste), `top/<uid>` (Bestenliste tiefste Ebene), `rooms/<CODE>` (Koop-Verbindung).
- Der Firebase-Block ersetzt `window.claude` (Artifact-Laufzeit) durch einen Adapter (`fbDb`, `fbPack`: Daten als JSON-Text `_j` + einfache Felder). `FB_ON` auf jeder https-Seite (GitHub Pages, itch.io …); lokal als Datei = Gast. `EMB` = Spiel läuft in fremdem Rahmen (iframe) → Knopf „Im eigenen Fenster spielen“ (`#bo`, öffnet `HOME_URL`).

## Aufbau des Codes (Stichworte zum Suchen)
- Spielschleife `update(dt)`; Angriff `heroAttack()`, Aufheben `pickups(dt)`; Zeichnen `draw()` → `drawWorld`, `drawSorted`, HUD.
- Gegner: Grundtypen `k` 0–4, Bosse `k` 5–11 (`bossAI`). **Varianten** `VAR` (Feld `e.v`): eigener Name/Farbe/Fähigkeit (`varTick`), `pickEnemy` wählt nach Tiefe, `bossV`/`mkBoss` für neue Bosse ab Ebene 24. Warnkreis-Einschläge `zp`/`zap`.
- Waffen `WP` (nur **hinten anhängen**, Indizes stecken in Spielständen!), Feld `b` = Zeichenvorlage, `u` Einzelstück, `g` Göttlich, `x` Kosmisch. Seltenheiten `TN/TM/TC` (0 Gewöhnlich … 7 Kosmisch). Boss-Beute `bossTier`.
- Story: `STORY`, `SD`, `STN`; Dorfbewohner `VILL`, `placeVillager`, `rescueVillager` (Spielstand `rv`).
- Meta/Bestiarium: `meta` (`k`, `v`, `ach` …), `ACH`, `bookUI`.
- Konten/Login: `doAuth0`, `fbSign`, `initAuth`, `cloudSync`; Admin `admLoad`/`admRender`.
- **Koop** (`CO`): Gastgeber rechnet alles, zweiter Held `CO.p2`; Gegner zielen über `nearH`; Gast nutzt `guestUpdate` + Schnappschüsse (`coSnap`/`coRecv`). WebRTC-Datenkanäle `r` (zuverlässig) und `u` (schnell), Signalisierung über `rooms/<CODE>`. Lobby `drawLobby`. Koop-Läufe werden nicht gespeichert.
- **Antik-Stil (UI):** Schriften `FN` (Buchschrift Palatino/Georgia) und `FD` (eingebettete Zierschrift „Cinzel“, SIL OFL, als Base64 im Code). Bausteine: `chamf` (Ecken-Schnitt), `brz` (Bronze-Verlauf), `aqPat`/`texIn` (Stein-Muster), `orn` (Eck-Schnörkel), `gem`, `dmd`, `medal` (runde HUD-Plakette), `stoneBtn` (Knopf-Hintergrund für `btn`/`padBtn`), `potIcon` (Trank-Flaschen: Herz/Flamme/Blitz). `glass`, `stoneBtn`, `frame` zeichnen über den Zwischenspeicher `uiCache` (`UIC`, große Rahmen in `UIF`). Neutrale Knopffarben werden über `BTNC` zu warmem Stein. Fenster sind auf hohen Bildschirmen begrenzt (`mBox`, max. 780) und per `uiCenter` senkrecht mittig (verschiebt Trefferflächen mit, `UIOY` in `inBox`). Galerie aller Bildschirme: `node tests/gal.js <Ordner>`.
- **Titel-Hintergrund** `titleBG` (auch Ladebildschirm, „Bis bald“): Tempeltor vor Bergen bei Mondlicht. Ruhige Teile als Zwischenbilder `TBG.back`/`TBG.mid` (neu gebaut bei anderer Größe oder Menü-Lage `TLY`/`TMB`), bewegt: Mondstrahlen, Sternschnuppe (~6 s), Fledermäuse, Wolken, Torleuchten, Fackeln, Nebel, Glühwürmchen, Gras im Wind (weicht dem Finger aus), Herbstblätter, Funken beim Tippen (`TBG.sp`). Zeit über `performance.now()`. Tor entfällt, wenn unter dem Menü kein Platz ist (`tbgLay`).
- **Ladebildschirm** beim Start (~7 s, `LOADD`, Zähler `loadT`): zufällige Story-Szene (`LSC`, zeichnet Held + Boss mit `drawHero`/`drawEnemy`) und Tipp (`TIPS`), Funktionen `drawLoad`/`loadScene`. Sperrt Eingaben und Anmeldefenster. Testprogramme (Playwright) überspringen ihn, außer mit `#lade` in der Adresse (`tests/lade.js`).
- Update-Hinweis `updCheck` (vergleicht eigenen Code mit der Online-Version). **Achtung:** im Spielcode nie wörtlich `</script>` schreiben (sonst bricht die Seite) – z. B. `'</scr'+'ipt>'`.
- Übersetzung: alle Texte deutsch im Code, Englisch in `LANGS.en.d` (Schlüssel = deutscher Text). Neue Texte dort ergänzen (doppelte Schlüssel vermeiden).
- Bildschirm-Sicherungen: `resetTf()` setzt jedes Bild Maßstab/`save()`-Ebenen zurück; Figuren außerhalb des Bildes werden nicht gezeichnet; getönte Varianten über `spriteC` (Zwischenbild).

## Arbeitsweise
- Änderungen mit Python-Ersetzungen an **eindeutigen** Ankern (`assert s.count(anker)==1`), danach `node --check` und ESLint (`no-undef`, `no-dupe-keys`).
- Vor dem Push: `bash tests/run.sh` (bei Konten/Koop zusätzlich `--firebase`). Ehrlich sagen, was nur simuliert und nicht auf dem iPad geprüft wurde.
- Commits auf Deutsch, auf den Branch oben pushen.

## Andere Webseiten
- **itch.io:** ZIP mit nur `index.html` hochladen (Art: HTML, „This file will be played in the browser“). Nach jedem Update muss die ZIP dort **neu hochgeladen** werden (Update-Hinweis `updCheck` gibt es nur auf GitHub Pages).
- **CrazyGames** (später): keine eigene Anmeldung erlaubt, CrazyGames-SDK nötig → eigene Version bauen.

## Bisherige Updates (Kurzfassung)
1. Fehlerprüfung + Aufräumen (doppelte Funktionen), Tageslauf 1×/Tag, GitHub Pages.
2. Firebase-Konten, Rangliste, Admin-Panel, Bestenliste, Update-Hinweis.
3. Balance: Boss-Beute nach Tiefe, Lebensgrenze 12 Herzen, neue Waffen, Stufen Göttlich und Kosmisch.
4. 16 Gegner-Varianten, 6 neue Bosse, Dorfbewohner in der Story, Endlos tiefer schwerer.
5. Leistung (Culling, Tönungs-Cache), Bosse fairer (Rückstoß bei Berührung, Warnkreise), Koop für 2 Spieler.
6. Ladebildschirm beim Start mit Story-Szene und Tipp.
7. Antik-Stil für alle Menüs, HUD und Anmeldung; neue Trank-Symbole; Fenster auf dem iPad mittig.
8. Bewegter Hauptmenü-Hintergrund (Tempeltor, Mond, Gras, Blätter, Glühwürmchen).

## Offene Ideen / bekannte Grenzen
- Koop v1: nur Gastgeber kann Händler/NPCs nutzen; nur Endlos; kein TURN-Server (manche Netze blockieren).
- Bosse sind umgefärbte Varianten der vorhandenen Zeichnungen.
- Rangliste/Bestenliste werden im Browser berechnet (theoretisch fälschbar).
