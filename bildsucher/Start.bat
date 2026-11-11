@echo off
rem Bildsucher starten (Doppelklick)
cd /d "%~dp0"
title Bildsucher
set "PY="
py -3 -c "import sys" >nul 2>nul && set "PY=py -3"
if not defined PY python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY goto :keinpython

%PY% -c "import cv2, numpy, mss, PIL" >nul 2>nul
if errorlevel 1 (
  echo Erster Start: lade Zusatzteile herunter, einmalig, ca. 1-2 Minuten ...
  %PY% -m pip install --user --upgrade opencv-python numpy mss pillow
  if errorlevel 1 (
    echo.
    echo Das Herunterladen hat nicht geklappt. Bitte Internet pruefen und nochmal starten.
    pause
    exit /b 1
  )
)
echo Bildsucher laeuft. Dieses schwarze Fenster bitte offen lassen.
%PY% bildsucher.py
if errorlevel 1 pause
exit /b

:keinpython
echo Python ist noch nicht installiert. Ich installiere es jetzt ...
echo (Falls Windows fragt: mit "Ja" bestaetigen.)
winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
echo.
echo Fertig. Bitte dieses Fenster schliessen und Start.bat noch einmal doppelklicken.
pause
