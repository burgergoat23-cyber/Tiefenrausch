@echo off
chcp 65001 >nul
title Minecraft-Bot
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto keinnode
node -e "process.exit(parseInt(process.versions.node)<18?1:0)"
if errorlevel 1 goto keinnode
if not exist "node_modules\mineflayer" goto installieren
goto starten

:keinnode
echo.
echo  Auf diesem PC fehlt das Programm "Node.js" (oder es ist zu alt).
echo  Der Bot braucht es. Es ist kostenlos und sicher (nodejs.org).
echo  Frag kurz deine Eltern, ob du es installieren darfst.
echo.
pause
where winget >nul 2>nul
if errorlevel 1 goto vonhand
echo.
echo  Ich installiere Node.js jetzt.
echo  Wenn Windows fragt "Aenderungen zulassen?", klicke auf Ja.
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
echo.
echo  Fertig. Schliesse dieses Fenster und starte start.bat NOCH EINMAL.
echo.
pause
exit /b

:vonhand
echo.
echo  Ich oeffne jetzt die Seite nodejs.org.
echo  Lade dort die Version "LTS" herunter und installiere sie
echo  (immer auf Weiter klicken). Danach start.bat noch einmal starten.
echo.
start https://nodejs.org/
pause
exit /b

:installieren
echo.
echo  Erster Start: Ich lade die Bausteine fuer den Bot.
echo  Das dauert 1 bis 2 Minuten und braucht Internet.
echo.
call npm install --omit=dev --no-audit --no-fund
if errorlevel 1 goto fehler
goto starten

:fehler
echo.
echo  Das Laden hat nicht geklappt. Pruefe das Internet und versuche es noch einmal.
echo  Oder nimm die ZIP-Datei, in der schon alles drin ist: minecraft-bot.zip
echo.
pause
exit /b

:starten
node bot.js
echo.
pause
