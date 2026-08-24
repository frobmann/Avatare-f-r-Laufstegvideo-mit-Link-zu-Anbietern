const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// .env Unterstützung (ohne dotenv-Dependency)
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statische Dateien
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Verzeichnisse sicherstellen
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'public', 'generated'), { recursive: true });

// ─── Server starten (async wegen sql.js Initialisierung) ───

async function startServer() {
  // Datenbank initialisieren
  const { initDatabase, DB_PATH } = require('./db');
  await initDatabase();

  // Tabellen erstellen falls nötig
  const { initTables } = require('./init-db');
  await initTables();

  // API Routes (erst nach DB-Initialisierung laden!)
  app.use('/api/avatars', require('./routes/avatars'));
  app.use('/api/providers', require('./routes/providers'));
  app.use('/api/articles', require('./routes/articles'));
  app.use('/api/catwalk', require('./routes/catwalk'));
  app.use('/api/generate', require('./routes/generate'));

  // Admin Dashboard
  app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
  });

  // Catwalk Ansicht
  app.get('/catwalk', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'catwalk.html'));
  });

  // Startseite
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
  });

  // Error Handler
  app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Interner Serverfehler', details: err.message });
  });

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║  🎭 Avatar Catwalk Shop System                  ║
║  ────────────────────────────────────────────    ║
║  🌐 Server:    http://localhost:${PORT}            ║
║  👔 Admin:     http://localhost:${PORT}/admin       ║
║  🎬 Catwalk:   http://localhost:${PORT}/catwalk     ║
║  📡 API:       http://localhost:${PORT}/api         ║
╚══════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(err => {
  console.error('❌ Server konnte nicht gestartet werden:', err);
  process.exit(1);
});
