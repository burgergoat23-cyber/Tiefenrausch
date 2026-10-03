# Tiefenrausch – Übergabe für neue Sitzungen

Stand: 2026-10-03. Zuerst diese Datei lesen, dann `index.html` nur gezielt (die Datei ist ~430 KB, sehr lange Zeilen).

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
- Konten/Login: `doAuth0`, `fbSign`, `initAuth`, `cloudSync`; Admin `admLoad`/`admRender` (unten: Bestenliste Top 30 + Tageslauf heute inkl. Gäste, „Eintrag löschen“/„Sperren“, `admAct` Arten `top`/`lb`/`ban`).
- **Koop** (`CO`): Gastgeber rechnet alles, zweiter Held `CO.p2`; Gegner zielen über `nearH`; Gast nutzt `guestUpdate` + Schnappschüsse (`coSnap`/`coRecv`). WebRTC-Datenkanäle `r` (zuverlässig) und `u` (schnell), Signalisierung über `rooms/<CODE>`. Lobby `drawLobby`. Koop-Läufe werden nicht gespeichert.
- **Antik-Stil (UI):** Schriften `FN` (Buchschrift Palatino/Georgia) und `FD` (eingebettete Zierschrift „Cinzel“, SIL OFL, als Base64 im Code). Bausteine: `chamf` (Ecken-Schnitt), `brz` (Bronze-Verlauf), `aqPat`/`texIn` (Stein-Muster), `orn` (Eck-Schnörkel), `gem`, `dmd`, `medal` (runde HUD-Plakette), `stoneBtn` (Knopf-Hintergrund für `btn`/`padBtn`), `potIcon` (Trank-Flaschen: Herz/Flamme/Blitz). `glass`, `stoneBtn`, `frame` zeichnen über den Zwischenspeicher `uiCache` (`UIC`, große Rahmen in `UIF`). Neutrale Knopffarben werden über `BTNC` zu warmem Stein. Fenster sind auf hohen Bildschirmen begrenzt (`mBox`, max. 780) und per `uiCenter` senkrecht mittig (verschiebt Trefferflächen mit, `UIOY` in `inBox`). Galerie aller Bildschirme: `node tests/gal.js <Ordner>`.
- **Titel-Hintergrund** `titleBG` (auch Ladebildschirm, „Bis bald“): Tempeltor vor Bergen bei Mondlicht. Ruhige Teile als Zwischenbilder `TBG.back`/`TBG.mid` (neu gebaut bei anderer Größe oder Menü-Lage `TLY`/`TMB`), bewegt: Mondstrahlen, Sternschnuppe (~6 s), Fledermäuse, Wolken, Torleuchten, Fackeln, Nebel, Glühwürmchen, Gras im Wind (weicht dem Finger aus), Herbstblätter, Funken beim Tippen (`TBG.sp`). Zeit über `performance.now()`. Tor entfällt, wenn unter dem Menü kein Platz ist (`tbgLay`).
- **Ladebildschirm** beim Start (~7 s, `LOADD`, Zähler `loadT`): zufällige Story-Szene (`LSC`, zeichnet Held + Boss mit `drawHero`/`drawEnemy`) und Tipp (`TIPS`), Funktionen `drawLoad`/`loadScene`. Sperrt Eingaben und Anmeldefenster. Testprogramme (Playwright) überspringen ihn, außer mit `#lade` in der Adresse (`tests/lade.js`).
- **Gast-Rangliste** (auch CrazyGames): `LB_ON` = Ranglisten erreichbar (GitHub Pages und CrazyGames über https). Gäste melden sich unsichtbar **anonym** bei Firebase an (`gUid`, Firebase-Anbieter „Anonym“ muss in der Konsole aktiv sein) und wählen einen Namen im HTML-Fenster `#gn` (`gnAsk`, `gnCheck` mit Schimpfwort-Filter `GBAD` und `RES`). Name in `dg_gname`. Einträge in `daily/<uid>` und `top/<uid>` mit `g:true`, Anzeige „Name (Gast)“ (`lbNm`, `lbMe`). Regeln: `anon()`/`guestMark()` – Gäste dürfen nur in die Ranglisten, Konten dürfen kein `g` setzen. Gast-Rekord `gTop` (nur bei neuem Rekord, `dg_gtb`). `small(n)` in den Regeln zählt seit Update 10 die Felder (`request.resource.data.size()`), vorher wirkte die Grenze nicht. CrazyGames schlägt den Namen aus dem CrazyGames-Konto vor (`cgSDK.user.getUser`).
- **Teilen** nach dem Tageslauf (`shareRun`, `shareTxt`: Systemmenü, sonst Zwischenablage; nicht auf CrazyGames). **Koop-Einladung per Link** `…/Tiefenrausch/#koop=CODE` (`coInv`, `coInvGo`, Knopf in der Lobby `coShare`). **Link-Vorschau** über `og:image` = `promo/og.jpg` (1200×630).
- Update-Hinweis `updCheck` (vergleicht eigenen Code mit der Online-Version). **Achtung:** im Spielcode nie wörtlich `</script>` schreiben (sonst bricht die Seite) – z. B. `'</scr'+'ipt>'`.
- Übersetzung: alle Texte deutsch im Code, Englisch in `LANGS.en.d` (Schlüssel = deutscher Text). Neue Texte dort ergänzen (doppelte Schlüssel vermeiden).
- Bildschirm-Sicherungen: `resetTf()` setzt jedes Bild Maßstab/`save()`-Ebenen zurück; Figuren außerhalb des Bildes werden nicht gezeichnet; getönte Varianten über `spriteC` (Zwischenbild).

