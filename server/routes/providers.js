const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

// Alle Anbieter abrufen
router.get('/', (req, res) => {
  const db = getDb();
  const providers = db.prepare('SELECT * FROM providers WHERE is_active = 1 ORDER BY brand_name ASC').all();
  res.json(providers);
});

// Einzelnen Anbieter abrufen
router.get('/:id', (req, res) => {
  const db = getDb();
  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });
  res.json(provider);
});

// Neuen Anbieter erstellen
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { name, brand_name, logo_url, website_url, affiliate_base_url } = req.body;

  if (!name || !brand_name || !website_url) {
    return res.status(400).json({ error: 'Name, Brand-Name und Website-URL sind erforderlich' });
  }

  db.prepare(`
    INSERT INTO providers (id, name, brand_name, logo_url, website_url, affiliate_base_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, brand_name, logo_url || '', website_url, affiliate_base_url || '');

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id);
  res.status(201).json(provider);
});

// Anbieter aktualisieren
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, brand_name, logo_url, website_url, affiliate_base_url, is_active } = req.body;

  db.prepare(`
    UPDATE providers SET
      name = COALESCE(?, name),
      brand_name = COALESCE(?, brand_name),
      logo_url = COALESCE(?, logo_url),
      website_url = COALESCE(?, website_url),
      affiliate_base_url = COALESCE(?, affiliate_base_url),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name, brand_name, logo_url, website_url, affiliate_base_url, is_active, req.params.id);

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(req.params.id);
  res.json(provider);
});

// Anbieter deaktivieren
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE providers SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Anbieter deaktiviert' });
});

// Alle Artikel eines Anbieters
router.get('/:id/articles', (req, res) => {
  const db = getDb();
  const articles = db.prepare(`
    SELECT * FROM articles WHERE provider_id = ? AND is_active = 1
    ORDER BY category, name
  `).all(req.params.id);
  res.json(articles);
});

module.exports = router;
