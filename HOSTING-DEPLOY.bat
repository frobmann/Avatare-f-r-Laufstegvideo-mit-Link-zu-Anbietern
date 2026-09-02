@echo off
chcp 65001 >nul
title 🌐 Fashion Catwalk – Hosting Deploy

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🌐 Fashion Catwalk – Hosting Deploy             ║
echo ║  ────────────────────────────────────────────    ║
echo ║                                                  ║
echo ║  Baut und startet die App mit Docker             ║
echo ║  für lokales Testen oder Deployment              ║
echo ╚══════════════════════════════════════════════════╝
echo.

:: Prüfen ob Docker installiert ist
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker ist nicht installiert!
    echo.
    echo    Bitte installiere Docker Desktop:
    echo    https://www.docker.com/products/docker-desktop
    echo.
    echo    Nach der Installation Docker Desktop starten
    echo    und dieses Skript erneut ausführen.
    echo.
    pause
    exit /b 1
)

echo ✅ Docker gefunden
echo.

:: Prüfen ob Docker läuft
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Docker Desktop läuft nicht!
    echo    Bitte starte Docker Desktop und warte bis es bereit ist.
    echo.
    pause
    exit /b 1
)

echo ✅ Docker Desktop läuft
echo.

:: Zum Projektverzeichnis wechseln
cd /d "%~dp0"

:: Prüfen ob .env existiert
if not exist .env (
    echo ⚠️  Keine .env Datei gefunden!
    echo    Kopiere .env.example nach .env und trage deine API-Keys ein.
    echo.
    if exist .env.example (
        copy .env.example .env
        echo    ✅ .env.example wurde nach .env kopiert.
        echo    ⚠️  Bitte jetzt die API-Keys eintragen!
        echo    Öffne .env mit Notepad: notepad .env
        echo.
    )
)

echo 🔨 Baue Docker-Container...
echo.
docker compose build

if %errorlevel% neq 0 (
    echo.
    echo ❌ Build fehlgeschlagen! Siehe Fehler oben.
    pause
    exit /b 1
)

echo.
echo ✅ Container erfolgreich gebaut!
echo.
echo 🚀 Starte Fashion Catwalk...
echo.
docker compose up -d

if %errorlevel% neq 0 (
    echo.
    echo ❌ Start fehlgeschlagen! Siehe Fehler oben.
    pause
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  ✅ Fashion Catwalk läuft!                       ║
echo ║  ──────────────────────────────────────────────  ║
echo ║  🎬 Fashion Show:  http://localhost:3000/catwalk ║
echo ║  🔗 Link in Bio:   http://localhost:3000/linkinbio ║
echo ║  📱 Social Export: http://localhost:3000/social  ║
echo ║  👔 Admin:         http://localhost:3000/admin   ║
echo ║  ❤️  Health:       http://localhost:3000/api/health ║
echo ╚══════════════════════════════════════════════════╝
echo.

echo 📋 Docker-Befehle:
echo    docker compose logs -f     → Logs anzeigen
echo    docker compose restart     → Neu starten
echo    docker compose down        → Stoppen
echo.

start http://localhost:3000/catwalk

echo Drücke eine Taste zum Schließen...
pause >nul
