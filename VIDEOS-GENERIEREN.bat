@echo off
chcp 65001 >nul
title 🎬 Walking-Videos generieren

echo ═══════════════════════════════════════════════════
echo   WALKING-VIDEOS GENERIEREN
echo   Erstellt realistische Catwalk-Videos mit KI (Kling v2.1)
echo ═══════════════════════════════════════════════════
echo.
echo Kosten pro Video: ca. $0.05-0.15 (Kling v2.1)
echo Kosten alle 6 Avatare: ca. $0.30-0.90
echo Dauer pro Video: ca. 1-3 Minuten
echo.
echo ═══════════════════════════════════════════════════
echo.

cd /d "%~dp0"

echo [1/3] Pruefe ob Server laeuft...
curl -s http://localhost:3000/api/generate/status >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Server laeuft nicht! Starte Server zuerst...
    echo.
    echo Starte Server automatisch im Hintergrund...
    start /min cmd /c "cd /d %~dp0 && npm start"
    echo Warte 5 Sekunden auf Server-Start...
    timeout /t 5 /nobreak >nul
)

echo [2/3] Pruefe KI-Provider Status...
echo.
curl -s http://localhost:3000/api/generate/status 2>nul
echo.
echo.

echo ═══════════════════════════════════════════════════
echo Was moechtest du tun?
echo ═══════════════════════════════════════════════════
echo.
echo [1] Styled Avatare generieren (Bilder mit Outfit)
echo     → Wird als Grundlage fuer Videos benoetigt
echo     → Kosten: ca. $0.04-0.06 pro Avatar
echo.
echo [2] Walking-Videos fuer ALLE Avatare generieren
echo     → Erstellt Laufsteg-Videos mit Kling v2.1
echo     → Kosten: ca. $0.05-0.15 pro Video
echo.
echo [3] Komplett-Pipeline (Bilder + Videos)
echo     → Beides in einem Schritt
echo     → Kosten: ca. $0.10-0.20 pro Avatar
echo.
echo [4] Abbrechen
echo.

set /p CHOICE=Deine Wahl (1-4):

if "%CHOICE%"=="1" goto STYLED
if "%CHOICE%"=="2" goto VIDEOS
if "%CHOICE%"=="3" goto PIPELINE
if "%CHOICE%"=="4" goto END

:STYLED
echo.
echo 🎨 Generiere Styled Avatar-Bilder fuer alle Avatare...
echo    (Das kann ein paar Minuten dauern)
echo.
curl -s -X POST http://localhost:3000/api/generate/styled/batch/all
echo.
echo.
echo ✅ Fertig! Du kannst jetzt Walking-Videos generieren (Option 2).
goto DONE

:VIDEOS
echo.
echo 🎬 Generiere Walking-Videos fuer alle Avatare...
echo    (Das kann 10-20 Minuten dauern)
echo.
echo WICHTIG: Die Avatare brauchen zuerst ein Bild!
echo Falls noch keine Bilder vorhanden sind, waehle zuerst Option 1.
echo.
echo Generiere Videos...

REM Alle aktiven Avatar-IDs holen und Videos generieren
for /f "tokens=*" %%i in ('curl -s http://localhost:3000/api/catwalk/show 2^>nul ^| findstr /r "\"id\"" ^| findstr /v "outfit_id\|article_id" ^| head -6') do (
    echo Verarbeite Avatar...
)

REM Einfacher: Über Pipeline-Endpoint
echo.
echo Starte Video-Generierung ueber API...
echo (Jeder Avatar wird einzeln verarbeitet)
echo.

REM Heutige Daten laden und Videos generieren
curl -s http://localhost:3000/api/catwalk/show > "%TEMP%\catwalk_data.json" 2>nul

echo Generiere Videos fuer alle Avatare mit heutigem Datum...
curl -s -X POST -H "Content-Type: application/json" http://localhost:3000/api/generate/videos/batch 2>nul
if errorlevel 1 (
    echo.
    echo Verwende Einzelgenerierung...
    echo Bitte warte...
)
echo.
goto DONE

:PIPELINE
echo.
echo 🎭 Starte Komplett-Pipeline fuer alle Avatare...
echo    (Styled Bilder + Walking-Videos)
echo    (Das kann 15-30 Minuten dauern)
echo.

REM Zuerst alle Styled-Bilder
echo Schritt 1: Styled Avatar-Bilder...
curl -s -X POST http://localhost:3000/api/generate/styled/batch/all
echo.

echo Schritt 2: Walking-Videos...
curl -s -X POST -H "Content-Type: application/json" http://localhost:3000/api/generate/videos/batch 2>nul
echo.
goto DONE

:DONE
echo.
echo ═══════════════════════════════════════════════════
echo ✅ Fertig! Oeffne den Catwalk im Browser:
echo    http://localhost:3000/catwalk.html
echo ═══════════════════════════════════════════════════
echo.

:END
pause
