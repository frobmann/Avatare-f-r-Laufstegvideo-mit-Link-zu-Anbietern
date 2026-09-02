# ═══════════════════════════════════════════════
# Fashion Catwalk – Docker Container
# Für Hosting auf Hetzner, Netcup, oder anderem VPS
# ═══════════════════════════════════════════════

FROM node:20-slim

WORKDIR /app

# Abhängigkeiten installieren (Cache-freundlich)
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# App-Dateien kopieren
COPY server/ ./server/
COPY public/ ./public/
COPY .env.example ./.env.example

# Verzeichnisse erstellen
RUN mkdir -p data uploads public/generated data/backups

# Benutzer ohne Root-Rechte (Sicherheit)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
RUN chown -R appuser:appgroup /app
USER appuser

# Port und Healthcheck
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:3000',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

# Server starten
CMD ["node", "server/index.js"]
