# 💰 Kostenanalyse: Seed Models für Avatar-Catwalk

## Was sind Seed Models?

**Seed** ist ByteDances AI-Video- und Bild-Generierungsmodell. Die Version **Seed 2.5** (auch als "Seed1.5-VL" oder "Seedance" bekannt) kann:
- Realistische Avatar-Videos generieren
- Virtual Try-On (virtuelles Anprobieren) von Kleidung
- Catwalk-Animationen aus Standbildern erzeugen

---

## 🔄 Einsatz-Szenario für unser System

| Anwendung | Beschreibung |
|-----------|-------------|
| **Avatar-Generierung** | Erstmaliges Generieren der Avatar-Modelle (Ganzkörper) |
| **Virtual Try-On** | Tägliches Einkleiden der Avatare mit neuen Artikeln |
| **Catwalk-Video** | Animation der eingekleideten Avatare auf dem Laufsteg |
| **Endlosschlaufe** | Zusammenführen zu einem Loop-Video |

---

## 💵 Kostenübersicht Seed Models 2.5

### Option A: Seed API (ByteDance / Volcengine)

| Leistung | Kosten (geschätzt) | Einheit |
|----------|-------------------|---------|
| **Bild-Generierung** (Avatar-Erstellung) | ~$0.02 – $0.05 | pro Bild |
| **Virtual Try-On** (Kleidung auftragen) | ~$0.03 – $0.08 | pro Bild |
| **Video-Generierung** (5-10 Sek. Clip) | ~$0.10 – $0.30 | pro Clip |
| **Video-Generierung** (HD, 10+ Sek.) | ~$0.30 – $0.80 | pro Clip |

### Tägliche Kosten (6 Avatare)

| Posten | Berechnung | Kosten/Tag |
|--------|-----------|------------|
| Virtual Try-On | 6 Avatare × ~4 Artikel × $0.05 | **~$1.20** |
| Catwalk-Video pro Avatar | 6 × $0.30 | **~$1.80** |
| Zusammenführung/Loop | 1 × $0.50 | **~$0.50** |
| **Gesamt pro Tag** | | **~$3.50** |
| **Gesamt pro Monat (30 Tage)** | | **~$105** |
| **Gesamt pro Jahr** | | **~$1'260** |

### Option B: Seed Self-Hosted (eigener GPU-Server)

| Komponente | Kosten/Monat |
|-----------|-------------|
| GPU-Server (A100/H100 Cloud) | $1'500 – $3'000 |
| Seed Model Weights (Open-Source-Variante) | $0 (kostenlos) |
| Speicher & Bandbreite | ~$50 – $100 |
| **Gesamt pro Monat** | **$1'550 – $3'100** |

> ⚠️ Self-Hosting lohnt sich erst ab **~50+ Videos/Tag** oder wenn man volle Kontrolle über die Pipeline braucht.

---

## 🔀 Alternative KI-Modelle (Vergleich)

| Modell/Service | Try-On/Bild | Video (10s) | Monatlich (6 Avatare) | Bemerkung |
|---------------|------------|------------|---------------------|-----------|
| **Seed 2.5** | ~$0.05 | ~$0.30 | **~$105** | ByteDance, sehr realistisch |
| **Runway Gen-3** | – | $0.25–$0.50 | ~$90–$180 | Nur Video, kein Try-On |
| **Kling AI** | ~$0.04 | ~$0.20 | ~$75 | Kuaishou, günstiger |
| **Stable Diffusion + AnimateDiff** | ~$0.01 (self-hosted) | ~$0.05 | ~$20 | Open Source, weniger Qualität |
| **DALL-E 3 + Sora** | $0.04 | $0.15–$0.40 | ~$80–$150 | OpenAI, hohe Qualität |
| **Midjourney + Pika** | $0.04 | ~$0.20 | ~$80 | Midjourney Bilder + Pika Videos |
| **Kolors VTON** (Kuaishou) | ~$0.03 | – | ~$30 (nur Try-On) | Spezialisiert auf Try-On |
| **IDM-VTON** (Open Source) | $0 (self-hosted) | – | GPU-Kosten | Nur Virtual Try-On |

---

## 📊 Kostenszenarien

