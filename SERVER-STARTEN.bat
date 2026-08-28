@echo off
chcp 65001 >nul
title 🎭 Avatar Catwalk Server
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🎭 Avatar Catwalk Server                       ║
echo ║  ────────────────────────────────────────────    ║
echo ║  Startet den Server mit allen Automatismen:     ║
echo ║  • ASIN-Check alle 60 Minuten                   ║
echo ║  • Automatische Outfit-Zuweisung                 ║
echo ║  • Datenbank-Backup (Finanzamt-konform)          ║
echo ║  • DSGVO-konforme Datenbereinigung               ║
echo ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 🔍 Pruefe ob Server schon laeuft...
curl -s http://localhost:3000/api/generate/status >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Server laeuft bereits!
    echo.
    echo    🌐 Browser: http://localhost:3000
    echo    👔 Admin:   http://localhost:3000/admin
    echo    🎬 Catwalk: http://localhost:3000/catwalk
    echo.
    echo Druecke eine beliebige Taste zum Beenden...
    pause >nul
    exit /b 0
)

echo 🚀 Starte Server...
echo.

npm start
