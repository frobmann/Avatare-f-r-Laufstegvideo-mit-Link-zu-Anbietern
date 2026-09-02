# 🌐 Hosting-Anleitung – Fashion Catwalk

> Diese Anleitung erklärt Schritt für Schritt, wie du deine Fashion Show
> online stellst, damit Instagram- und TikTok-Follower über die Links
> einkaufen können – **24 Stunden am Tag, 7 Tage die Woche**.

---

## 📋 Warum Hosting?

Wenn jemand auf Instagram oder TikTok deinen Link klickt, muss die Seite
sofort laden. Dein PC kann nicht rund um die Uhr laufen. Ein Hoster
übernimmt das für dich – wie ein Mietcomputer in einem Rechenzentrum.

---

## 🏆 Empfohlene Hosting-Anbieter

### Option 1: Railway.app (⭐ Empfehlung für Einsteiger)

| Eigenschaft | Details |
|-------------|---------|
| **Preis** | ~5 $/Monat (nutzungsbasiert) |
| **Schwierigkeit** | ⭐ Sehr einfach (1-Klick-Deploy) |
| **Server-Standort** | EU verfügbar |
| **DSGVO** | ✅ EU-Server wählbar |
| **Eigene Domain** | ✅ Ja, kostenlos |

**So geht's:**

1. Gehe zu **https://railway.app** und erstelle ein Konto (GitHub-Login)
2. Klicke auf **„New Project"** → **„Deploy from GitHub Repo"**
3. Wähle das Repository **`Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern`**
4. Railway erkennt die `railway.json` automatisch
5. Unter **„Variables"** die API-Keys eintragen:
   - `REPLICATE_API_TOKEN` = dein Replicate-Key
   - `AMAZON_ACCESS_KEY` = dein Amazon PA-API Key (wenn vorhanden)
   - `AMAZON_SECRET_KEY` = dein Amazon Secret Key (wenn vorhanden)
   - `AMAZON_PARTNER_TAG` = dein Amazon-Affiliate-Tag
6. Klicke **„Deploy"** – fertig! 🎉

**Domain einrichten:**
- Railway gibt dir automatisch eine URL wie `fashion-catwalk-production.up.railway.app`
- Eigene Domain: Settings → Domains → Custom Domain hinzufügen

---

### Option 2: Render.com (Guter Mittelweg)

| Eigenschaft | Details |
|-------------|---------|
| **Preis** | ~7 $/Monat (Starter Plan) |
| **Schwierigkeit** | ⭐⭐ Einfach |
| **Server-Standort** | Frankfurt (EU) |
| **DSGVO** | ✅ EU-Server |
| **Eigene Domain** | ✅ Ja, kostenlos |

**So geht's:**

1. Gehe zu **https://render.com** und erstelle ein Konto
2. Klicke **„New"** → **„Web Service"**
3. Verbinde dein GitHub-Konto und wähle das Repository
4. Render erkennt die `render.yaml` automatisch
5. Unter **„Environment"** die API-Keys eintragen (wie bei Railway)
6. Klicke **„Create Web Service"** – fertig! 🎉

---

### Option 3: Hetzner Cloud + Docker (⭐ Empfehlung für Profis)

| Eigenschaft | Details |
|-------------|---------|
| **Preis** | 3,29 €/Monat (CX22) |
| **Schwierigkeit** | ⭐⭐⭐ Mittel (Terminal-Befehle nötig) |
| **Server-Standort** | Nürnberg / Falkenstein (Deutschland!) |
| **DSGVO** | ✅ 100% deutsche Server |
| **Eigene Domain** | ✅ Ja (DNS selbst einrichten) |

**Der günstigste und DSGVO-sicherste Weg – Server steht in Deutschland!**

**So geht's:**

1. Gehe zu **https://www.hetzner.com/cloud** → Konto erstellen
2. Erstelle einen Server:
   - **Standort:** Nürnberg oder Falkenstein
   - **Betriebssystem:** Ubuntu 24.04
   - **Typ:** CX22 (2 CPU, 4 GB RAM) – reicht völlig
   - **SSH-Key** hinzufügen (oder Passwort wählen)
3. Verbinde dich mit dem Server (per SSH oder Hetzner Console)
4. Führe folgende Befehle aus:

```bash
# 1. Docker installieren
curl -fsSL https://get.docker.com | sh

# 2. Projekt herunterladen
git clone https://github.com/frobmann/Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern.git
cd Avatare-f-r-Laufstegvideo-mit-Link-zu-Anbietern

# 3. Umgebungsvariablen setzen
cp .env.example .env
nano .env
# → Hier deine API-Keys eintragen, speichern mit Strg+O, schließen mit Strg+X

# 4. Starten!
docker compose up -d

# 5. Prüfen ob alles läuft
docker compose logs -f
# (Beenden mit Strg+C)
```