### Szenario 1: Klein (3 Avatare, Budget)
| Posten | Ansatz | Monat |
|--------|--------|-------|
| Try-On | Kling AI | ~$12 |
| Video | Kling AI | ~$18 |
| **Total** | | **~$30/Monat** |

### Szenario 2: Standard (6 Avatare, Seed 2.5)
| Posten | Ansatz | Monat |
|--------|--------|-------|
| Try-On | Seed 2.5 API | ~$36 |
| Video | Seed 2.5 API | ~$54 |
| Loop-Zusammenführung | Seed 2.5 API | ~$15 |
| **Total** | | **~$105/Monat** |

### Szenario 3: Premium (10 Avatare, Multi-Provider)
| Posten | Ansatz | Monat |
|--------|--------|-------|
| Try-On | Seed 2.5 API | ~$60 |
| Video | Seed 2.5 + Runway Gen-3 | ~$120 |
| Loop & Postproduction | Seed 2.5 | ~$30 |
| CDN & Hosting | Cloud | ~$20 |
| **Total** | | **~$230/Monat** |

### Szenario 4: Enterprise (20+ Avatare, Self-Hosted)
| Posten | Ansatz | Monat |
|--------|--------|-------|
| GPU-Server (A100) | Cloud GPU | ~$2'000 |
| Bandbreite & CDN | Cloud | ~$100 |
| Wartung & DevOps | Personal | ~$500 |
| **Total** | | **~$2'600/Monat** |

---

## 🔧 Empfohlene Architektur mit Seed 2.5

```
┌──────────────────────────────────────────────────────┐
│                    Admin Dashboard                    │
│  (Avatare verwalten, Artikel zuweisen, Links setzen) │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│              Outfit-Zusammenstellung                  │
│    Avatar + Artikel-Links → API-Konfiguration        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│         Seed 2.5 Virtual Try-On Pipeline             │
│  ┌─────────┐  ┌──────────┐  ┌──────────────────┐    │
│  │ Avatar- │→ │ Kleidung │→ │ Outfit-Composite │    │
│  │ Bild    │  │ auftragen│  │ (fertiges Bild)  │    │
│  └─────────┘  └──────────┘  └──────────────────┘    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│        Seed 2.5 Video-Generierung                    │
│  ┌──────────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ Outfit-Bild  │→ │ Catwalk-  │→ │ Endlos-Loop  │  │
│  │ als Referenz │  │ Animation │  │ zusammensetzen│  │
│  └──────────────┘  └───────────┘  └──────────────┘  │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│          Interaktives Web-Frontend                    │
│  Video-Loop + Klickbare Hotspots + Produkt-Kacheln   │
│  → Weiterleitung zum Anbieter-Shop                   │
└──────────────────────────────────────────────────────┘
```

---

## ⚡ Empfehlung

Für den **Start** empfehle ich **Szenario 2 (Seed 2.5 API)** weil:

1. **~$105/Monat** ist überschaubar für ein Fashion-Startup
2. **Seed 2.5** hat die beste Qualität für Virtual Try-On
3. **Kein eigener GPU-Server** nötig (API-basiert)
4. **Skalierbar** – bei mehr Avataren steigen die Kosten linear
5. Das jetzige **CSS-basierte Backbone** funktioniert bereits als MVP ohne AI-Kosten

### Stufenplan:
1. **Phase 1 (jetzt)**: CSS-animiertes Backbone-System (dieses Repo) → **$0/Monat**
2. **Phase 2**: Seed 2.5 Try-On Integration für realistische Avatar-Bilder → **+$36/Monat**
3. **Phase 3**: Seed 2.5 Video-Generierung für Catwalk-Clips → **+$69/Monat**
4. **Phase 4**: Bei Erfolg → Self-Hosted GPU für volle Kontrolle

---

## 📌 Wichtige Links

- Seed API: https://www.volcengine.com/docs/82379
- Seed Paper: https://arxiv.org/abs/2407.04236
- Seedance (Video): Über Volcengine Platform verfügbar
- Kolors VTON (Alternative): https://github.com/Kwai-Kolors/Kolors
- IDM-VTON (Open Source Try-On): https://github.com/yisol/IDM-VTON

---

*Stand: August 2026 – Preise können sich ändern. API-Preise basieren auf öffentlich verfügbaren Informationen und geschätzten Marktpreisen.*