## Arbeitsweise
- Änderungen mit Python-Ersetzungen an **eindeutigen** Ankern (`assert s.count(anker)==1`), danach `node --check` und ESLint (`no-undef`, `no-dupe-keys`).
- Vor dem Push: `bash tests/run.sh` (bei Konten/Koop zusätzlich `--firebase`). Ehrlich sagen, was nur simuliert und nicht auf dem iPad geprüft wurde.
- Commits auf Deutsch, auf den Branch oben pushen.

## Andere Webseiten
- **itch.io:** ZIP bauen mit `python3 tools/build_itch.py` → `downloads/tiefenrausch_itch.zip` (online unter …/Tiefenrausch/downloads/). ZIP mit nur `index.html` hochladen (Art: HTML, „This file will be played in the browser“). Nach jedem Update muss die ZIP dort **neu hochgeladen** werden (Update-Hinweis `updCheck` gibt es nur auf GitHub Pages).
- **CrazyGames:** eigene Version mit `python3 tools/build_crazygames.py [Ordner]` (setzt `window.TR_CG`, lädt `crazygames-sdk-v3.js`, erzeugt ZIP). Im Code `CG`: kein Firebase/Anmeldung, kein Koop, keine Ranglisten-/Beenden-Knöpfe, kein Fremd-Link, Ladebildschirm 4 s. SDK-Aufrufe in `cgTick` (loadingStart/Stop, gameplayStart/Stop) und `cgHappy` (Boss besiegt). Werbung noch nicht eingebaut. Test: `node tests/crazy.js` (SDK-Attrappe), Gast-Rangliste auf CrazyGames in `tests/fb/gast_t.js`. Fertige ZIP zum Herunterladen: `downloads/tiefenrausch_crazygames.zip`. Das echte SDK konnte in der Sitzung nicht geladen werden (Netz gesperrt) → nach dem Hochladen im CrazyGames-Entwicklerportal mit deren Prüf-Werkzeug testen.

