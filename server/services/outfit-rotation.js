/**
 * Outfit-Rotation: Automatische Outfit-Zuordnung
 *
 * Weist jedem Avatar automatisch passende Artikel zu,
 * basierend auf dem Stil des Avatars und verfügbaren Artikeln.
 */

const { getDb } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Stil-zu-Kategorie Zuordnungen
// Alle Artikel über Amazon verkauft (Affiliate-Kommission!)
const STYLE_PREFERENCES = {
  'Jeans Style': {
    required: ['oberteil', 'hose', 'schuhe'],
    optional: ['accessoire', 'kopfbedeckung'],
    priceRange: 'budget',
    preferBrands: ['ONLY', 'Levi\'s', 'Vero Moda', 'Tom Tailor', 'Tamaris'],
  },
  'Business Style': {
    required: ['oberteil', 'hose', 'schuhe'],
    optional: ['jacke', 'schmuck', 'tasche'],
    priceRange: 'premium',
    preferBrands: ['Esprit', 'SELECTED FEMME', 'BOSS', 'GANT', 'Tommy Hilfiger'],
  },
  'Sportlich-elegant': {
    required: ['oberteil', 'hose', 'schuhe'],
    optional: ['jacke', 'accessoire'],
    priceRange: 'mid',
    preferBrands: ['Marc O\'Polo', 'Calvin Klein', 'ONLY', 'Geox', 'Jack Wolfskin'],
  },
  'Quiet Luxury / Minimalismus': {
    required: ['oberteil', 'hose', 'schuhe'],
    optional: ['jacke', 'accessoire', 'tasche'],
    priceRange: 'premium',
    preferBrands: ['Calvin Klein', 'VILA', 'Esprit', 'Clarks', 'BOSS'],
  },
  'Klassisch-zeitlos': {
    required: ['kleid', 'schuhe'],
    optional: ['jacke', 'schmuck', 'tasche'],
    priceRange: 'mid',
    preferBrands: ['VILA', 's.Oliver', 'ONLY', 'Gabor', 'SWAROVSKI'],
  },
  'Romantisch-verspielt / Boho': {
    required: ['kleid', 'schuhe'],
    optional: ['accessoire', 'tasche'],
    priceRange: 'budget',
    preferBrands: ['Desigual', 'ONLY', 'Geox', 'Liebeskind Berlin'],
  },
};

// Standardstil für unbekannte Beschreibungen
const DEFAULT_STYLE = {
  required: ['oberteil', 'hose', 'schuhe'],
  optional: ['jacke', 'accessoire'],
  priceRange: 'mid',
  preferBrands: [],
};

/**
 * Zufälliges Element aus einem Array
 */
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Shuffle-Algorithmus (Fisher-Yates)
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Automatische Outfit-Zuordnung für alle Avatare
 *
 * @param {string} date - Datum im Format YYYY-MM-DD (default: heute)
 * @param {object} options - { clearExisting: true, respectStyles: true }
 */
function autoAssignOutfits(date, options = {}) {
  const db = getDb();
  const targetDate = date || new Date().toISOString().split('T')[0];
  const { clearExisting = true, respectStyles = true } = options;

  const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1 ORDER BY position_order').all();
  const allArticles = db.prepare(`
    SELECT a.*, p.brand_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `).all();

  if (avatars.length === 0) {
    return { success: false, error: 'Keine aktiven Avatare vorhanden' };
  }
  if (allArticles.length === 0) {
    return { success: false, error: 'Keine Artikel vorhanden. Bitte zuerst Artikel anlegen.' };
  }

  // Bestehende Outfits löschen wenn gewünscht
  if (clearExisting) {
    db.prepare('DELETE FROM avatar_outfits WHERE outfit_date = ?').run(targetDate);
  }

  const insertOutfit = db.prepare(`
    INSERT OR IGNORE INTO avatar_outfits (id, avatar_id, article_id, outfit_date, layer_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  const results = [];
  const usedArticleIds = new Set(); // Artikel nicht doppelt vergeben

  for (const avatar of avatars) {
    // Stil-Präferenzen ermitteln
    const style = respectStyles
      ? (STYLE_PREFERENCES[avatar.description] || DEFAULT_STYLE)
      : DEFAULT_STYLE;

    const allCategories = [...style.required, ...style.optional];
    const assignedArticles = [];
    let layer = 1;

    for (const category of allCategories) {
      // Verfügbare Artikel für diese Kategorie finden
      let candidates = allArticles.filter(a =>
        a.category === category && !usedArticleIds.has(a.id)
      );

      if (candidates.length === 0) {
        // Wenn keine ungenutzten, auch bereits genutzte erlauben
        candidates = allArticles.filter(a => a.category === category);
      }

      if (candidates.length === 0) continue;

      // Bevorzugte Brands zuerst
      let article;
      if (style.preferBrands.length > 0) {
        const preferred = candidates.filter(a => style.preferBrands.includes(a.brand_name));
        article = preferred.length > 0 ? randomPick(preferred) : randomPick(shuffle(candidates));
      } else {
        article = randomPick(shuffle(candidates));
      }

      try {
        insertOutfit.run(uuidv4(), avatar.id, article.id, targetDate, layer);
        assignedArticles.push({
          name: article.name,
          category: article.category,
          brand: article.brand_name,
          price: article.price,
        });
        usedArticleIds.add(article.id);
        layer++;
      } catch (e) {
        // UNIQUE constraint - schon zugeordnet
      }
    }

    const totalPrice = assignedArticles.reduce((sum, a) => sum + a.price, 0);
    results.push({
      avatar: avatar.name,
      style: avatar.description || 'Standard',
      articles: assignedArticles,
      totalPrice: Math.round(totalPrice * 100) / 100,
    });
  }

  return {
    success: true,
    date: targetDate,
    results,
    summary: {
      avatars: results.length,
      totalArticles: results.reduce((sum, r) => sum + r.articles.length, 0),
      totalValue: Math.round(results.reduce((sum, r) => sum + r.totalPrice, 0) * 100) / 100,
    },
  };
}

/**
 * Outfit für ein bestimmtes Datum löschen und neu zuweisen
 */
function rotateOutfits(date) {
  return autoAssignOutfits(date, { clearExisting: true, respectStyles: true });
}

/**
 * Outfit-Vorschau: Zeigt was zugeordnet werden WÜRDE, ohne zu speichern
 */
function previewOutfits(date) {
  // Gleiche Logik, aber ohne DB-Schreibzugriff
  const db = getDb();
  const targetDate = date || new Date().toISOString().split('T')[0];

  const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1 ORDER BY position_order').all();
  const allArticles = db.prepare(`
    SELECT a.*, p.brand_name
    FROM articles a JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `).all();

  const existing = db.prepare(`
    SELECT ao.avatar_id, COUNT(*) as count
    FROM avatar_outfits ao
    WHERE ao.outfit_date = ?
    GROUP BY ao.avatar_id
  `).all(targetDate);

  return {
    date: targetDate,
    avatarsTotal: avatars.length,
    articlesTotal: allArticles.length,
    avatarsWithOutfit: existing.length,
    avatarsWithoutOutfit: avatars.length - existing.length,
  };
}

module.exports = {
  autoAssignOutfits,
  rotateOutfits,
  previewOutfits,
  STYLE_PREFERENCES,
};
