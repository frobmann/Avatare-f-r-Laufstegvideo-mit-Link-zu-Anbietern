# Avatar Catwalk Shop

> Diese Datei wird von Claude Code beim Start automatisch geladen.
> Sie gilt **nur für dieses Projekt**. Ausserhalb dieses Ordners
> antwortet Claude weiterhin in der Sprache des jeweiligen Nutzers.

## Sprache (WICHTIG)

- **Antworte in diesem Projekt immer auf Deutsch**, auch wenn der Nutzer auf
  Englisch schreibt oder sein Claude-Konto auf Englisch eingestellt ist.
- **Code-Kommentare**: Deutsch
- **Commit-Messages**: Deutsch
- **UI-Texte im Frontend**: Deutsch
- **Fehlermeldungen für den Nutzer**: Deutsch
- **Variablen- und Funktionsnamen**: Englisch (Programmier-Standard)
- **Tabellen- und Spaltennamen**: Englisch
- **Werte der Kategorie-Spalte**: Deutsch (`kopfbedeckung`, `oberteil`, `jacke`,
  `hose`, `rock`, `kleid`, `schuhe`, `accessoire`, `tasche`, `schmuck`)

Bestehende deutsche Bezeichnungen niemals ins Englische übersetzen.

## Projekt

Interaktiver Avatar-Catwalk mit Anbieter-Verlinkung. Sechs virtuelle Avatare
laufen in einer Endlosschlaufe über einen Laufsteg. Beim Hovern erscheint eine
Produktkachel, beim Klicken geht es direkt zum Shop des Anbieters.

- Repository: `frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern`
- Arbeits-Branch: `claude/avatar-catwalk-shop-xcpvob`
- Ausführliche Doku: `docs/KONTEXT-UEBERGABE.md` (bei Fragen zuerst dort nachlesen)

## Technologie-Stack

| Bereich    | Technologie                                             |
|------------|---------------------------------------------------------|
| Backend    | Node.js 18+ und Express 4                               |
| Datenbank  | SQLite über **sql.js** (WASM), Datei `data/catwalk.db`  |
| Frontend   | Vanilla HTML/CSS/JS, kein Framework, kein Build-Schritt |
| KI         | Replicate API: Flux 1.1 Pro, IDM-VTON, Minimax Video-01 |

## Technische Regeln

- **sql.js statt better-sqlite3.** Kein C++-Compiler auf Windows nötig.
  Nicht auf better-sqlite3 zurückwechseln.
- **`await initDatabase()` muss vor allem anderen laufen.** Routen erst
  **nach** der DB-Initialisierung per `require` laden (siehe `server/index.js`).
- **Keine `dotenv`-Dependency.** Die `.env` wird in `server/index.js` von Hand
  geparst. Nicht durch dotenv ersetzen.
- **Jede DB-Mutation speichert automatisch auf die Festplatte.** Kein
  manuelles `save()` nötig.
- **Keine neuen Dependencies** ohne Rückfrage. Der Stack soll schlank bleiben.

## Sicherheit

- **Niemals** API-Keys in Code, Commits oder Chat-Antworten schreiben.
- Keys gehören ausschliesslich in die `.env` (steht in `.gitignore`).
- `.env.example` enthält nur Platzhalter.
- Niemals committen: `.env`, `data/`, `node_modules/`, `public/generated/`, `uploads/`

## Code-Stil

- 2 Leerzeichen Einrückung
- Single Quotes in JavaScript
- `const` statt `let`, wo möglich
- Template Literals mit Backticks für String-Interpolation
- Kein Linter oder Formatter konfiguriert

## Zusammenarbeit

An diesem Projekt arbeiten zwei Personen über **dasselbe GitHub-Konto** und
denselben Branch. Deshalb:

- Vor Arbeitsbeginn immer `git pull --rebase` ausführen.
- Nach fertigen Arbeitsschritten zeitnah committen und pushen.
- Keine neuen Branches anlegen, ohne vorher zu fragen.

## Wichtige Befehle

```bash
npm install            # Abhängigkeiten installieren
npm run seed           # Beispieldaten in die Datenbank laden
node server/index.js   # Server starten (http://localhost:3000)
```

- Catwalk: http://localhost:3000/catwalk
- Admin: http://localhost:3000/admin