## Stand Werbung & Plattformen (3.10.2026)
- **itch.io:** https://burgergoat44.itch.io/tiefenrausch (öffentlich, Devlog + Forum-Beitrag „Release Announcements“). Noch nicht in der itch-Suche (neue Konten werden erst indexiert). Hochgeladene ZIP ist **älter** als die Firebase-Sparänderung → bei Gelegenheit neue ZIP (nur index.html) bauen und hochladen.
- **CrazyGames:** eingereicht am 3.10., Status „Awaiting review“ (Basic Launch). Build: `python3 tools/build_crazygames.py`. QA-Werkzeug zeigte Loading Start/Stop grün. Titelbilder/Videos unter `promo/` (online: …/Tiefenrausch/promo/). Developer-Portal geht am iPad schlecht → Nutzer nimmt den PC.
- **X:** Konto @promoter4you4, Posten über Typefully scheitert (X sperrt Links bzw. Konto nicht freigegeben) → Nutzer postet selbst in der App.
- **E-Mails an Spiele-Seiten (Gmail-Connector, nur geprüfte Einsende-Adressen, max. ~5/Tag, nie zweimal an dieselbe):** Alpha Beta Gamer, Indie Games Plus, Indie Game Buzz, Gamezebo, Indie Game Magazine, Destructoid, GameGrin, GameRamble, Twinfinite, DarkZero, ZTGD, The Reticule (unzustellbar), 1ndieWorld, Games Aktuell, The Indie Game Website (pr@), indiegames.ch, GAME60 Magazine, Indie Game Atlas, Fix Gaming Channel, RETRONUKE, Indie Game of the Week, BrewOtaku. Noch keine Antworten.
- **Nicht machen:** Massen-Mails an ungeprüfte Adressen, Bots/Auto-Posts in fremde Gruppen (Konto-Sperre, Spam). Nutzer ist vermutlich minderjährig → bei Konten/Verträgen/Geld auf Eltern hinweisen.
- **Firebase:** Statistik-Sync nur noch 1×/Minute (`saveMeta` 60 s, `cloudFlush` beim Verlassen), Ping 120 s. Gratis-Tarif ~20 000 Schreibvorgänge/Tag – Nutzer hatte 8 000 an einem Tag.
- **Ideen für später:** CrazyGames-Werbung (SDK ads) nach Freigabe, Game Jolt/Newgrounds. (Teilen, Koop-Link, Vorschaubild sind seit Update 10 drin.)

## Bisherige Updates (Kurzfassung)
1. Fehlerprüfung + Aufräumen (doppelte Funktionen), Tageslauf 1×/Tag, GitHub Pages.
2. Firebase-Konten, Rangliste, Admin-Panel, Bestenliste, Update-Hinweis.
3. Balance: Boss-Beute nach Tiefe, Lebensgrenze 12 Herzen, neue Waffen, Stufen Göttlich und Kosmisch.
4. 16 Gegner-Varianten, 6 neue Bosse, Dorfbewohner in der Story, Endlos tiefer schwerer.
5. Leistung (Culling, Tönungs-Cache), Bosse fairer (Rückstoß bei Berührung, Warnkreise), Koop für 2 Spieler.
6. Ladebildschirm beim Start mit Story-Szene und Tipp.
7. Antik-Stil für alle Menüs, HUD und Anmeldung; neue Trank-Symbole; Fenster auf dem iPad mittig.
8. Bewegter Hauptmenü-Hintergrund (Tempeltor, Mond, Gras, Blätter, Glühwürmchen).
9. Andere Webseiten (itch.io, CrazyGames-Version), Werbe-Bilder/Videos, Firebase sparsamer.
10. Gast-Rangliste mit frei wählbarem Namen (auch CrazyGames), Teilen-Knopf, Koop-Einladung per Link, Link-Vorschaubild, ZIPs unter `downloads/`.

## Offene Ideen / bekannte Grenzen
- Koop v1: nur Gastgeber kann Händler/NPCs nutzen; nur Endlos; kein TURN-Server (manche Netze blockieren).
- Bosse sind umgefärbte Varianten der vorhandenen Zeichnungen.
- Rangliste/Bestenliste werden im Browser berechnet (theoretisch fälschbar).
