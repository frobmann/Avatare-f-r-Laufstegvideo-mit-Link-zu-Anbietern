@echo off
chcp 65001 >nul
title 🎭 Avatar KI-Generierung
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🎭 Avatar Catwalk – KI-Generierung             ║
echo ║  ────────────────────────────────────────────    ║
echo ║  Dieses Script startet den Server und           ║
echo ║  generiert alle Avatar-Bilder automatisch.      ║
echo ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 🔍 Pruefe ob Server schon laeuft...
curl -s http://localhost:3000/api/generate/status >nul 2>&1
if %errorlevel%==0 (
    echo ✅ Server laeuft bereits!
    goto :generate
)

echo 🚀 Starte Server...
start "Avatar Catwalk Server" cmd /k "cd /d "%~dp0" && npm start"

echo ⏳ Warte 10 Sekunden bis Server bereit ist...
timeout /t 10 /nobreak >nul

:waitloop
curl -s http://localhost:3000/api/generate/status >nul 2>&1
if %errorlevel% neq 0 (
    echo    ... Server startet noch, warte 5 Sekunden...
    timeout /t 5 /nobreak >nul
    goto :waitloop
)

echo ✅ Server ist bereit!
echo.

:generate
echo ════════════════════════════════════════════════════
echo 📸 SCHRITT 1: Avatar-Basisbilder generieren
echo    (6 Avatare x ~30 Sekunden = ca. 3 Minuten)
echo ════════════════════════════════════════════════════
echo.

curl -s -X POST http://localhost:3000/api/generate/avatars/batch
echo.
echo.

echo ════════════════════════════════════════════════════
echo ✅ Fertig! Oeffne jetzt im Browser:
echo    http://localhost:3000/catwalk
echo ════════════════════════════════════════════════════
echo.
echo Druecke eine beliebige Taste zum Beenden...
pause >nul
