const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

// Alle Artikel abrufen (mit Filter)
router.get('/', (req, res) => {
  const db = getDb();
  let query = `
    SELECT a.*, p.brand_name, p.name as provider_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `;
  const params = [];

  if (req.query.category) {
    query += ' AND a.category = ?';
    params.push(req.query.category);
  }
  if (req.query.provider_id) {
    query += ' AND a.provider_id = ?';
    params.push(req.query.provider_id);
  }
  if (req.query.search) {
    query += ' AND (a.name LIKE ? OR p.brand_name LIKE ?)';
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }

  query += ' ORDER BY a.category, a.name';
  const articles = db.prepare(query).all(...params);
  res.json(articles);
});

// Einzelnen Artikel abrufen
router.get('/:id', (req, res) => {
  const db = getDb();
  const article = db.prepare(`
    SELECT a.*, p.brand_name, p.name as provider_name, p.website_url
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.id = ?
  `).get(req.params.id);
  if (!article) return res.status(404).json({ error: 'Artikel nicht gefunden' });
  res.json(article);
});

// Neuen Artikel erstellen
router.post('/', (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const { provider_id, name, category, price, currency, product_url, image_url, color, size } = req.body;

  if (!provider_id || !name || !category || price == null || !product_url) {
    return res.status(400).json({
      error: 'provider_id, name, category, price und product_url sind erforderlich'
    });
  }

  // Prüfe ob Anbieter existiert
  const provider = db.prepare('SELECT id FROM providers WHERE id = ?').get(provider_id);
  if (!provider) return res.status(404).json({ error: 'Anbieter nicht gefunden' });

  db.prepare(`
    INSERT INTO articles (id, provider_id, name, category, price, currency, product_url, image_url, color, size)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, provider_id, name, category, price, currency || 'CHF', product_url, image_url || '', color || '', size || '');

  const article = db.prepare(`
    SELECT a.*, p.brand_name FROM articles a
    JOIN providers p ON a.provider_id = p.id WHERE a.id = ?
  `).get(id);
  res.status(201).json(article);
});

// Artikel aktualisieren
router.put('/:id', (req, res) => {
  const db = getDb();
  const { name, category, price, currency, product_url, image_url, color, size, is_active } = req.body;

  db.prepare(`
    UPDATE articles SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      price = COALESCE(?, price),
      currency = COALESCE(?, currency),
      product_url = COALESCE(?, product_url),
      image_url = COALESCE(?, image_url),
      color = COALESCE(?, color),
      size = COALESCE(?, size),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(name, category, price, currency, product_url, image_url, color, size, is_active, req.params.id);

  const article = db.prepare(`
    SELECT a.*, p.brand_name FROM articles a
    JOIN providers p ON a.provider_id = p.id WHERE a.id = ?
  `).get(req.params.id);
  res.json(article);
});

// Artikel deaktivieren
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE articles SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Artikel deaktiviert' });
});

module.exports = router;
