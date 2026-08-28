const express = require('express');
const fs = require('fs');
const path = require('path');
const {
  generateAvatarBaseImage,
  generateAllAvatarImages,
  generateOutfitImage,
  generateWalkAnimation,
  generateFullPipeline,
  generateAllOutfits,
  generateStyledAvatar,
  generateAllStyledAvatars,
  getGenerationHistory,
  getCostSummary,
} = require('../services/generation-pipeline');
const { CONFIG, buildAvatarPrompt } = require('../services/ai-provider');
const { autoAssignOutfits, rotateOutfits, previewOutfits } = require('../services/outfit-rotation');
const { getDb } = require('../db');
const { execSync } = require('child_process');

const router = express.Router();

// Debug: Zeigt die aktuellen Prompts (ohne Generierung)
router.get('/debug-prompts', (req, res) => {
  try {
    const db = getDb();
    const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();

    let gitBranch = 'unknown';
    try { gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim(); } catch(e) {}

    const prompts = avatars.map(a => ({
      name: a.name,
      prompt: buildAvatarPrompt(a),
      containsWoman: buildAvatarPrompt(a).includes('woman'),
      imageUrl: a.image_url,
    }));

    res.json({
      gitBranch,
      avatarCount: avatars.length,
      prompts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provider-Status prüfen
router.get('/status', (req, res) => {
  const provider = process.env.AI_PROVIDER || 'replicate';
  const hasToken = provider === 'replicate'
    ? !!process.env.REPLICATE_API_TOKEN
    : provider === 'huggingface'
      ? !!process.env.HUGGINGFACE_API_TOKEN
      : true;

  res.json({
    provider,
    configured: hasToken,
    avatarModel: CONFIG.replicate.avatarModel,
    tryonModel: CONFIG.replicate.tryonModel,
    videoModel: CONFIG.replicate.videoModel,
    quality: process.env.IMAGE_QUALITY || 'medium',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_GENERATIONS) || 2,
    costEstimate: {
      perAvatar: '$0.03–0.05',
      perTryOn: '$0.01–0.03',
      perVideo: '$0.10–0.20',
      perFullPipeline: '$0.15–0.30',
      daily6Avatars: '$0.90–1.80',
      monthly6Avatars: '$27–54',
    },
  });
});

// ── Avatar-Basisbild generieren ──

router.post('/avatar/:avatarId', async (req, res) => {
  try {
    const result = await generateAvatarBaseImage(req.params.avatarId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alle Avatar-Basisbilder generieren (Batch)
router.post('/avatars/batch', async (req, res) => {
  try {
    const result = await generateAllAvatarImages();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Outfit-Bild generieren (Try-On) ──

router.post('/outfit/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateOutfitImage(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Walking-Video generieren ──

router.post('/video/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateWalkAnimation(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Walking-Videos für alle Avatare (Batch) ──

router.post('/videos/batch', async (req, res) => {
  try {
    const db = getDb();
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();
    const results = [];

    console.log(`\n🎬 BATCH: Walking-Videos für ${avatars.length} Avatare generieren...\n`);

    for (const avatar of avatars) {
      try {
        console.log(`\n🎬 Video für "${avatar.name}"...`);
        const result = await generateWalkAnimation(avatar.id, date);
        results.push({ avatarId: avatar.id, name: avatar.name, ...result });

        // 10 Sekunden Pause zwischen Videos (Rate-Limit)
        if (avatars.indexOf(avatar) < avatars.length - 1) {
          console.log('   ⏳ Warte 10 Sekunden (Rate-Limit)...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } catch (err) {
        console.log(`   ❌ Fehler bei ${avatar.name}: ${err.message}`);
        results.push({ avatarId: avatar.id, name: avatar.name, success: false, error: err.message });
      }
    }

    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
    console.log(`\n✅ Video-Batch fertig! Gesamtkosten: $${totalCost.toFixed(4)}\n`);

    res.json({ results, totalCost, date });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Komplett-Pipeline (Bild → Try-On → Video) ──

router.post('/pipeline/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateFullPipeline(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Batch: Alle Outfits generieren ──

router.post('/batch', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateAllOutfits(date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Styled Avatare: Outfit + Hintergrund entfernen ──

router.post('/styled/:avatarId', async (req, res) => {
  try {
    const result = await generateStyledAvatar(req.params.avatarId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/styled/batch/all', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.body.force === true;
    const result = await generateAllStyledAvatars({ force });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Generierungs-Historie ──

router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = getGenerationHistory(limit);
  res.json(history);
});

// ── Kosten-Übersicht ──

router.get('/costs', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const costs = getCostSummary(days);
  res.json(costs);
});

// ═══════════════════════════════════════════════════
// OUTFIT-ROTATION (Automatische Outfit-Zuordnung)
// ═══════════════════════════════════════════════════

// Vorschau: Was würde zugeordnet werden?
router.get('/outfits/preview', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const preview = previewOutfits(date);
  res.json(preview);
});

// Auto-Zuordnung: Outfits für heute (oder gewähltes Datum) automatisch zuweisen
router.post('/outfits/auto-assign', (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = autoAssignOutfits(date, {
      clearExisting: req.body.clearExisting !== false,
      respectStyles: req.body.respectStyles !== false,
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    console.log(`👗 Auto-Outfits zugewiesen für ${date}:`, result.summary);
    res.json(result);
  } catch (err) {
    console.error('❌ Auto-Outfit Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rotation: Alte Outfits löschen und neue zuweisen
router.post('/outfits/rotate', (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = rotateOutfits(date);
    if (!result.success) {
      return res.status(400).json(result);
    }
    console.log(`🔄 Outfits rotiert für ${date}:`, result.summary);
    res.json(result);
  } catch (err) {
    console.error('❌ Rotation Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// VERFÜGBARKEITS-CHECK (Artikel-URLs prüfen)
// ═══════════════════════════════════════════════════

const { checkAllArticles, getLastCheckReport } = require('../services/availability-checker');

// Alle Artikel-URLs prüfen
router.post('/availability/check', async (req, res) => {
  try {
    const deactivateUnavailable = req.body.deactivateUnavailable === true;
    const result = await checkAllArticles({ deactivateUnavailable });
    res.json(result);
  } catch (err) {
    console.error('❌ Verfügbarkeits-Check Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Letzten Check-Bericht abrufen
router.get('/availability/report', (req, res) => {
  const report = getLastCheckReport();
  res.json(report);
});

// ═══════════════════════════════════════════════════
// DATENBANK-BACKUP (Automatische Sicherung)
// ═══════════════════════════════════════════════════

const { DB_PATH } = require('../db');

// Verfügbare Backups auflisten
router.get('/backups', (req, res) => {
  try {
    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json({ backups: [], message: 'Noch keine Backups vorhanden' });
    }

    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('catwalk_') && f.endsWith('.db'))
      .map(f => {
        const stats = fs.statSync(path.join(backupDir, f));
        // Datum aus Dateinamen extrahieren (catwalk_2026-08-26T14-30-00.db)
        const dateStr = f.replace('catwalk_', '').replace('.db', '').replace(/-/g, (m, i) => {
          // Nur die T und danach für Zeitformat anpassen
          return m;
        });
        return {
          filename: f,
          size: Math.round(stats.size / 1024) + ' KB',
          created: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.created.localeCompare(a.created));

    res.json({ backups, backupDir });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backup wiederherstellen
router.post('/backups/restore', (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) return res.status(400).json({ error: 'Dateiname fehlt' });

    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    const backupPath = path.join(backupDir, filename);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ error: 'Backup nicht gefunden' });
    }

    // Aktuelle DB sichern bevor wir überschreiben
    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safePath = path.join(backupDir, `catwalk_pre-restore_${now}.db`);
    if (fs.existsSync(DB_PATH)) {
      fs.copyFileSync(DB_PATH, safePath);
    }

    // Backup wiederherstellen
    fs.copyFileSync(backupPath, DB_PATH);

    res.json({
      success: true,
      message: `Backup "${filename}" wiederhergestellt. Bitte Server neustarten (npm start).`,
      restoredFrom: filename,
      previousSavedAs: path.basename(safePath),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manuelles Backup erstellen
router.post('/backups/create', (req, res) => {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return res.status(404).json({ error: 'Keine Datenbank vorhanden' });
    }

    const backupDir = path.join(path.dirname(DB_PATH), 'backups');
    fs.mkdirSync(backupDir, { recursive: true });

    const now = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const label = req.body.label || 'manual';
    const backupPath = path.join(backupDir, `catwalk_${label}_${now}.db`);
    fs.copyFileSync(DB_PATH, backupPath);

    const stats = fs.statSync(backupPath);
    res.json({
      success: true,
      filename: path.basename(backupPath),
      size: Math.round(stats.size / 1024) + ' KB',
      message: 'Backup erfolgreich erstellt',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// FINANZAMT-EXPORT (CSV-Dateien für Buchhaltung)
// ═══════════════════════════════════════════════════

// CSV-Export: KI-Generierungskosten (für Finanzamt / Buchhaltung)
router.get('/export/costs-csv', (req, res) => {
  try {
    const db = getDb();
    const year = req.query.year || new Date().getFullYear();

    const rows = db.prepare(`
      SELECT
        g.id,
        a.name as avatar_name,
        g.type,
        g.status,
        g.cost,
        g.cache_key,
        g.created_at,
        g.error_message
      FROM generations g
      JOIN avatars a ON g.avatar_id = a.id
      WHERE strftime('%Y', g.created_at) = ?
      ORDER BY g.created_at ASC
    `).all(String(year));

    // CSV erstellen (UTF-8 BOM für Excel-Kompatibilität)
    const BOM = '﻿';
    const header = 'ID;Avatar;Typ;Status;Kosten (USD);Cache-Key;Datum;Fehler\n';
    const csvRows = rows.map(r => {
      const type = r.type === 'tryon' ? 'Outfit Try-On' : r.type === 'walk_animation' ? 'Walking-Video' : 'Avatar-Bild';
      const status = r.status === 'completed' ? 'Erfolgreich' : r.status === 'failed' ? 'Fehlgeschlagen' : r.status;
      const cost = (r.cost || 0).toFixed(4);
      return `${r.id};${r.avatar_name};${type};${status};${cost};${r.cache_key || ''};${r.created_at};${(r.error_message || '').replace(/;/g, ',')}`;
    }).join('\n');

    const totalCost = rows.reduce((sum, r) => sum + (r.cost || 0), 0);
    const summary = `\n\nZUSAMMENFASSUNG ${year};\n` +
      `Gesamt Generierungen;${rows.length}\n` +
      `Erfolgreich;${rows.filter(r => r.status === 'completed').length}\n` +
      `Fehlgeschlagen;${rows.filter(r => r.status === 'failed').length}\n` +
      `Gesamtkosten (USD);${totalCost.toFixed(4)}\n` +
      `Exportiert am;${new Date().toISOString()}\n`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="KI-Kosten_${year}.csv"`);
    res.send(BOM + header + csvRows + summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV-Export: Alle Artikel und Anbieter (Warenwirtschaft)
router.get('/export/articles-csv', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT
        a.id, a.name, a.category, a.price, a.currency,
        a.color, a.size, a.product_url, a.image_url,
        a.is_active,
        p.brand_name, p.name as provider_name, p.website_url,
        a.created_at
      FROM articles a
      JOIN providers p ON a.provider_id = p.id
      ORDER BY p.brand_name, a.name
    `).all();

    const BOM = '﻿';
    const header = 'ID;Artikelname;Kategorie;Preis;Währung;Farbe;Größe;Produkt-URL;Bild-URL;Aktiv;Marke;Anbieter;Anbieter-URL;Erstellt\n';
    const csvRows = rows.map(r =>
      `${r.id};${r.name};${r.category};${(r.price || 0).toFixed(2)};${r.currency || 'EUR'};${r.color || ''};${r.size || ''};${r.product_url || ''};${r.image_url || ''};${r.is_active ? 'Ja' : 'Nein'};${r.brand_name};${r.provider_name};${r.website_url || ''};${r.created_at || ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Artikel-Uebersicht_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(BOM + header + csvRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV-Export: Verfügbarkeits-Checks
router.get('/export/availability-csv', (req, res) => {
  try {
    const db = getDb();

    // Tabelle prüfen
    try { db.exec(`CREATE TABLE IF NOT EXISTS availability_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, article_id TEXT, article_name TEXT,
      brand_name TEXT, product_url TEXT, status_code INTEGER, is_available INTEGER DEFAULT 1,
      error_message TEXT DEFAULT '', check_type TEXT DEFAULT 'ok',
      checked_at TEXT DEFAULT (datetime('now'))
    )`); } catch(e) {}

    const rows = db.prepare(`
      SELECT * FROM availability_checks ORDER BY checked_at DESC
    `).all();

    const BOM = '﻿';
    const header = 'ID;Artikel;Marke;URL;HTTP-Status;Verfügbar;Fehler;Check-Typ;Geprüft am\n';
    const csvRows = rows.map(r =>
      `${r.id};${r.article_name || ''};${r.brand_name || ''};${r.product_url || ''};${r.status_code || ''};${r.is_available ? 'Ja' : 'Nein'};${(r.error_message || '').replace(/;/g, ',')};${r.check_type || ''};${r.checked_at || ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Verfuegbarkeits-Checks_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(BOM + header + csvRows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// DSGVO-EXPORT (Art. 15, 17, 20 DSGVO)
// ═══════════════════════════════════════════════════

// DSGVO Art. 15+20: Alle gespeicherten Daten als JSON exportieren
router.get('/export/dsgvo-complete', (req, res) => {
  try {
    const db = getDb();

    const data = {
      exportDatum: new Date().toISOString(),
      hinweis: 'Vollständiger Datenexport gem. Art. 15 DSGVO (Auskunftsrecht) und Art. 20 DSGVO (Datenportabilität)',
      system: 'Avatar Catwalk Shop System',

      avatare: db.prepare('SELECT * FROM avatars ORDER BY position_order').all(),
      anbieter: db.prepare('SELECT * FROM providers ORDER BY brand_name').all(),
      artikel: db.prepare(`
        SELECT a.*, p.brand_name FROM articles a JOIN providers p ON a.provider_id = p.id ORDER BY p.brand_name, a.name
      `).all(),
      outfits: db.prepare(`
        SELECT ao.*, a.name as article_name, av.name as avatar_name
        FROM avatar_outfits ao
        JOIN articles a ON ao.article_id = a.id
        JOIN avatars av ON ao.avatar_id = av.id
        ORDER BY ao.outfit_date DESC, av.name
      `).all(),
    };

    // Optionale Tabellen
    try {
      data.generierungen = db.prepare('SELECT * FROM generations ORDER BY created_at DESC').all();
    } catch(e) { data.generierungen = []; }

    try {
      data.klick_statistiken = db.prepare('SELECT * FROM click_stats ORDER BY timestamp DESC').all();
    } catch(e) { data.klick_statistiken = []; }

    try {
      data.verfuegbarkeits_checks = db.prepare('SELECT * FROM availability_checks ORDER BY checked_at DESC').all();
    } catch(e) { data.verfuegbarkeits_checks = []; }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="DSGVO-Datenexport_${new Date().toISOString().split('T')[0]}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DSGVO Art. 17: Klick-Statistiken löschen (Recht auf Löschung)
router.delete('/export/dsgvo-delete-stats', (req, res) => {
  try {
    const db = getDb();
    let deleted = 0;

    try {
      const result = db.prepare('DELETE FROM click_stats').run();
      deleted = result.changes;
    } catch(e) {}

    res.json({
      success: true,
      message: `${deleted} Klick-Statistik-Einträge gelöscht (Art. 17 DSGVO)`,
      deletedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
