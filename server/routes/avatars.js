const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db');

const router = express.Router();

// ═══════════════════════════════════════════════════
// WICHTIG: Spezifische Routen MÜSSEN vor /:id kommen!
// Sonst fängt /:id z.B. "reset-images" als ID ab.
// ═══════════════════════════════════════════════════

// Alle Avatare abrufen
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const avatars = db.prepare(`
      SELECT * FROM avatars WHERE is_active = 1 ORDER BY position_order ASC
    `).all();
    res.json(avatars);
  } catch (err) {
    console.error('❌ Fehler beim Laden der Avatare:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Alle Avatar-Bild-URLs zurücksetzen (für Neugenerierung)
router.post('/reset-images', (req, res) => {
  try {
    const db = getDb();

    // ALLE generierten Bild- und Video-Dateien löschen
    const generatedDir = path.join(__dirname, '..', '..', 'public', 'generated');
    if (fs.existsSync(generatedDir)) {
      const files = fs.readdirSync(generatedDir);
      let deleted = 0;
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.mp4') || file.endsWith('.webm')) {
          try {
            fs.unlinkSync(path.join(generatedDir, file));
            deleted++;
          } catch (e) { /* ignore */ }
        }
      }
      if (deleted > 0) console.log(`🗑️ ${deleted} alte generierte Dateien gelöscht`);
    }

    db.prepare(`
      UPDATE avatars SET image_url = '', silhouette_url = '', updated_at = datetime('now')
      WHERE is_active = 1
    `).run();

    // ALLE Generations-Cache-Einträge löschen (avatar_base, img2img, tryon, walk_animation)
    // damit keine alten (Männer-)Bilder mehr angezeigt werden
    db.prepare(`DELETE FROM generations`).run();

    const avatars = db.prepare('SELECT id, name FROM avatars WHERE is_active = 1').all();
    console.log(`✅ ${avatars.length} Avatar-Bilder zurückgesetzt:`, avatars.map(a => a.name).join(', '));
    res.json({
      message: `${avatars.length} Avatar-Bilder zurückgesetzt`,
      count: avatars.length,
      avatars: avatars.map(a => a.name),
    });
  } catch (err) {
    console.error('❌ Fehler beim Zurücksetzen:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Gelöschte Avatare anzeigen
router.get('/deleted/list', (req, res) => {
  try {
    const db = getDb();
    const deleted = db.prepare(`
      SELECT * FROM avatars WHERE is_active = 0 ORDER BY name ASC
    `).all();
    res.json(deleted);
  } catch (err) {
    console.error('❌ Fehler beim Laden gelöschter Avatare:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ALLE gelöschten Avatare wiederherstellen
router.post('/restore-all/batch', (req, res) => {
  try {
    const db = getDb();
    const deleted = db.prepare('SELECT id, name FROM avatars WHERE is_active = 0').all();

    if (deleted.length === 0) {
      return res.json({ message: 'Keine gelöschten Avatare gefunden', count: 0, avatars: [] });
    }

    db.prepare(`
      UPDATE avatars SET is_active = 1, updated_at = datetime('now') WHERE is_active = 0
    `).run();

    console.log(`♻️ ${deleted.length} Avatar(e) wiederhergestellt:`, deleted.map(a => a.name).join(', '));
    res.json({
      message: `${deleted.length} Avatar(e) wiederhergestellt`,
      count: deleted.length,
      avatars: deleted.map(a => a.name),
    });
  } catch (err) {
    console.error('❌ Fehler beim Wiederherstellen:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Gelöschten Avatar wiederherstellen (einzeln)
router.post('/restore/:id', (req, res) => {
  try {
    const db = getDb();
    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
    if (!avatar) return res.status(404).json({ error: 'Avatar nicht gefunden' });

    db.prepare(`
      UPDATE avatars SET is_active = 1, updated_at = datetime('now') WHERE id = ?
    `).run(req.params.id);

    const restored = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
    res.json({ message: `Avatar "${restored.name}" wiederhergestellt`, avatar: restored });
  } catch (err) {
    console.error('❌ Fehler beim Wiederherstellen:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// Ab hier: Routen mit /:id Parameter
// ═══════════════════════════════════════════════════

// Einzelnen Avatar abrufen
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
    if (!avatar) return res.status(404).json({ error: 'Avatar nicht gefunden' });
    res.json(avatar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Neuen Avatar erstellen
router.post('/', (req, res) => {
  try {
    const db = getDb();
    const id = uuidv4();
    const { name, description, image_url, silhouette_url, walk_animation, position_order } = req.body;

    if (!name) return res.status(400).json({ error: 'Name ist erforderlich' });

    const stmt = db.prepare(`
      INSERT INTO avatars (id, name, description, image_url, silhouette_url, walk_animation, position_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, description || '', image_url || '', silhouette_url || '',
      walk_animation || 'default', position_order || 0);

    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(id);
    res.status(201).json(avatar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Avatar aktualisieren
router.put('/:id', (req, res) => {
  try {
    const db = getDb();
    const { name, description, image_url, silhouette_url, walk_animation, position_order, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Avatar nicht gefunden' });

    const stmt = db.prepare(`
      UPDATE avatars SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        silhouette_url = COALESCE(?, silhouette_url),
        walk_animation = COALESCE(?, walk_animation),
        position_order = COALESCE(?, position_order),
        is_active = COALESCE(?, is_active),
        updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(name, description, image_url, silhouette_url, walk_animation,
      position_order, is_active, req.params.id);

    const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(req.params.id);
    res.json(avatar);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Avatar löschen (soft delete)
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE avatars SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ message: 'Avatar deaktiviert' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Avatar-Outfit für ein bestimmtes Datum abrufen
router.get('/:id/outfit', (req, res) => {
  try {
    const db = getDb();
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const outfit = db.prepare(`
      SELECT ao.*, a.name as article_name, a.category, a.price, a.currency,
             a.product_url, a.image_url as article_image, a.color, a.size,
             p.name as provider_name, p.brand_name, p.logo_url, p.website_url
      FROM avatar_outfits ao
      JOIN articles a ON ao.article_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ao.avatar_id = ? AND ao.outfit_date = ?
      ORDER BY ao.layer_order ASC
    `).all(req.params.id, date);

    res.json(outfit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Outfit für Avatar setzen (Artikel zuweisen)
router.post('/:id/outfit', (req, res) => {
  try {
    const db = getDb();
    const { article_id, outfit_date, layer_order } = req.body;
    const date = outfit_date || new Date().toISOString().split('T')[0];
    const id = uuidv4();

    if (!article_id) return res.status(400).json({ error: 'article_id ist erforderlich' });

    const stmt = db.prepare(`
      INSERT INTO avatar_outfits (id, avatar_id, article_id, outfit_date, layer_order)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, req.params.id, article_id, date, layer_order || 0);

    res.status(201).json({ id, avatar_id: req.params.id, article_id, outfit_date: date });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Dieser Artikel ist bereits für dieses Datum zugewiesen' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Outfit-Artikel entfernen
router.delete('/:id/outfit/:outfitId', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM avatar_outfits WHERE id = ? AND avatar_id = ?')
      .run(req.params.outfitId, req.params.id);
    res.json({ message: 'Artikel aus Outfit entfernt' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Komplettes Outfit für ein Datum löschen
router.delete('/:id/outfit', (req, res) => {
  try {
    const db = getDb();
    const date = req.query.date || new Date().toISOString().split('T')[0];
    db.prepare('DELETE FROM avatar_outfits WHERE avatar_id = ? AND outfit_date = ?')
      .run(req.params.id, date);
    res.json({ message: 'Outfit gelöscht' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
