@echo off
chcp 65001 >nul
title 🎭 Avatar KI-Generierung
color 0A

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🎭 Avatar Catwalk – KI-Generierung             ║
echo ║  ────────────────────────────────────────────    ║
echo ║  Generiert Fashion-Avatare mit Outfit            ║
echo ║  und entfernt den Hintergrund automatisch.       ║
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
echo 🎨 STYLED AVATARE GENERIEREN
echo    Jeder Avatar bekommt ein Fashion-Outfit
echo    und der Hintergrund wird entfernt.
echo    (6 Avatare x ~1 Minute = ca. 6-8 Minuten)
echo    Kosten: ca. $0.25 fuer alle 6 Avatare
echo ════════════════════════════════════════════════════
echo.
echo ⏳ Bitte warte, das dauert einige Minuten...
echo.

curl -s -X POST "http://localhost:3000/api/generate/styled/batch/all?force=1"
echo.
echo.

echo ════════════════════════════════════════════════════
echo ✅ Fertig! Oeffne jetzt im Browser:
echo    http://localhost:3000/catwalk
echo.
echo    Die Avatare tragen jetzt Fashion-Outfits
echo    und stehen ohne Hintergrund auf dem Catwalk!
echo ════════════════════════════════════════════════════
echo.
echo Druecke eine beliebige Taste zum Beenden...
pause >nul
