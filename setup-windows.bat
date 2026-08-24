@echo off
chcp 65001 >nul
title Avatar Catwalk Shop - Setup
echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🎭 Avatar Catwalk Shop – Windows Setup         ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Node.js prüfen
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js ist nicht installiert!
    echo.
    echo Bitte installiere Node.js zuerst:
    echo   👉 https://nodejs.org
    echo.
    echo Lade die LTS-Version herunter, installiere sie,
    echo und starte dieses Script dann erneut.
    echo.
    pause
    exit /b 1
)
echo ✅ Node.js gefunden:
node --version

:: npm Pakete installieren
echo.
echo 📦 Installiere Abhängigkeiten...
call npm install
if %errorlevel% neq 0 (
    echo ❌ npm install fehlgeschlagen
    pause
    exit /b 1
)
echo ✅ Abhängigkeiten installiert

:: .env erstellen falls nicht vorhanden
if not exist .env (
    echo.
    echo 📝 Erstelle .env Konfiguration...
    copy .env.example .env >nul
    echo ✅ .env erstellt
    echo.
    echo ⚠️  WICHTIG: Du musst noch deinen Replicate API Token eintragen!
    echo    Die .env Datei wird jetzt in Notepad geöffnet...
    echo    Ersetze 'r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxx' mit deinem Token.
    echo    Token erstellen: https://replicate.com/account/api-tokens
    echo.
    pause
    notepad .env
    echo.
    echo Hast du den Token eingetragen und gespeichert?
    pause
) else (
    echo ✅ .env existiert bereits
)

:: Datenbank initialisieren
echo.
echo 🗃️  Initialisiere Datenbank...
call node server/init-db.js
echo ✅ Datenbank bereit

:: Beispieldaten laden
echo.
echo 🎭 Lade Beispieldaten (6 Avatare, 5 Anbieter, 18 Artikel)...
call node server/seed-data.js
echo ✅ Beispieldaten geladen

:: Starten
echo.
echo ══════════════════════════════════════════════════
echo   ✅ Setup abgeschlossen! Server wird gestartet...
echo ══════════════════════════════════════════════════
echo.
echo   Öffne im Browser:
echo     🎬 Catwalk:  http://localhost:3000/catwalk
echo     👔 Admin:    http://localhost:3000/admin
echo.
echo   Server beenden: Ctrl+C drücken
echo.

call node server/index.js
pause
