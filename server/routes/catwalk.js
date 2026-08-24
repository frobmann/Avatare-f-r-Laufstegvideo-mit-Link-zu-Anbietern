const express = require('express');
const { getDb } = require('../db');

const router = express.Router();

// Catwalk-Daten für die öffentliche Anzeige (Avatare + heutige Outfits)
router.get('/show', (req, res) => {
  const db = getDb();
  const date = req.query.date || new Date().toISOString().split('T')[0];

  // Alle aktiven Avatare mit ihren heutigen Outfits
  const avatars = db.prepare(`
    SELECT * FROM avatars WHERE is_active = 1 ORDER BY position_order ASC
  `).all();

  const avatarsWithOutfits = avatars.map(avatar => {
    const outfit = db.prepare(`
      SELECT ao.id as outfit_id, ao.layer_order,
             a.id as article_id, a.name as article_name, a.category,
             a.price, a.currency, a.product_url, a.image_url as article_image,
             a.color, a.size,
             p.brand_name, p.name as provider_name, p.logo_url, p.website_url
      FROM avatar_outfits ao
      JOIN articles a ON ao.article_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ao.avatar_id = ? AND ao.outfit_date = ?
      ORDER BY ao.layer_order ASC
    `).all(avatar.id, date);

    const totalPrice = outfit.reduce((sum, item) => sum + item.price, 0);

    // Generiertes Bild suchen (falls vorhanden)
    let generated_image = null;
    let generated_video = null;
    try {
      const genImg = db.prepare(`
        SELECT output_path FROM generations
        WHERE avatar_id = ? AND type = 'tryon' AND status = 'completed'
        AND output_path != ''
        ORDER BY created_at DESC LIMIT 1
      `).get(avatar.id);
      if (genImg && genImg.output_path) {
        generated_image = '/' + genImg.output_path.replace(/^public\//, '');
      }

      const genVid = db.prepare(`
        SELECT output_path FROM generations
        WHERE avatar_id = ? AND type = 'walk_animation' AND status = 'completed'
        AND output_path != ''
        ORDER BY created_at DESC LIMIT 1
      `).get(avatar.id);
      if (genVid && genVid.output_path) {
        generated_video = '/' + genVid.output_path.replace(/^public\//, '');
      }
    } catch (e) { /* generations table may not exist yet */ }

    return {
      ...avatar,
      outfit,
      generated_image,
      generated_video,
      total_price: Math.round(totalPrice * 100) / 100,
      currency: outfit.length > 0 ? outfit[0].currency : 'CHF'
    };
  });

  // Catwalk Konfiguration
  const config = db.prepare('SELECT * FROM catwalk_config WHERE id = ?').get('main');

  res.json({
    config,
    avatars: avatarsWithOutfits,
    date
  });
});

// Catwalk-Konfiguration abrufen
router.get('/config', (req, res) => {
  const db = getDb();
  const config = db.prepare('SELECT * FROM catwalk_config WHERE id = ?').get('main');
  res.json(config);
});

// Catwalk-Konfiguration aktualisieren
router.put('/config', (req, res) => {
  const db = getDb();
  const { title, background_image, background_color, runway_color,
    music_url, speed, loop_enabled, show_brand_on_hover } = req.body;

  db.prepare(`
    UPDATE catwalk_config SET
      title = COALESCE(?, title),
      background_image = COALESCE(?, background_image),
      background_color = COALESCE(?, background_color),
      runway_color = COALESCE(?, runway_color),
      music_url = COALESCE(?, music_url),
      speed = COALESCE(?, speed),
      loop_enabled = COALESCE(?, loop_enabled),
      show_brand_on_hover = COALESCE(?, show_brand_on_hover),
      updated_at = datetime('now')
    WHERE id = 'main'
  `).run(title, background_image, background_color, runway_color,
    music_url, speed, loop_enabled, show_brand_on_hover);

  const config = db.prepare('SELECT * FROM catwalk_config WHERE id = ?').get('main');
  res.json(config);
});

// Klick-Statistik erfassen
router.post('/stats', (req, res) => {
  const db = getDb();
  const { avatar_id, article_id, action } = req.body;

  if (!avatar_id || !action) {
    return res.status(400).json({ error: 'avatar_id und action sind erforderlich' });
  }

  db.prepare(`
    INSERT INTO click_stats (avatar_id, article_id, action) VALUES (?, ?, ?)
  `).run(avatar_id, article_id || null, action);

  res.status(201).json({ message: 'Statistik erfasst' });
});

// Statistiken abrufen
router.get('/stats', (req, res) => {
  const db = getDb();
  const days = parseInt(req.query.days) || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const stats = db.prepare(`
    SELECT
      cs.avatar_id, av.name as avatar_name,
      cs.action,
      COUNT(*) as count
    FROM click_stats cs
    JOIN avatars av ON cs.avatar_id = av.id
    WHERE cs.timestamp >= ?
    GROUP BY cs.avatar_id, cs.action
    ORDER BY count DESC
  `).all(since.toISOString());

  const topArticles = db.prepare(`
    SELECT
      cs.article_id, a.name as article_name, p.brand_name,
      cs.action,
      COUNT(*) as count
    FROM click_stats cs
    JOIN articles a ON cs.article_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE cs.timestamp >= ? AND cs.article_id IS NOT NULL
    GROUP BY cs.article_id, cs.action
    ORDER BY count DESC
    LIMIT 20
  `).all(since.toISOString());

  res.json({ avatar_stats: stats, top_articles: topArticles, period_days: days });
});

module.exports = router;
