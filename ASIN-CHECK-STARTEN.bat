@echo off
chcp 65001 >nul
title 🔗 ASIN-Checker – Amazon.de Produktlinks prüfen
color 0E

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  🔗 ASIN-Checker – Amazon.de Links prüfen       ║
echo ║  ────────────────────────────────────────────    ║
echo ║  Prüft alle Produkt-URLs auf Amazon.de           ║
echo ║  Kaputte ASINs werden automatisch ersetzt!       ║
echo ║                                                  ║
echo ║  Läuft auch automatisch alle 60 Minuten          ║
echo ║  wenn der Server läuft.                          ║
echo ╚══════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo 🔍 Pruefe ob Server laeuft...
curl -s http://localhost:3000/api/generate/status >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Server laeuft nicht!
    echo    Bitte zuerst den Server starten:
    echo    Doppelklick auf SERVER-STARTEN.bat
    echo.
    echo Druecke eine beliebige Taste zum Beenden...
    pause >nul
    exit /b 1
)

echo ✅ Server laeuft!
echo.
echo ════════════════════════════════════════════════════
echo 🔍 ASIN-CHECK WIRD GESTARTET...
echo    - Prüft alle Amazon.de Produkt-Links
echo    - Kaputte Links (404) werden automatisch ersetzt
echo    - Neue ASINs werden sofort verifiziert
echo    - Dauert ca. 2-5 Minuten (je nach Amazon)
echo ════════════════════════════════════════════════════
echo.

curl -s "http://localhost:3000/api/asin-check/run"
echo.
echo.

echo ════════════════════════════════════════════════════
echo ✅ ASIN-Check abgeschlossen!
echo.
echo    Erklärung der Ergebnisse:
echo    ✅ OK      = Link funktioniert
echo    ❌ Kaputt  = Wurde automatisch ersetzt
echo    🚫 Blockiert = Amazon hat den Check blockiert,
echo                   Link ist trotzdem OK!
echo.
echo    Der Check läuft automatisch alle 60 Minuten
echo    solange der Server läuft.
echo ════════════════════════════════════════════════════
echo.
echo Druecke eine beliebige Taste zum Beenden...
pause >nul