5. Die Seite läuft jetzt unter `http://DEINE-SERVER-IP:3000`

**HTTPS (SSL) einrichten (empfohlen für Produktion):**

```bash
# Caddy als Reverse-Proxy installieren (automatisches SSL)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Caddy-Konfiguration erstellen
sudo tee /etc/caddy/Caddyfile << 'EOF'
deine-domain.de {
    reverse_proxy localhost:3000
}
EOF

# Caddy neu starten
sudo systemctl restart caddy
```

Ersetze `deine-domain.de` mit deiner eigenen Domain. Caddy holt sich
automatisch ein SSL-Zertifikat von Let's Encrypt.

---

### Option 4: Netcup (Deutsches Unternehmen)

| Eigenschaft | Details |
|-------------|---------|
| **Preis** | ab 2,72 €/Monat (RS 1000 G11) |
| **Schwierigkeit** | ⭐⭐⭐ Mittel |
| **Server-Standort** | Nürnberg (Deutschland) |
| **DSGVO** | ✅ 100% deutsches Unternehmen |

Setup genau wie bei Hetzner (Ubuntu + Docker).
Website: **https://www.netcup.de**

---

## 🔧 Nach dem Deploy

### Links für Instagram/TikTok

Wenn deine Seite online ist (z.B. `https://fashion-catwalk.up.railway.app`),
dann sind das deine Links:

| Seite | URL |
|-------|-----|
| **Fashion Show** | `https://DEINE-URL/catwalk` |
| **Link in Bio** | `https://DEINE-URL/linkinbio` |
| **Social Export** | `https://DEINE-URL/social` |
| **Admin** | `https://DEINE-URL/admin` |

### Instagram/TikTok Bio einrichten

1. Gehe in dein **Instagram-Profil** → **Profil bearbeiten**
2. Bei **Website** eintragen: `https://DEINE-URL/linkinbio`
3. Dasselbe bei **TikTok** → Profil → Bio-Link

Wenn jemand auf „Link in Bio" klickt, sieht er:
- Die aktuelle Fashion Show
- Alle Models mit ihren Outfits
- Direkte Amazon-Links zu jedem Kleidungsstück 🛒

### Eigene Domain (optional aber empfohlen)

Eine eigene Domain wie `fashion-catwalk.de` sieht professioneller aus:

1. Domain kaufen bei z.B. **INWX** (ab 5 €/Jahr) oder **Netcup**
2. DNS-Einstellung: CNAME oder A-Record auf deinen Host zeigen lassen
3. Bei deinem Hoster die Domain hinterlegen (SSL kommt automatisch)

---

## 💰 Kostenübersicht

| Anbieter | Monatlich | Jährlich | Bemerkung |
|----------|-----------|----------|-----------|
| Railway | ~5 $ | ~60 $ | Einfachste Option |
| Render | ~7 $ | ~84 $ | EU-Server in Frankfurt |
| Hetzner | 3,29 € | ~40 € | Günstigste, DSGVO-Top |
| Netcup | 2,72 € | ~33 € | Günstigste überhaupt |
| Domain | ~0,50 € | ~6 € | Optional, empfohlen |

**Tipp:** Wenn du über Amazon Affiliate 1-2 Verkäufe pro Monat machst,
sind die Hosting-Kosten schon bezahlt! 💸

---

## ⚠️ Wichtig vor dem Online-Gang

1. **Impressum und Datenschutz ausfüllen!**
   - Öffne `public/impressum.html` und ersetze alle `[...]` Platzhalter
   - Öffne `public/datenschutz.html` und ersetze alle `[...]` Platzhalter
   - **Pflicht in Deutschland!** (§ 5 TMG / Art. 13 DSGVO)

2. **Amazon Associates anmelden:**
   - https://partnernet.amazon.de/
   - Partner-Tag erstellen
   - In die `.env` oder Hosting-Umgebungsvariablen eintragen

3. **API-Keys niemals öffentlich teilen!**
   - Die `.env` steht in `.gitignore` und wird nicht hochgeladen
   - Keys immer über die Umgebungsvariablen des Hosters eintragen

---

## 🆘 Hilfe

Probleme? Prüfe folgendes:

```bash
# Läuft der Container?
docker compose ps

# Logs anschauen
docker compose logs -f

# Container neu starten
docker compose restart

# Container komplett neu bauen
docker compose down
docker compose up -d --build
```

**Health-Check URL:** `https://DEINE-URL/api/health`
Dort siehst du ob der Server läuft und wie viele Avatare geladen sind.
