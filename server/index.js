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

// Statische Dateien – KEIN Browser-Cache für HTML/CSS/JS
app.use('/generated', express.static(path.join(__dirname, '..', 'public', 'generated'), {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  setHeaders: (res, filePath) => {
    // HTML, CSS, JS: nie cachen – Änderungen sofort sichtbar
    if (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Verzeichnisse sicherstellen
fs.mkdirSync(path.join(__dirname, '..', 'uploads'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '..', 'public', 'generated'), { recursive: true });

// ─── Automatisches Datenbank-Backup (Finanzamt §147 AO: 10 Jahre Aufbewahrungspflicht) ───

function backupDatabase(dbPath) {
  if (!fs.existsSync(dbPath)) return;
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });

  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Tägliches Backup (max 1 pro Tag, beschriftet mit Datum)
  const dailyBackup = path.join(backupDir, `catwalk_daily_${dateStr}.db`);
  const fullBackup = path.join(backupDir, `catwalk_${timestamp}.db`);

  try {
    // Immer ein vollständiges Backup mit Zeitstempel
    fs.copyFileSync(dbPath, fullBackup);
    console.log(`💾 Datenbank-Backup erstellt: ${path.basename(fullBackup)}`);

    // Tägliches Backup (1x pro Tag, wird nicht überschrieben)
    if (!fs.existsSync(dailyBackup)) {
      fs.copyFileSync(dbPath, dailyBackup);
      console.log(`📅 Tages-Backup erstellt: ${path.basename(dailyBackup)}`);
    }

    // Aufräumen: Zeitstempel-Backups (catwalk_2026-...) – nur letzte 30 behalten
    // ABER: Tages-Backups (catwalk_daily_...) bleiben UNBEGRENZT (Finanzamt!)
    const timestampBackups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('catwalk_2') && f.endsWith('.db') && !f.includes('daily') && !f.includes('pre-restore'))
      .sort()
      .reverse();

    for (let i = 30; i < timestampBackups.length; i++) {
      fs.unlinkSync(path.join(backupDir, timestampBackups[i]));
    }

    // Info: Wie viele Tages-Backups existieren
    const dailyCount = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('catwalk_daily_')).length;
    console.log(`📊 ${dailyCount} Tages-Backups vorhanden (Finanzamt-konform, unbegrenzt aufbewahrt)`);

  } catch (e) {
    console.log('⚠️ Backup fehlgeschlagen:', e.message);
  }
}

// ─── Server starten (async wegen sql.js Initialisierung) ───

async function startServer() {
  // Datenbank initialisieren
  const { initDatabase, DB_PATH } = require('./db');

  // Automatisches Backup vor dem Start (falls DB existiert)
  backupDatabase(DB_PATH);

  await initDatabase();

  // Tabellen erstellen falls nötig
  const { initTables } = require('./init-db');
  await initTables();

  // ─── Auto-Seed: Datenbank automatisch befüllen wenn leer oder veraltet ───
  try {
    const { getDb } = require('./db');
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const avatarCount = db.prepare('SELECT COUNT(*) as c FROM avatars WHERE is_active = 1').get().c;
    const articleCount = db.prepare('SELECT COUNT(*) as c FROM articles WHERE is_active = 1').get().c;
    const providerCount = db.prepare('SELECT COUNT(*) as c FROM providers WHERE is_active = 1').get().c;

    // Automatisch Seed-Daten laden wenn DB leer ist
    if (avatarCount === 0 || articleCount === 0 || providerCount === 0) {
      console.log('🌱 Datenbank leer – lade Seed-Daten automatisch...');
      try {
        const { seedProviders } = require('./seed-providers');
        await seedProviders();
        console.log('✅ Seed-Daten erfolgreich geladen');
      } catch (seedErr) {
        console.log('⚠️ Seed-Daten konnten nicht geladen werden:', seedErr.message);
      }
    }
  } catch (e) {
    console.log('⚠️ Auto-Seed übersprungen:', e.message);
  }

  // ─── Automatisch Outfits zuweisen wenn nötig ───
  try {
    const { getDb } = require('./db');
    const db = getDb();
    const today = new Date().toISOString().split('T')[0];

    const avatarCount = db.prepare('SELECT COUNT(*) as c FROM avatars WHERE is_active = 1').get().c;
    const articleCount = db.prepare('SELECT COUNT(*) as c FROM articles WHERE is_active = 1').get().c;
    const outfitCount = db.prepare('SELECT COUNT(*) as c FROM avatar_outfits WHERE outfit_date = ?').get(today).c;

    if (avatarCount > 0 && articleCount > 0 && outfitCount === 0) {
      console.log('👗 Keine Outfits für heute – weise automatisch zu...');
      const { autoAssignOutfits } = require('./services/outfit-rotation');
      const result = autoAssignOutfits(today);
      if (result.success) {
        console.log(`✅ ${result.summary.totalArticles} Artikel auf ${result.summary.avatars} Avatare verteilt (€ ${result.summary.totalValue.toFixed(2)})`);
      }
    } else if (outfitCount > 0) {
      console.log(`👗 ${outfitCount} Outfits für heute bereits vorhanden`);
    }
  } catch (e) {
    console.log('⚠️ Auto-Outfit übersprungen:', e.message);
  }

  // Täglicher Verfügbarkeits-Check (im Hintergrund, nach 30s Verzögerung)
  try {
    const { wasCheckedToday, checkAllArticles } = require('./services/availability-checker');
    if (!wasCheckedToday()) {
      console.log('🔍 Täglicher Verfügbarkeits-Check wird in 30s gestartet...');
      setTimeout(async () => {
        try {
          const result = await checkAllArticles({ deactivateUnavailable: false, delayMs: 2000 });
          if (result.unavailable > 0) {
            console.log(`⚠️ ${result.unavailable} Artikel nicht erreichbar – Details: GET /api/generate/availability/report`);
          } else {
            console.log('✅ Alle Artikel verfügbar');
          }
        } catch (e) {
          console.log('⚠️ Verfügbarkeits-Check fehlgeschlagen:', e.message);
        }
      }, 30000);
    } else {
      console.log('🔍 Verfügbarkeits-Check heute bereits durchgeführt');
    }
  } catch (e) {
    console.log('⚠️ Verfügbarkeits-Check übersprungen:', e.message);
  }

  // ─── DSGVO: Automatische Bereinigung alter Klick-Statistiken (90 Tage) ───
  try {
    const { getDb } = require('./db');
    const db = getDb();
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const deleted = db.prepare('DELETE FROM click_stats WHERE timestamp < ?').run(cutoff);
    if (deleted.changes > 0) {
      console.log(`🔒 DSGVO: ${deleted.changes} Klick-Statistiken älter als 90 Tage gelöscht`);
    } else {
      console.log('🔒 DSGVO: Keine alten Klick-Statistiken zu bereinigen');
    }
  } catch (e) {
    console.log('⚠️ DSGVO-Bereinigung übersprungen:', e.message);
  }

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

  // ── Rechtliche Seiten (Pflicht in Deutschland) ──
  app.get('/impressum', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'impressum.html'));
  });
  app.get('/datenschutz', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'datenschutz.html'));
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
