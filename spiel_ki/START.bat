@echo off
setlocal
cd /d "%~dp0"
title Spiel-KI
set PYTHONUTF8=1
echo.
echo   ================================
echo      Spiel-KI wird gestartet ...
echo   ================================
echo.
echo   Dieses schwarze Fenster bitte offen lassen.
echo.

set "WERKZEUG=%~dp0werkzeug"
set "UV="
if exist "%WERKZEUG%\uv.exe" set "UV=%WERKZEUG%\uv.exe"
if defined UV goto starten

echo   Erster Start: Ich lade das Hilfsprogramm "uv" (ca. 20 MB) ...
set "ARCH=x86_64"
if /i "%PROCESSOR_ARCHITECTURE%"=="ARM64" set "ARCH=aarch64"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $z=Join-Path $env:TEMP 'uv-spielki.zip'; Invoke-WebRequest -UseBasicParsing -Uri ('https://github.com/astral-sh/uv/releases/latest/download/uv-' + $env:ARCH + '-pc-windows-msvc.zip') -OutFile $z; Expand-Archive -Force -Path $z -DestinationPath $env:WERKZEUG; Remove-Item $z"
if not exist "%WERKZEUG%\uv.exe" (
  echo   Zweiter Versuch ...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:UV_INSTALL_DIR=$env:WERKZEUG; $env:UV_NO_MODIFY_PATH='1'; irm https://astral.sh/uv/install.ps1 | iex"
)
for /r "%WERKZEUG%" %%f in (uv.exe) do if exist "%%f" set "UV=%%f"
if not defined UV goto fehler_uv

:starten
echo   Beim ersten Start werden Python und die KI-Bausteine geladen.
echo   Das sind ca. 300 MB und kann ein paar Minuten dauern.
echo.
"%UV%" run --python 3.12 "%~dp0spiel_ki.py"
if errorlevel 1 goto fehler
goto ende

:fehler_uv
echo.
echo   FEHLER: Das Hilfsprogramm "uv" konnte nicht geladen werden.
echo   Ist der PC mit dem Internet verbunden? Dann nochmal versuchen.
echo.
pause
goto ende

:fehler
echo.
echo   Es gab einen Fehler. Mach bitte ein Foto von diesem Fenster
echo   und schick es mir (oder die Datei fehler.log aus diesem Ordner).
echo.
pause

:ende
endlocal
