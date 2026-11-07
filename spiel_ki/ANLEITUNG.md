# Spiel-KI – bringt sich Spiele selbst bei

Die KI schaut auf deinen Bildschirm, drückt selbst Tasten und lernt durch Ausprobieren:

- **Belohnung:** solange sie im Spiel bleibt, wenn sich die Punkte ändern, und wenn sie etwas Neues sieht.
- **Strafe:** wenn sie verliert.

Am Anfang drückt sie völlig zufällig. Mit der Zeit merkt sie sich, was gut war, und wird besser.
Im Fenster siehst du eine Kurve: Wie viele Sekunden hält sie pro Runde durch?

## Einmalig: Starten

1. Den Ordner `spiel_ki` auf den PC kopieren (zum Beispiel auf den Desktop).
2. **`START.bat` doppelklicken.**
   - Kommt „Der Computer wurde durch Windows geschützt“: auf **Weitere Informationen** und dann auf **Trotzdem ausführen** klicken.
   - Beim ersten Mal lädt das Programm Python und die KI-Bausteine (ca. 300 MB). Das dauert ein paar Minuten.
3. Es öffnet sich das Fenster **Spiel-KI**. Das schwarze Fenster bitte offen lassen.

## Für jedes Spiel

1. **Spiel öffnen**, im Fenster-Modus (nicht Vollbild). Das Fenster danach nicht mehr verschieben.
   - **Freiwillig:** Erklär das Spiel oben im Textfeld, zum Beispiel „Mit Leertaste springen, mit Pfeil runter ducken.
     Nach Game Over mit Enter neu starten.“ Dann auf **Übernehmen** klicken. Das Programm hakt dann die
     Tasten an und stellt den Neustart ein. (Die KI selbst kann nicht lesen, sie lernt danach trotzdem durch Ausprobieren.)
2. **Spielfeld markieren:** auf den Knopf klicken und einen Rahmen um das Spielfeld ziehen.
3. **Tasten anhaken**, die das Spiel braucht, zum Beispiel ↑ und Leertaste. Je weniger Tasten, desto schneller lernt sie.
4. **Verlieren erkennen:**
   - Bleibt das Bild nach dem Verlieren stehen, reicht der Haken „Wenn das Bild stehen bleibt“.
   - Sonst: das Spiel einmal verlieren lassen, „Game Over“-Bild → **Markieren**, und einen engen Rahmen um die „Game Over“-Schrift ziehen.
   - **Neustart mit:** die Taste, mit der das Spiel nach „Game Over“ neu startet.
   - **Punkte (freiwillig):** einen Rahmen um die Punkte-Anzeige ziehen. Dann freut sich die KI über jeden Punkt.
5. **Ins Spiel klicken und F8 drücken.** Die KI übt. **Nochmal F8 = sofort Stopp.**

Was sie gelernt hat, wird gespeichert. Beim nächsten Start macht sie da weiter.

## Gut zu wissen

- **Geduld!** Die ersten ~10 Minuten probiert sie viel zufällig. Bei einfachen Spielen wird sie oft schon nach 10–30 Minuten
  deutlich besser, bei schwereren dauert es 1–3 Stunden.
- Während sie übt, Maus und Tastatur nicht benutzen. Drückst du selbst eine Taste, macht sie kurz Pause.
- Reagiert F8 einmal nicht: einfach auf das Fenster **Spiel-KI** klicken. Dann ist das Spiel nicht mehr vorne
  und die KI hält sofort an. Danach auf **Stopp** klicken.
- Ist das Spiel nicht mehr vorne (zum Beispiel weil du ein anderes Fenster anklickst), macht sie automatisch Pause.
- **Am besten klappt es bei einfachen, schnellen Spielen:** Dino-Spiel, Flappy-Bird-Spiele, Ausweich- und Lauf-Spiele.
  Große Spiele wie Minecraft oder Fortnite sind für so eine kleine KI viel zu schwer.
- **Nur Spiele ohne andere Spieler!** In Online-Spielen sind Bots verboten. Dort kann dein Konto gesperrt werden.
- Die KI drückt nie Esc und keine Windows-Taste.
- Gibt es einen Fehler, steht er in der Datei `fehler.log` in diesem Ordner.

## Für Neugierige: Wie funktioniert das?

Das nennt man **Verstärkungslernen** (Reinforcement Learning). Ein kleines künstliches Gehirn
(ein neuronales Netz) sieht das Spielfeld als winziges Bild (80 × 56 Pixel), dazu die drei Bilder davor.
So erkennt es Bewegung. Für jeden möglichen Zug schätzt es, wie viel Belohnung danach noch kommt,
und wählt den besten. Aus jedem Fehler lernt es im Hintergrund weiter (Double-DQN).
