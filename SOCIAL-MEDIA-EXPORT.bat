@echo off
chcp 65001 >nul
title 📱 Social Media Export – Fashion Catwalk

echo.
echo ╔══════════════════════════════════════════════════╗
echo ║  📱 Social Media Export – Fashion Catwalk        ║
echo ║  ────────────────────────────────────────────    ║
echo ║                                                  ║
echo ║  Öffnet das Social Media Export Dashboard        ║
echo ║  für Instagram Reels und TikTok.                 ║
echo ║                                                  ║
echo ║  → Captions kopieren                             ║
echo ║  → Videos auf dein Handy übertragen              ║
echo ║  → Link in Bio einrichten                        ║
echo ╚══════════════════════════════════════════════════╝
echo.

echo 🔍 Prüfe ob Server läuft...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Server läuft nicht! Starte Server...
    echo.
    start "Fashion Catwalk Server" cmd /c "cd /d %~dp0 && npm start"
    echo ⏳ Warte 5 Sekunden auf Server-Start...
    timeout /t 5 /nobreak >nul
)

echo.
echo ✅ Öffne Social Media Export Dashboard...
echo.
echo    📱 Export:      http://localhost:3000/social
echo    🔗 Link in Bio: http://localhost:3000/linkinbio
echo    🎬 Catwalk:     http://localhost:3000/catwalk
echo.

start http://localhost:3000/social

echo.
echo 📋 Anleitung:
echo    1. Sprache und Plattform wählen
echo    2. Caption mit dem Kopieren-Button kopieren
echo    3. Video-Datei aus public\generated\ auf Handy übertragen
echo    4. In Instagram/TikTok posten
echo    5. Link in Bio auf deine Catwalk-URL setzen
echo.
echo Drücke eine Taste zum Schließen...
pause >nul
