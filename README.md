# 🎭 Avatar Catwalk Shop

Interaktives Avatar-Laufsteg-System mit Anbieter-Verlinkung. Avatare laufen in einer Endlosschlaufe über den virtuellen Catwalk – Kunden können auf die Avatare klicken und werden direkt zum Anbieter-Shop weitergeleitet.

## 🏗 Architektur

```
┌─────────────────────┐     ┌──────────────────────┐
│   Admin Dashboard   │────▶│     REST API          │
│   /admin            │     │     /api/*            │
│                     │     │                       │
│  • Avatare anlegen  │     │  • Avatare CRUD       │
│  • Anbieter pflegen │     │  • Anbieter CRUD      │
│  • Artikel erfassen │     │  • Artikel CRUD       │
│  • Tägliches Outfit │     │  • Outfits zuweisen   │
│    zuweisen         │     │  • Catwalk-Daten      │
└─────────────────────┘     │  • Klick-Statistiken  │
                            └──────────┬───────────┘
                                       │
┌─────────────────────┐                │
│   Catwalk Frontend  │◀───────────────┘
│   /catwalk          │
│                     │
│  • Endlos-Animation │
│  • Hover → Kachel   │
│  • Klick → Shop     │
│  • Responsive       │
└─────────────────────┘
```

## 🚀 Schnellstart

```bash
# Dependencies installieren
npm install

# Datenbank initialisieren
npm run init-db

# (Optional) Beispieldaten laden
npm run seed

# Server starten
npm start
```

Dann öffnen:
- **Startseite**: http://localhost:3000
- **Catwalk**: http://localhost:3000/catwalk
- **Admin**: http://localhost:3000/admin

## 📋 Workflow

### 1. Anbieter anlegen
Im Admin unter "🏪 Anbieter" die Shops erfassen (z.B. Zalando, H&M, ZARA).

### 2. Artikel erfassen
Unter "👗 Artikel" die Produkte mit **Produkt-URL** (direkt zum Shop), Preis, Kategorie und optional Farbe anlegen.

### 3. Avatare erstellen
Unter "🎭 Avatare" die virtuellen Models erstellen.

### 4. Täglich einkleiden
Im Bereich "👔 Einkleiden":
1. Avatar auswählen
2. Datum setzen (Standard: heute)
3. Artikel per Klick zum Outfit hinzufügen
4. Fertig – der Catwalk zeigt das Outfit sofort an

### 5. Catwalk teilen
Die URL `/catwalk` kann direkt eingebettet oder geteilt werden. Kunden sehen die laufenden Avatare und können:
- **Hovern** → Produktkachel mit Brand, Preis und allen Artikeln
- **Artikel klicken** → Direkte Weiterleitung zum Shop
- **"Ganzen Look shoppen"** → Alle Artikel-Links öffnen sich

## 🗂 Datenbank-Schema

| Tabelle | Beschreibung |
|---------|-------------|
| `avatars` | Avatar-Definitionen (Name, Bild, Position) |
| `providers` | Anbieter/Brands (Name, Website, Affiliate-URL) |
| `articles` | Artikel (Name, Kategorie, Preis, Shop-Link, Farbe) |
| `avatar_outfits` | Tägliche Outfit-Zuordnung (Avatar ↔ Artikel ↔ Datum) |
| `catwalk_config` | Laufsteg-Konfiguration (Farben, Geschwindigkeit) |
| `click_stats` | Klick-Tracking (Hover, Click, Redirect) |

### Artikel-Kategorien
`kopfbedeckung` · `oberteil` · `jacke` · `hose` · `rock` · `kleid` · `schuhe` · `accessoire` · `tasche` · `schmuck`

## 📡 API-Endpunkte

### Avatare
| Method | Endpunkt | Beschreibung |
|--------|---------|-------------|
| GET | `/api/avatars` | Alle Avatare |
| POST | `/api/avatars` | Avatar erstellen |
| PUT | `/api/avatars/:id` | Avatar aktualisieren |
| DELETE | `/api/avatars/:id` | Avatar deaktivieren |
| GET | `/api/avatars/:id/outfit?date=` | Outfit abrufen |
| POST | `/api/avatars/:id/outfit` | Artikel zum Outfit hinzufügen |
| DELETE | `/api/avatars/:id/outfit/:outfitId` | Artikel entfernen |

### Anbieter
| Method | Endpunkt | Beschreibung |
|--------|---------|-------------|
| GET | `/api/providers` | Alle Anbieter |
| POST | `/api/providers` | Anbieter erstellen |
| PUT | `/api/providers/:id` | Anbieter aktualisieren |
| DELETE | `/api/providers/:id` | Anbieter deaktivieren |

### Artikel
| Method | Endpunkt | Beschreibung |
|--------|---------|-------------|
| GET | `/api/articles` | Alle Artikel (Filter: `category`, `provider_id`, `search`) |
| POST | `/api/articles` | Artikel erstellen |
| PUT | `/api/articles/:id` | Artikel aktualisieren |
| DELETE | `/api/articles/:id` | Artikel deaktivieren |

### Catwalk
| Method | Endpunkt | Beschreibung |
|--------|---------|-------------|
| GET | `/api/catwalk/show` | Catwalk-Daten (Avatare + Outfits) |
| GET | `/api/catwalk/config` | Konfiguration |
| PUT | `/api/catwalk/config` | Konfiguration ändern |
| POST | `/api/catwalk/stats` | Klick erfassen |
| GET | `/api/catwalk/stats` | Statistiken abrufen |

## 🤖 Seed Models Integration

Für realistische KI-generierte Avatar-Videos mit Virtual Try-On siehe die detaillierte Kostenanalyse:

➡️ **[docs/SEED_MODELS_KOSTENANALYSE.md](docs/SEED_MODELS_KOSTENANALYSE.md)**

**Kurzfassung:**
- **~$105/Monat** für 6 Avatare mit Seed 2.5 API
- **Phase 1 (jetzt)**: CSS-animiertes System als kostenfreies MVP
- **Phase 2+**: Seed 2.5 Integration für fotorealistische Ergebnisse

## 🛠 Technologie-Stack

- **Backend**: Node.js + Express
- **Datenbank**: SQLite (better-sqlite3)
- **Frontend**: Vanilla HTML/CSS/JS
- **Animation**: CSS Animations + JavaScript
- **Deployment**: Jeder Node.js Host (Vercel, Railway, Render, etc.)

## 📄 Lizenz

MIT
