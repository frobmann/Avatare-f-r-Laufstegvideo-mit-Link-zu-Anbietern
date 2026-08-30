# 🎭 Avatar Catwalk Shop – Kontext-Übergabe für Co-Programmierung

> **Dieses Dokument** ist eine vollständige Projektbeschreibung, die als Kontext
> in ein neues Claude-Projekt eingegeben werden kann. Es enthält alles, was
> Claude braucht, um am Projekt mitzuarbeiten.
>
> **Letzte Aktualisierung**: 30. August 2026
> **Branch**: `claude/avatar-catwalk-shop-xcpvob`
> **Repository**: `frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern`

---

## 📋 Inhaltsverzeichnis

1. [Projekt-Übersicht](#1-projekt-übersicht)
2. [Claude Code Einrichtung](#2-claude-code-einrichtung)
3. [Architektur & Technologie-Stack](#3-architektur--technologie-stack)
4. [Dateistruktur](#4-dateistruktur)
5. [Datenbank-Schema](#5-datenbank-schema)
6. [API-Endpunkte (komplett)](#6-api-endpunkte-komplett)
7. [KI-Pipeline (3 Stufen)](#7-ki-pipeline-3-stufen)
8. [Automatische Aufgaben (Scheduler)](#8-automatische-aufgaben-scheduler)
9. [Wichtige Code-Muster](#9-wichtige-code-muster)
10. [Frontend-Seiten](#10-frontend-seiten)
11. [Lokale Einrichtung (Windows)](#11-lokale-einrichtung-windows)
12. [Start-Skripte (Windows)](#12-start-skripte-windows)
13. [Aktueller Entwicklungsstand](#13-aktueller-entwicklungsstand)
14. [Nächste Schritte / Offene Aufgaben](#14-nächste-schritte--offene-aufgaben)
15. [Wichtige Hinweise & Konventionen](#15-wichtige-hinweise--konventionen)

---

## 1. Projekt-Übersicht

### Was ist das?

Ein interaktives Avatar-Catwalk-System mit Anbieter-Verlinkung. **Virtuelle Avatare** (KI-generierte Model-Fotos) laufen in einer Endlosschlaufe über einen virtuellen Laufsteg. Kunden können:

- **Hovern** → Eine Produktkachel erscheint mit Brand, Preis und allen Artikeln
- **Klicken** → Direkte Weiterleitung zum jeweiligen Anbieter-Shop (z.B. Zalando, H&M, ZARA)
- **"Ganzen Look shoppen"** → Alle Shop-Links öffnen sich

### Kernidee

Täglich werden den 6 Avataren neue Outfits zugewiesen (aus einem Pool von Artikeln verschiedener Mode-Anbieter). Über eine **3-stufige KI-Pipeline** (Replicate API) werden dann:

1. **Avatar-Basisbilder** generiert (Flux 1.1 Pro – fotorealistische Ganzkörper-Model-Fotos)
2. **Outfit-Bilder** erstellt (IDM-VTON – die Mode wird virtuell auf den Avatar „aufgetragen")
3. **Walking-Videos** erzeugt (Kling v2.1 – der Avatar „läuft" über den Catwalk)

### Monetarisierung

Die Artikel-Links zeigen auf echte Shop-Seiten (Amazon, Zalando, etc.). Zukünftig können Affiliate-Links eingefügt werden, um bei Käufen eine Provision zu verdienen.

---

## 2. Claude Code Einrichtung

### Schritt 1: Claude Code installieren

```bash
# Im Terminal/Powershell:
npm install -g @anthropic-ai/claude-code
```

Falls das nicht funktioniert, lade Claude Code hier herunter:
👉 https://claude.ai/code

### Schritt 2: Neues Projekt in Claude anlegen

1. Gehe zu **claude.ai** → Einstellungen → **Projekte**
2. Erstelle ein neues Projekt: **"Avatar Catwalk Shop"**
3. In den Projekteinstellungen → **"Custom Instructions"** → Füge dort folgenden Text ein:

```
Du arbeitest an einem Avatar-Catwalk-Shop-System. 
Das gesamte Projekt (Code, Kommentare, Variablennamen, UI-Texte) ist auf DEUTSCH.
Bitte behalte alle deutschen Bezeichnungen bei und antworte auf Deutsch.

Repository: https://github.com/frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern
Branch: claude/avatar-catwalk-shop-xcpvob
Technologie: Node.js + Express + sql.js (SQLite) + Vanilla HTML/CSS/JS
KI-Pipeline: Replicate API (Flux 1.1 Pro, IDM-VTON, Kling v2.1)

Wichtig:
- Code-Kommentare und Fehlermeldungen auf Deutsch
- sql.js statt better-sqlite3 (kein C++ Compiler nötig auf Windows)
- Datenbank muss async initialisiert werden (await initDatabase())
- Nach jeder DB-Mutation wird automatisch auf Festplatte gespeichert
- .env Datei ist in .gitignore – NIEMALS API-Keys committen
```

### Schritt 3: GitHub verbinden

1. In Claude Code: **Settings → Connectors → GitHub verbinden**
2. Das Repository `frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern` freigeben
3. Zugriff auf den Branch `claude/avatar-catwalk-shop-xcpvob` prüfen

### Schritt 4: Repository klonen

```bash
git clone https://github.com/frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern.git
cd Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern
git checkout claude/avatar-catwalk-shop-xcpvob
npm install
```

### Schritt 5: Claude Code starten

```bash
cd Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern
claude
```

Claude Code öffnet sich im Terminal und hat Zugriff auf alle Projektdateien.

### Hinweis zur Sprache

Auch wenn dein Claude-Account auf Englisch ist, kannst du Claude bitten, auf Deutsch zu antworten. Sage einfach:

> „Bitte antworte mir auf Deutsch und behalte alle deutschen Bezeichnungen im Code bei."

Claude wird das für die gesamte Konversation beibehalten.

---

## 3. Architektur & Technologie-Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Vanilla HTML/CSS/JS)                │
├──────────────┬──────────────────┬──────────────────────────────┤
│  index.html  │  catwalk.html    │  admin.html                   │
│  Startseite  │  Laufsteg-Show   │  Verwaltungs-Dashboard        │
│              │  (Endlos-Loop)   │  (Avatare, Anbieter, Outfits) │
└──────┬───────┴────────┬─────────┴──────────────┬───────────────┘
       │                │                        │
       ▼                ▼                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  BACKEND (Node.js + Express)                     │
│                  server/index.js                                  │
├─────────────┬──────────────┬──────────────┬────────────────────┤
│  /api/      │  /api/       │  /api/       │  /api/              │
│  avatars    │  providers   │  articles    │  catwalk            │
│             │              │              │                      │
│  /api/      │              │              │                      │
│  generate   │              │              │                      │
└──────┬──────┴──────────────┴──────────────┴────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  SERVICES                                                        │
│  ├── ai-provider.js       → Replicate/HuggingFace/Local API    │
│  └── generation-pipeline.js → 3-Stufen-Pipeline-Orchestrator    │
└──────┬──────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────┐     ┌──────────────────────────────┐
│  SQLite (sql.js/WASM)   │     │  Replicate API               │
│  data/catwalk.db        │     │  ├── Flux 1.1 Pro (Bilder)   │
│                         │     │  ├── IDM-VTON (Try-On)       │
│  7 Tabellen             │     │  └── Kling v2.1 (Video)      │
└─────────────────────────┘     └──────────────────────────────┘
```

### Technologie-Stack

| Komponente    | Technologie                            | Warum?                                         |
|---------------|----------------------------------------|------------------------------------------------|
| Backend       | Node.js 18+ + Express 4               | Einfach, weit verbreitet                       |
| Datenbank     | SQLite via **sql.js** (WASM)           | Kein C++ Compiler nötig! Läuft überall.        |
| Frontend      | Vanilla HTML/CSS/JS                    | Keine Build-Tools, keine Frameworks            |
| KI (Bilder)   | Replicate: Flux 1.1 Pro               | Günstig (~$0.03–0.05/Bild), fotorealistisch    |
| KI (Try-On)   | Replicate: IDM-VTON                   | Günstigster Virtual Try-On (~$0.01–0.03/Bild)  |
| KI (Video)    | Replicate: **Kling v2.1**             | Beste Gehbewegung (~$0.05–0.15/Video)          |
| Paketmanager  | npm                                    | Standard für Node.js                           |

### Dependencies (package.json)

```json
{
  "dependencies": {
    "sql.js": "^1.11.0",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "multer": "^1.4.5-lts.1",
    "playwright": "^1.62.1",
    "uuid": "^10.0.0"
  }
}
```

**Wichtig**: Es gibt KEINE `dotenv`-Dependency! Die `.env`-Datei wird manuell geparsed in `server/index.js`.

---

## 4. Dateistruktur

```
Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern/
│
├── server/                          # Backend
│   ├── index.js                     # Server-Start (async wegen sql.js)
│   ├── db.js                        # sql.js Wrapper (better-sqlite3-kompatibel)
│   ├── init-db.js                   # Tabellen erstellen
│   ├── seed-data.js                 # Beispieldaten laden
│   │
│   ├── routes/                      # API-Routen
│   │   ├── avatars.js               # CRUD + Outfit-Zuordnung
│   │   ├── providers.js             # CRUD Anbieter
│   │   ├── articles.js              # CRUD Artikel (mit Filter)
│   │   ├── catwalk.js               # Catwalk-Daten + Statistiken
│   │   └── generate.js              # KI-Generierungs-Endpunkte
│   │
│   ├── seed-providers.js            # Anbieter-Grunddaten
│   │
│   └── services/                    # Business-Logik
│       ├── ai-provider.js           # Provider-Abstraktion (Replicate, HF, Lokal)
│       ├── generation-pipeline.js   # 3-Stufen KI-Pipeline
│       ├── outfit-rotation.js       # Automatische Outfit-Zuweisung nach Stil
│       ├── availability-checker.js  # Täglicher Verfügbarkeits-Check der Shop-Links
│       └── asin-checker.js          # Stündliche Amazon-ASIN-Prüfung + Auto-Ersatz
│
├── public/                          # Frontend (statisch)
│   ├── index.html                   # Startseite
│   ├── catwalk.html                 # Laufsteg-Ansicht (öffentlich, KI-Videos)
│   ├── admin.html                   # Admin-Dashboard
│   ├── impressum.html               # Impressum (Rechtstext)
│   ├── datenschutz.html             # Datenschutzerklärung (Rechtstext)
│   └── generated/                   # KI-generierte Bilder & Videos (gitignored)
│
├── data/                            # Datenbank-Dateien (gitignored)
│   ├── catwalk.db                   # SQLite Hauptdatenbank
│   ├── backups/                     # Automatische Backups (Finanzamt §147 AO)
│   └── cache/                       # Generierungs-Cache
│
├── uploads/                         # Hochgeladene Dateien (gitignored)
│
├── docs/                            # Dokumentation
│   ├── KONTEXT-UEBERGABE.md         # Dieses Dokument
│   └── SEED_MODELS_KOSTENANALYSE.md # KI-Modell-Vergleich
│
├── SERVER-STARTEN.bat               # Server mit allen Automatismen starten
├── START-KI-GENERIERUNG.bat         # Styled Avatar-Bilder generieren
├── VIDEOS-GENERIEREN.bat            # Walking-Videos generieren (Menü)
├── ASIN-CHECK-STARTEN.bat           # ASIN-Check manuell anstossen
├── setup-windows.bat                # Windows Ein-Klick-Setup
│
├── CLAUDE.md                        # Projektregeln für Claude Code
├── .env.example                     # Vorlage für Konfiguration
├── .env                             # Konfiguration mit API-Keys (NICHT im Git!)
├── .gitignore                       # node_modules, data/, .env, etc.
├── package.json                     # Dependencies & Scripts
└── README.md                        # Projekt-Dokumentation
```

---

## 5. Datenbank-Schema

### sql.js Besonderheiten

Die Datenbank verwendet **sql.js** (WebAssembly-kompiliertes SQLite) statt `better-sqlite3`, weil `better-sqlite3` einen C++-Compiler benötigt, der auf Windows oft Probleme macht.

**Wichtige Muster:**

```javascript
// INITIALISIERUNG (einmal beim Start, ASYNC!)
const { initDatabase, getDb } = require('./db');
await initDatabase();  // Muss vor allem anderen kommen!

// DANACH synchron nutzbar
const db = getDb();

// Abfragen (gleiche API wie better-sqlite3)
const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
const avatars = db.prepare('SELECT * FROM avatars').all();

// Mutationen (speichern automatisch auf Festplatte!)
db.prepare('INSERT INTO avatars (id, name) VALUES (?, ?)').run(id, name);
db.prepare('UPDATE avatars SET name = ? WHERE id = ?').run(name, id);

// Rohes SQL
db.exec('CREATE TABLE IF NOT EXISTS ...');
```

### Tabellen

#### `avatars` – Virtuelle Models
```sql
CREATE TABLE avatars (
  id TEXT PRIMARY KEY,                         -- UUID
  name TEXT NOT NULL,                          -- z.B. "Sophia", "Liam"
  description TEXT DEFAULT '',                 -- z.B. "Eleganter Business-Stil"
  image_url TEXT DEFAULT '',                   -- Pfad zum generierten Basisbild
  silhouette_url TEXT DEFAULT '',              -- Silhouette für CSS-Animation
  walk_animation TEXT DEFAULT 'default',       -- Animationstyp
  position_order INTEGER DEFAULT 0,            -- Reihenfolge auf dem Catwalk
  is_active INTEGER DEFAULT 1,                 -- Soft-Delete
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### `providers` – Mode-Anbieter / Brands
```sql
CREATE TABLE providers (
  id TEXT PRIMARY KEY,                         -- UUID
  name TEXT NOT NULL,                          -- Interne Bezeichnung
  brand_name TEXT NOT NULL,                    -- z.B. "Zalando", "H&M"
  logo_url TEXT DEFAULT '',                    -- Logo des Anbieters
  website_url TEXT NOT NULL,                   -- z.B. "https://www.zalando.ch"
  affiliate_base_url TEXT DEFAULT '',          -- Affiliate-Link-Basis
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

#### `articles` – Kleidungsstücke / Produkte
```sql
CREATE TABLE articles (
  id TEXT PRIMARY KEY,                         -- UUID
  provider_id TEXT NOT NULL,                   -- FK → providers
  name TEXT NOT NULL,                          -- z.B. "Schwarzer Wollmantel"
  category TEXT NOT NULL,                      -- Kategorie (siehe unten)
  price REAL NOT NULL,                         -- Preis in der Währung
  currency TEXT DEFAULT 'CHF',                 -- CHF, EUR, USD
  product_url TEXT NOT NULL,                   -- Direkter Link zum Shop!
  image_url TEXT DEFAULT '',                   -- Produktbild (für Try-On)
  color TEXT DEFAULT '',                       -- Farbe
  size TEXT DEFAULT '',                        -- Größe
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
);
```

**Kategorien** (CHECK Constraint):
`kopfbedeckung`, `oberteil`, `jacke`, `hose`, `rock`, `kleid`, `schuhe`, `accessoire`, `tasche`, `schmuck`

#### `avatar_outfits` – Tägliche Outfit-Zuordnung
```sql
CREATE TABLE avatar_outfits (
  id TEXT PRIMARY KEY,                         -- UUID
  avatar_id TEXT NOT NULL,                     -- FK → avatars
  article_id TEXT NOT NULL,                    -- FK → articles
  outfit_date TEXT NOT NULL DEFAULT (date('now')),  -- Datum (YYYY-MM-DD)
  layer_order INTEGER DEFAULT 0,               -- Reihenfolge (0=unterste Schicht)
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(avatar_id, article_id, outfit_date)   -- Jeder Artikel max 1x pro Tag
);
```

#### `catwalk_config` – Laufsteg-Einstellungen
```sql
CREATE TABLE catwalk_config (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT DEFAULT 'Fashion Catwalk',
  background_image TEXT DEFAULT '',
  background_color TEXT DEFAULT '#1a1a2e',
  runway_color TEXT DEFAULT '#333355',
  music_url TEXT DEFAULT '',
  speed REAL DEFAULT 1.0,
  loop_enabled INTEGER DEFAULT 1,
  show_brand_on_hover INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

#### `click_stats` – Klick-Tracking
```sql
CREATE TABLE click_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  avatar_id TEXT NOT NULL,
  article_id TEXT,
  action TEXT NOT NULL CHECK(action IN ('hover', 'click', 'redirect')),
  timestamp TEXT DEFAULT (datetime('now'))
);
```

#### `generations` – KI-Generierungen
```sql
CREATE TABLE generations (
  id TEXT PRIMARY KEY,                         -- UUID
  avatar_id TEXT NOT NULL,                     -- FK → avatars
  type TEXT NOT NULL,                          -- 'tryon', 'walk_animation', 'img2img'
  cache_key TEXT DEFAULT '',                   -- Für Cache-Lookup
  status TEXT DEFAULT 'pending',               -- 'pending', 'processing', 'completed', 'failed'
  output_path TEXT DEFAULT '',                 -- Pfad zum Ergebnis
  cost REAL DEFAULT 0,                         -- Kosten in USD
  error_message TEXT DEFAULT '',               -- Fehler bei 'failed'
  metadata TEXT DEFAULT '{}',                  -- JSON mit Details
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Beispieldaten (Seed)

Das Seed-Script (`npm run seed`) erstellt:

- **6 Avatare**: Sophia, Liam, Mia, Noah, Emma, Felix – jeweils mit eigenem Stil-Profil
- **5 Anbieter**: Zalando, H&M, ZARA, About You, ASOS – mit echten Website-URLs
- **18 Artikel**: Je Anbieter 3-4 Artikel in verschiedenen Kategorien mit Beispielpreisen
- **Tages-Outfits**: Automatische Zuweisung von Artikeln zu Avataren für das aktuelle Datum

---

## 6. API-Endpunkte (komplett)

### Avatare (`/api/avatars`)

| Method | Pfad | Beschreibung | Body |
|--------|------|-------------|------|
| GET | `/api/avatars` | Alle aktiven Avatare | – |
| GET | `/api/avatars/:id` | Einzelner Avatar | – |
| POST | `/api/avatars` | Neuer Avatar | `{ name, description?, image_url?, ... }` |
| PUT | `/api/avatars/:id` | Aktualisieren | Alle Felder optional (COALESCE) |
| DELETE | `/api/avatars/:id` | Deaktivieren (Soft-Delete) | – |
| GET | `/api/avatars/:id/outfit?date=` | Outfit für Datum | Query: `date=YYYY-MM-DD` |
| POST | `/api/avatars/:id/outfit` | Artikel zuweisen | `{ article_id, outfit_date?, layer_order? }` |
| DELETE | `/api/avatars/:id/outfit/:outfitId` | Artikel entfernen | – |
| DELETE | `/api/avatars/:id/outfit?date=` | Ganzes Outfit löschen | Query: `date=YYYY-MM-DD` |

### Anbieter (`/api/providers`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/providers` | Alle aktiven Anbieter |
| GET | `/api/providers/:id` | Einzelner Anbieter |
| POST | `/api/providers` | Neuer Anbieter (name, brand_name, website_url nötig) |
| PUT | `/api/providers/:id` | Aktualisieren |
| DELETE | `/api/providers/:id` | Deaktivieren |
| GET | `/api/providers/:id/articles` | Alle Artikel eines Anbieters |

### Artikel (`/api/articles`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/articles` | Alle Artikel (Filter: `?category=`, `?provider_id=`, `?search=`) |
| GET | `/api/articles/:id` | Einzelner Artikel |
| POST | `/api/articles` | Neuer Artikel (provider_id, name, category, price, product_url nötig) |
| PUT | `/api/articles/:id` | Aktualisieren |
| DELETE | `/api/articles/:id` | Deaktivieren |

### Catwalk (`/api/catwalk`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/catwalk/show?date=` | **Hauptdaten**: Alle Avatare + Outfits + generierte Bilder/Videos |
| GET | `/api/catwalk/config` | Laufsteg-Konfiguration |
| PUT | `/api/catwalk/config` | Konfiguration ändern |
| POST | `/api/catwalk/stats` | Klick erfassen (`{ avatar_id, article_id?, action }`) |
| GET | `/api/catwalk/stats?days=` | Statistiken abrufen |

### KI-Generierung (`/api/generate`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/generate/status` | Provider-Status (Token? Models? Kosten?) |
| POST | `/api/generate/avatar/:avatarId` | **Schritt 1**: Avatar-Basisbild generieren |
| POST | `/api/generate/avatars/batch` | Alle Avatar-Basisbilder generieren |
| POST | `/api/generate/outfit/:avatarId` | **Schritt 2**: Outfit via Try-On |
| POST | `/api/generate/video/:avatarId` | **Schritt 3**: Walking-Video |
| POST | `/api/generate/pipeline/:avatarId` | **Komplett**: Alle 3 Schritte |
| POST | `/api/generate/batch` | Alle Outfits generieren (Batch) |
| POST | `/api/generate/styled/:avatarId` | Styled Avatar (Outfit direkt im Prompt, ohne Try-On) |
| POST | `/api/generate/styled/batch/all` | Styled Avatare für alle (Query: `?force=1`) |
| POST | `/api/generate/videos/batch` | Walking-Videos für alle Avatare |
| GET | `/api/generate/history?limit=` | Generierungs-Historie |
| GET | `/api/generate/costs?days=` | Kosten-Übersicht (nach Typ, nach Tag) |

### Outfit-Rotation, Verfügbarkeit & Backups (`/api/generate`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/generate/outfits/preview` | Vorschau der automatischen Zuweisung |
| POST | `/api/generate/outfits/auto-assign` | Outfits automatisch zuweisen |
| POST | `/api/generate/outfits/rotate` | Outfits neu durchrotieren |
| POST | `/api/generate/availability/check` | Verfügbarkeits-Check manuell starten |
| GET | `/api/generate/availability/report` | Bericht: nicht erreichbare Artikel |
| GET | `/api/generate/backups` | Vorhandene Datenbank-Backups auflisten |
| POST | `/api/generate/backups/create` | Backup sofort erstellen |
| POST | `/api/generate/backups/restore` | Backup wiederherstellen |
| GET | `/api/generate/export/costs-csv` | Kosten als CSV (Buchhaltung) |
| GET | `/api/generate/export/articles-csv` | Artikel als CSV |
| GET | `/api/generate/export/availability-csv` | Verfügbarkeits-Protokoll als CSV |
| GET | `/api/generate/export/dsgvo-complete` | DSGVO-Komplettauskunft |
| DELETE | `/api/generate/export/dsgvo-delete-stats` | Klick-Statistiken löschen (DSGVO) |

### ASIN-Checker (`/api/asin-check`)

| Method | Pfad | Beschreibung |
|--------|------|-------------|
| GET | `/api/asin-check/run` | Prüfung sofort starten (`?replace=0` = ohne Auto-Ersatz) |
| GET | `/api/asin-check/last` | Ergebnis des letzten Laufs |
| GET | `/api/asin-check/history` | Verlauf der bisherigen Prüfungen |

---

## 7. KI-Pipeline (3 Stufen)

### Übersicht

```
Schritt 1                    Schritt 2                    Schritt 3
┌─────────────────┐   ┌──────────────────┐   ┌────────────────────┐
│  Avatar-Basisbild│──▶│  Virtual Try-On  │──▶│  Walking-Video     │
│  (Flux 1.1 Pro) │   │  (IDM-VTON)      │   │  (Kling v2.1)      │
│                  │   │                  │   │                    │
│  Ganzkörper-Foto │   │  Kleidung auf    │   │  Laufende Animation│
│  in neutraler    │   │  Avatar auftragen│   │  auf dem Catwalk   │
│  Kleidung        │   │                  │   │                    │
│                  │   │  Artikel-Bild →  │   │  Outfit-Bild →     │
│  ~$0.03–0.05     │   │  ~$0.01–0.03     │   │  ~$0.05–0.15       │
└─────────────────┘   └──────────────────┘   └────────────────────┘
```

### Kostenübersicht

| Was | Modell | Kosten |
|-----|--------|--------|
| Avatar-Basisbild | Flux 1.1 Pro | ~$0.03–0.05/Bild |
| Styled Avatar (Outfit im Prompt) | Flux 1.1 Pro | ~$0.04–0.06/Bild |
| Virtual Try-On | IDM-VTON | ~$0.01–0.03/Bild |
| Walking-Video | **Kling v2.1** | ~$0.05–0.15/Video |
| **Komplett pro Avatar** | | **~$0.10–0.25** |
| **6 Avatare/Tag** | | **~$0.60–1.50/Tag** |
| **Monatlich (6 Avatare)** | | **~$18–45/Monat** |

> ⚠️ **Achtung, bekannte Abweichung**: Der Endpunkt `GET /api/generate/status`
> und die Datei `VIDEOS-GENERIEREN.bat` geben noch die alten Minimax-Preise
> (~$0.10–0.20/Video, ~$27–54/Monat) aus. Die Werte in `server/routes/generate.js`
> (`costEstimate`) müssen noch auf Kling v2.1 angepasst werden.

> 💡 **Hinweis**: In der Praxis laufen die Kosten deutlich niedriger, weil die
> Videos **nicht täglich** neu generiert werden. Einmal erzeugte Walking-Videos
> bleiben in `public/generated/` liegen und werden vom Catwalk wiederverwendet.

### Schritt 1: Avatar-Basisbild (Flux 1.1 Pro)

**Datei**: `server/services/generation-pipeline.js` → `generateAvatarBaseImage(avatarId)`

Generiert ein fotorealistisches Ganzkörper-Model-Foto. Der Avatar trägt **neutrale Kleidung** (weißes T-Shirt + dunkle Jeans), damit der Virtual Try-On in Schritt 2 die richtige Mode auftragen kann.

**Prompt-Generator**: `buildAvatarPrompt(avatar)` in `ai-provider.js`
- Leitet Geschlecht aus dem Namen ab
- Verwendet Style-Variationen je nach Avatar-Beschreibung
- Optimiert für IDM-VTON Kompatibilität

**Ablauf:**
1. Cache prüfen (Key: `avatar_base_{avatarId}`)
2. Prompt generieren
3. Replicate API aufrufen (Flux 1.1 Pro, Aspekt 3:4)
4. Bild herunterladen → `public/generated/avatar_{id}_base.png`
5. `avatars.image_url` aktualisieren
6. In `generations`-Tabelle protokollieren

### Schritt 2: Virtual Try-On (IDM-VTON)

**Datei**: `generation-pipeline.js` → `generateOutfitImage(avatarId, date)`

Nimmt das Avatar-Basisbild + die Artikelbilder und „zieht" die Kleidung virtuell an.

**Ablauf:**
1. Avatar + heutiges Outfit aus DB laden
2. Falls kein Basisbild → automatisch Schritt 1 ausführen
3. Kleidungsartikel nach Layer sortieren: kleid → hose/rock → oberteil → jacke
4. Für jeden Kleidungsartikel: IDM-VTON API aufrufen
5. Ergebnis speichern → `public/generated/outfit_{id}_{datum}.png`

**Kategorie-Mapping für IDM-VTON:**
```
oberteil, jacke  →  upper_body
hose, rock       →  lower_body
kleid            →  dresses
```

### Schritt 3: Walking-Video (Kling v2.1)

**Datei**: `generation-pipeline.js` → `generateWalkAnimation(avatarId, date)`

Nimmt das Outfit-Bild und generiert eine Walking-Animation.

**Aktuell im Einsatz**: `kwaivgi/kling-v2.1` (in der `.env` über `VIDEO_MODEL` gesetzt).
Kling liefert die realistischste Gehbewegung – genau das, worauf es beim Catwalk ankommt.
Es erzeugt 5 Sekunden im Format 9:16, passend zur bildschirmfüllenden Fashion-Show.

**Unterstützte Video-Modelle** (umschaltbar über `VIDEO_MODEL` in der `.env`):

| Modell | `VIDEO_MODEL` | Kosten | Bemerkung |
|--------|---------------|--------|-----------|
| **Kling v2.1** | `kwaivgi/kling-v2.1` | ~$0.05–0.15 | **Aktuell aktiv**, beste Gehbewegung |
| Wan 2.1 I2V | `wavespeedai/wan-2.1-i2v-720p` | ~$0.03–0.08 | Schnell und günstig |
| Minimax Video-01 | `minimax/video-01` | ~$0.10–0.20 | Früherer Standard |
| Stable Video Diffusion | `stability-ai/stable-video-diffusion` | ~$0.03–0.05 | Fallback, nur 3 Sek |

Die Modellauswahl passiert in `ai-provider.js` → `generateWalkAnimation()`.
Der Code erkennt am Modellnamen, welche Eingabefelder die API erwartet
(`start_image` bei Kling, `first_frame_image` bei Minimax, `image` bei Wan).

> ⚠️ **Achtung**: Der Fallback-Wert im Code (`ai-provider.js`, `CONFIG.replicate.videoModel`)
> und die `.env.example` stehen noch auf `minimax/video-01`. Ohne einen Eintrag
> `VIDEO_MODEL=kwaivgi/kling-v2.1` in der `.env` würde also weiterhin Minimax laufen.

**Ablauf:**
1. Fertiges Outfit-Bild suchen (aus `generations`-Tabelle)
2. Walking-Prompt generieren (`buildWalkPrompt`)
3. Video-API aufrufen (10 Min Timeout!)
4. Video herunterladen → `public/generated/walk_{id}_{datum}.mp4`

### Komplett-Pipeline

**Datei**: `generation-pipeline.js` → `generateFullPipeline(avatarId, date)`

Führt alle 3 Schritte nacheinander aus. Überspringt Schritt 1 falls bereits ein Basisbild existiert.

### Caching & Queue

- **Caching**: Generierte Bilder werden gecacht (konfigurierbar: `GENERATION_CACHE_HOURS`, Standard: 24h)
- **Queue**: Maximal 2 gleichzeitige Generierungen (konfigurierbar: `MAX_CONCURRENT_GENERATIONS`)
- **Kostentracking**: Jede Generierung wird mit geschätzten Kosten protokolliert

---

## 8. Automatische Aufgaben (Scheduler)

Der Server erledigt inzwischen mehrere Dinge von selbst. Es braucht **keinen
externen Cron-Job** – alles läuft in `server/index.js` über `setTimeout` und
`setInterval`, solange der Server läuft.

### Übersicht

| Aufgabe | Wann | Wo im Code |
|---------|------|-----------|
| Datenbank-Backup | Bei jedem Serverstart + täglich um Mitternacht | `backupDatabase()` in `index.js` |
| Outfit-Zuweisung | Beim Start (falls heute noch keine) + Mitternacht | `services/outfit-rotation.js` |
| DSGVO-Bereinigung | Beim Start + Mitternacht | `index.js` (inline) |
| Verfügbarkeits-Check | 30 Sek nach dem Start, max. 1x pro Tag | `services/availability-checker.js` |
| ASIN-Check | 60 Sek nach dem Start, danach **alle 60 Minuten** | `services/asin-checker.js` |

### Mitternacht-Scheduler

`scheduleMidnightTasks()` rechnet die Millisekunden bis zur nächsten Mitternacht
aus, führt dann `runMidnightTasks()` aus und wiederholt das alle 24 Stunden.
Drei Aufgaben laufen dabei nacheinander:

**1. Datenbank-Backup (Finanzamt §147 AO)**
- Ziel: `data/backups/`
- `catwalk_daily_JJJJ-MM-TT.db` → ein Backup pro Tag, wird **unbegrenzt aufbewahrt**
  (10 Jahre Aufbewahrungspflicht)
- `catwalk_JJJJ-MM-TT_....db` → Zeitstempel-Backup bei jedem Serverstart,
  davon werden nur die **letzten 30** behalten, ältere automatisch gelöscht

**2. Outfit-Zuweisung für den neuen Tag**
- Nur wenn für das heutige Datum noch **kein** Outfit existiert
- `autoAssignOutfits(datum)` weist jedem Avatar passende Artikel zu, gesteuert über
  `STYLE_PREFERENCES` in `outfit-rotation.js` (Stil → Pflicht-/Optional-Kategorien,
  Preisklasse, bevorzugte Marken)

**3. DSGVO-Bereinigung**
- Löscht alle Einträge aus `click_stats`, die **älter als 90 Tage** sind
- Läuft zusätzlich bei jedem Serverstart

### ASIN-Checker (stündlich)

Prüft alle aktiven Artikel mit Amazon.de-Links. Er startet 60 Sekunden nach dem
Serverstart und wiederholt sich dann **alle 60 Minuten**.

Der Check unterscheidet drei Ergebnisse, weil Amazon automatisierte Zugriffe oft
blockiert:

| Status | Bedeutung | Reaktion |
|--------|-----------|----------|
| `ok` | HTTP 200–399, ASIN existiert | nichts |
| `broken` | HTTP 404, ASIN existiert wirklich nicht | **Ersatz-ASIN wird gesucht, eingesetzt und verifiziert** |
| `blocked` | 403/503/CAPTCHA/Timeout – Amazon hat geblockt | nichts, Link gilt als in Ordnung |

Das ist der wichtige Punkt: **Nur ein echtes 404 gilt als kaputt.** Der Checker
rotiert dafür durch mehrere realistische User-Agents. Manuell anstossen lässt sich
der Lauf über `GET /api/asin-check/run` oder per Doppelklick auf
`ASIN-CHECK-STARTEN.bat`.

### Verfügbarkeits-Check (täglich)

`availability-checker.js` prüft die Produkt-URLs **aller** Anbieter (nicht nur
Amazon) und schreibt das Ergebnis in die Tabelle `availability_checks`. Er erkennt
Bot-Schutz (403/429, Timeouts bei bekannten Shops, Redirect zur Startseite) und
deaktiviert Artikel standardmässig **nicht** automatisch. Bericht:
`GET /api/generate/availability/report`.

---

## 9. Wichtige Code-Muster

### Server-Start (async wegen sql.js)

```javascript
// server/index.js
async function startServer() {
  const { initDatabase } = require('./db');
  await initDatabase();  // MUSS vor allem kommen!
  
  const { initTables } = require('./init-db');
  await initTables();
  
  // Routes erst NACH DB-Initialisierung laden
  app.use('/api/avatars', require('./routes/avatars'));
  // ...
  
  app.listen(PORT);
}
startServer();
```

### Datenbank-Wrapper (sql.js → better-sqlite3-API)

```javascript
// db.js exportiert:
// - initDatabase()  → async, einmal aufrufen
// - getDb()         → synchron, danach nutzbar

// Nutzung in Routes:
const { getDb } = require('../db');
const db = getDb();

// SELECT (eine Zeile)
const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id);

// SELECT (alle Zeilen)
const all = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();

// INSERT / UPDATE / DELETE (speichert automatisch!)
db.prepare('INSERT INTO avatars (id, name) VALUES (?, ?)').run(id, name);
```

### .env Parsing (ohne dotenv)

Die `.env`-Datei wird in `server/index.js` manuell geparsed:

```javascript
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    // Kommentare und leere Zeilen überspringen
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}
```

### Replicate API Aufrufe

```javascript
// Prediction starten
const prediction = await httpRequest(`${baseUrl}/predictions`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'black-forest-labs/flux-1.1-pro', input: { ... } }),
});

// Auf Ergebnis warten (Polling alle 3 Sekunden)
const result = await this._waitForPrediction(prediction.id, maxWaitMs);
```

---

## 10. Frontend-Seiten

### admin.html (~1500 Zeilen)

Das Admin-Dashboard ist eine **Single-Page-App** mit Tab-Navigation:

| Tab | Beschreibung |
|-----|-------------|
| 🎭 Avatare | Avatare erstellen, bearbeiten, löschen |
| 🏪 Anbieter | Shops/Brands verwalten (Zalando, H&M, etc.) |
| 👗 Artikel | Produkte erfassen mit Shop-Link, Preis, Kategorie |
| 👔 Einkleiden | Avatar auswählen → Artikel per Klick zum Outfit hinzufügen |
| 🤖 KI-Generierung | 3-Stufen-Pipeline: Basisbild → Try-On → Video + Komplett-Pipeline |
| 📊 Statistiken | Klick-Tracking, Kosten-Übersicht |

### catwalk.html

Die öffentliche Catwalk-Ansicht. **Sie zeigt inzwischen echte KI-Videos, keine
CSS-Silhouetten mehr.**

- Jeder Avatar mit einem `generated_video` wird als `<video muted playsinline>`
  eingebunden (Marker `🎬 AI Video`); nur wo noch kein Video existiert, greift
  die alte Bild-/Silhouetten-Darstellung als Fallback
- **Full-Screen-Modus**: zwei überblendende `<video>`-Elemente (`fs-video-a` /
  `fs-video-b`) spielen die Models bildschirmfüllend nacheinander ab – wie bei
  einer echten Fashion Show
- Rahmenlose Darstellung mit Vignette; zwei Laufbahnen (rechts hin, links zurück,
  Rücklauf gespiegelt)
- Jedes Video läuft **einmal** durch, kein Doppel-Loop
- Zweisprachige Untertitel: Landessprache + Englisch
- Hover: Produktkachel mit Brand-Logo, Artikeln, Preisen
- Klick: Redirect zum Shop (`product_url` des Artikels)
- Responsive Design

Die Videos liegen unter `public/generated/` und kommen über
`GET /api/catwalk/show` als Feld `generated_video` ins Frontend.

### index.html

Einfache Startseite mit Links zu Catwalk und Admin.

### impressum.html / datenschutz.html

Rechtstexte, erreichbar über `/impressum` und `/datenschutz`.

---

## 11. Lokale Einrichtung (Windows)

### Voraussetzungen

1. **Node.js** ≥ 18 installieren: https://nodejs.org (LTS Version)
2. **Git** installieren: https://git-scm.com
3. **Replicate Account** erstellen: https://replicate.com
4. **API Token** generieren: https://replicate.com/account/api-tokens

### Installation

**Option A: Automatisch (Windows)**
```batch
:: Repository klonen und Script ausführen:
git clone https://github.com/frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern.git
cd Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern
git checkout claude/avatar-catwalk-shop-xcpvob
setup-windows.bat
```

**Option B: Manuell**
```bash
git clone https://github.com/frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern.git
cd Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern
git checkout claude/avatar-catwalk-shop-xcpvob
npm install
copy .env.example .env
:: .env bearbeiten und REPLICATE_API_TOKEN eintragen!
npm start
```

### .env Konfiguration

```env
PORT=3000
AI_PROVIDER=replicate
REPLICATE_API_TOKEN=r8_dein_token_hier
AVATAR_MODEL=black-forest-labs/flux-1.1-pro
TRYON_MODEL=cuuupid/idm-vton
VIDEO_MODEL=kwaivgi/kling-v2.1
MAX_CONCURRENT_GENERATIONS=2
GENERATION_CACHE_HOURS=24
IMAGE_QUALITY=medium
```

### Server starten

Am einfachsten per **Doppelklick auf `SERVER-STARTEN.bat`** – siehe Abschnitt 12.
Alternativ im Terminal:

```bash
npm start
# oder
node server/index.js
```

Dann im Browser:
- **Catwalk**: http://localhost:3000/catwalk
- **Admin**: http://localhost:3000/admin

Beim Start meldet der Server, welche Automatismen aktiv sind (Backup,
Outfit-Zuweisung, ASIN-Check, DSGVO-Bereinigung – siehe Abschnitt 8).

### Typische Windows-Probleme

| Problem | Lösung |
|---------|--------|
| `node: command not found` | Node.js installieren, PC neu starten |
| `EACCES permission denied` | Powershell als Administrator öffnen |
| `Port 3000 already in use` | Anderen Port in .env setzen: `PORT=3001` |
| `REPLICATE_API_TOKEN nicht gesetzt` | Token in `.env` Datei eintragen |

---

## 12. Start-Skripte (Windows)

Im Projektstamm liegen mehrere `.bat`-Dateien für den Alltag – alle per
Doppelklick bedienbar, kein Terminal nötig. Sie prüfen zuerst per `curl`, ob der
Server auf Port 3000 schon läuft.

| Datei | Wofür |
|-------|-------|
| **`SERVER-STARTEN.bat`** | Startet den Server (`npm start`) mit allen Automatismen. Läuft er schon, zeigt das Skript nur die Links. **Der übliche Einstieg.** |
| **`START-KI-GENERIERUNG.bat`** | Generiert die Styled Avatar-Bilder für alle 6 Avatare (`POST /api/generate/styled/batch/all?force=1`). Startet den Server bei Bedarf selbst. Dauer ca. 6–8 Min, Kosten ca. $0.25. |
| **`VIDEOS-GENERIEREN.bat`** | Menü mit 4 Optionen: nur Bilder, nur Walking-Videos, Komplett-Pipeline oder Abbrechen. Dauer 10–30 Min je nach Auswahl. |
| **`ASIN-CHECK-STARTEN.bat`** | Stösst den ASIN-Check sofort an (`GET /api/asin-check/run`), statt auf den stündlichen Lauf zu warten. Erklärt die Statusmeldungen. |
| `setup-windows.bat` | Einmaliges Ein-Klick-Setup (Installation). |

**Typischer Ablauf beim ersten Mal:**

1. `setup-windows.bat` → installiert alles
2. `.env` anlegen und `REPLICATE_API_TOKEN` eintragen
3. `SERVER-STARTEN.bat` → Server läuft, Outfits werden automatisch zugewiesen
4. `START-KI-GENERIERUNG.bat` → Avatar-Bilder erzeugen
5. `VIDEOS-GENERIEREN.bat` → Option 2, Walking-Videos erzeugen
6. http://localhost:3000/catwalk öffnen

> ⚠️ `VIDEOS-GENERIEREN.bat` nennt in den Menütexten noch **Minimax Video-01**
> und die alten Preise. Tatsächlich läuft Kling v2.1. Die Texte sollten noch
> angepasst werden.

> Die persönlichen Starter-Dateien (`claude-*.bat`) stehen in der `.gitignore`,
> weil jede Person ihre eigene hat.

---

## 13. Aktueller Entwicklungsstand

### ✅ Fertig

- [x] **Backend-Grundgerüst**: Express-Server mit allen API-Routen
- [x] **Datenbank**: sql.js Wrapper mit better-sqlite3-kompatibler API
- [x] **Admin-Dashboard**: Alle CRUD-Operationen für Avatare, Anbieter, Artikel
- [x] **Outfit-System**: Tägliche Zuordnung von Artikeln zu Avataren
- [x] **Catwalk-Frontend**: CSS-animierte Endlosschlaufe mit Produktkacheln
- [x] **Klick-Tracking**: Hover, Click, Redirect-Statistiken
- [x] **KI-Integration**: Replicate API mit 3 Modellen
- [x] **3-Stufen-Pipeline**: Avatar-Bild → Try-On → Walking-Video
- [x] **Komplett-Pipeline**: Ein Klick für alle 3 Schritte
- [x] **Batch-Generierung**: Alle Avatare auf einmal
- [x] **Caching**: Generierte Bilder werden wiederverwendet
- [x] **Kostentracking**: Automatische Erfassung und Berichte
- [x] **Windows-Kompatibilität**: sql.js statt better-sqlite3 (kein Compiler nötig)
- [x] **Setup-Script**: Ein-Klick-Installation für Windows
- [x] **Catwalk mit KI-Videos**: echte Walking-Videos statt CSS-Silhouetten
- [x] **Video-Player**: Full-Screen-Modus mit zwei überblendenden Video-Elementen
- [x] **Kling v2.1**: Wechsel von Minimax für realistischere Laufbewegungen
- [x] **Bildsprache**: rahmenlose Models, zwei Laufbahnen, einheitliche Kamera/Pose,
      zweisprachige Untertitel
- [x] **Mitternacht-Scheduler**: tägliches Backup, Outfit-Rotation, DSGVO-Bereinigung
- [x] **ASIN-Checker**: stündliche Prüfung mit Auto-Ersatz und Bot-Erkennung
- [x] **Verfügbarkeits-Check**: täglicher Check aller Shop-Links mit Bot-Schutz-Erkennung
- [x] **Tägliche Automatik**: Outfit-Rotation läuft ohne externen Cron-Job
- [x] **Backup-Verwaltung**: Finanzamt-konform (§147 AO), inkl. Restore-Endpunkt
- [x] **DSGVO**: 90-Tage-Bereinigung, Komplettauskunft, Lösch-Endpunkt
- [x] **Rechtstexte**: Impressum und Datenschutzerklärung
- [x] **CSV-Exporte**: Kosten, Artikel, Verfügbarkeit (für die Buchhaltung)
- [x] **Start-Skripte**: `SERVER-STARTEN.bat` und Co. für den Alltag ohne Terminal

### 🔄 Noch zu tun / Verbesserungsmöglichkeiten

- [ ] **Kostenangaben korrigieren**: `costEstimate` in `server/routes/generate.js`
      und die Texte in `VIDEOS-GENERIEREN.bat` nennen noch Minimax-Preise
- [ ] **Kling als Code-Standard**: Fallback in `ai-provider.js` und `.env.example`
      stehen noch auf `minimax/video-01`
- [ ] **Echte Produktbilder**: Artikel mit echten Produktfotos verknüpfen (für Try-On)
- [ ] **Hosting / Deployment**: Auf einen Server bringen (Railway, Render, Vercel)
- [ ] **Affiliate-Links**: Echte Affiliate-Tracking-URLs für die Shop-Links
- [ ] **Benutzer-Authentifizierung**: Admin-Bereich absichern (Login)
- [ ] **Mehr Avatare / Anbieter**: Echte Anbieter-Daten und Produktkataloge einpflegen
- [ ] **HTTPS / Domain**: SSL-Zertifikat und eigene Domain einrichten
- [ ] **Mobile-Optimierung**: Touch-Events und responsive Verbesserungen
- [ ] **Automatische Video-Erneuerung**: Videos werden bisher nur manuell erzeugt

---

## 14. Nächste Schritte / Offene Aufgaben

### Priorität 1: Sicherheit

⚠️ **WICHTIG**: Der Replicate API Token muss neu generiert werden!
Der alte Token wurde versehentlich in einem Chat geteilt und ist kompromittiert.
1. Gehe zu https://replicate.com/account/api-tokens
2. Lösche den alten Token
3. Erstelle einen neuen Token
4. Aktualisiere die `.env` Datei auf dem PC

### Priorität 2: Echte Produktbilder

Die Artikel brauchen echte Produktfotos (`image_url` in der `articles`-Tabelle), damit der Virtual Try-On (IDM-VTON) funktioniert. Derzeit sind keine Bilder hinterlegt.

**Möglichkeiten:**
- Produktbilder von den Shop-Seiten herunterladen und in `uploads/` ablegen
- Oder die `product_url` nutzen, um Bilder direkt zu referenzieren

### Priorität 3: Doku- und Code-Reste auf Kling umstellen ✍️

Der Wechsel auf Kling v2.1 ist über die `.env` erfolgt, aber an drei Stellen
steht noch Minimax:

1. `server/services/ai-provider.js` → `CONFIG.replicate.videoModel` (Fallback)
2. `.env.example` → `VIDEO_MODEL=minimax/video-01`
3. `server/routes/generate.js` → `costEstimate.perVideo` und die Monatswerte
   sowie die Menütexte in `VIDEOS-GENERIEREN.bat`

Solange die `.env` gesetzt ist, läuft alles korrekt – auf einem neuen Rechner
ohne `VIDEO_MODEL`-Eintrag würde aber wieder Minimax verwendet.

### Priorität 4: Videos automatisch erneuern

Die Walking-Videos werden bisher nur manuell über `VIDEOS-GENERIEREN.bat` erzeugt.
Der Mitternacht-Scheduler weist zwar täglich neue Outfits zu, generiert dazu aber
keine neuen Videos. Offene Frage: Lohnt sich das bei ~$0.05–0.15 pro Video täglich,
oder reicht ein wöchentlicher Lauf?

### ✅ Erledigt: Catwalk mit echten KI-Videos

Der Catwalk zeigt inzwischen die generierten Walking-Videos statt der
CSS-Silhouetten – inklusive bildschirmfüllendem Full-Screen-Modus.

---

## 15. Wichtige Hinweise & Konventionen

### Sprache

- **Alle Code-Kommentare**: Deutsch
- **Alle UI-Texte**: Deutsch (Schweizerdeutsch/Hochdeutsch)
- **Fehlermeldungen**: Deutsch
- **Variablennamen**: Englisch (Standard in der Programmierung)
- **Tabellenspalten**: Englisch
- **Kategorien in der Datenbank**: Deutsch (`oberteil`, `hose`, `kleid`, etc.)

### Git

- **Branch**: `claude/avatar-catwalk-shop-xcpvob`
- **Commit-Messages**: Deutsch, beschreibend
- **Niemals committen**: `.env`, `data/`, `node_modules/`, `public/generated/`

### API-Keys

- **NIEMALS** API-Keys in den Code oder in Git committen!
- Immer in `.env` speichern (die Datei ist in `.gitignore`)
- `.env.example` zeigt die Struktur, aber mit Platzhaltern

### Code-Stil

- Kein Linter/Formatter konfiguriert (noch)
- 2 Spaces Einrückung
- Single Quotes in JavaScript
- `const` statt `let` wenn möglich
- Template Literals mit Backticks für String-Interpolation

---

*Dieses Dokument wurde als Übergabe-Kontext erstellt, damit mehrere Personen
gleichzeitig am Projekt arbeiten können. Bei Fragen einfach Claude fragen –
der hat jetzt den vollen Kontext!* 🎭
