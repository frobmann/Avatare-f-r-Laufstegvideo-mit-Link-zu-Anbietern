/**
 * Datenbank-Tabellen erstellen
 *
 * Ausführen: npm run init-db
 * Wird auch automatisch beim Serverstart aufgerufen.
 */

const { initDatabase, getDb, DB_PATH } = require('./db');

async function initTables() {
  await initDatabase();
  const db = getDb();

  db.pragma('foreign_keys = ON');

  db.exec(`
    -- Avatare: Jeder Avatar hat einen Namen, ein Bild und Metadaten
    CREATE TABLE IF NOT EXISTS avatars (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      silhouette_url TEXT DEFAULT '',
      walk_animation TEXT DEFAULT 'default',
      position_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Anbieter/Brands
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      logo_url TEXT DEFAULT '',
      website_url TEXT NOT NULL,
      affiliate_base_url TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Artikel/Kleidungsstücke
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN (
        'kopfbedeckung', 'oberteil', 'jacke', 'hose', 'rock',
        'kleid', 'schuhe', 'accessoire', 'tasche', 'schmuck'
      )),
      price REAL NOT NULL,
      currency TEXT DEFAULT 'CHF',
      product_url TEXT NOT NULL,
      image_url TEXT DEFAULT '',
      color TEXT DEFAULT '',
      size TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );

    -- Avatar-Outfit: Tägliche Zuordnung von Artikeln zu Avataren
    CREATE TABLE IF NOT EXISTS avatar_outfits (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL,
      article_id TEXT NOT NULL,
      outfit_date TEXT NOT NULL DEFAULT (date('now')),
      layer_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE,
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
      UNIQUE(avatar_id, article_id, outfit_date)
    );

    -- Catwalk-Konfiguration
    CREATE TABLE IF NOT EXISTS catwalk_config (
      id TEXT PRIMARY KEY DEFAULT 'main',
      title TEXT DEFAULT 'Fashion Catwalk',
      background_image TEXT DEFAULT '',
      background_color TEXT DEFAULT '#1a1a2e',
      runway_color TEXT DEFAULT '#333355',
      music_url TEXT DEFAULT '',
      speed REAL DEFAULT 1.0,
      loop_enabled INTEGER DEFAULT 1,
      show_brand_on_hover INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Klick-Statistiken
    CREATE TABLE IF NOT EXISTS click_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      avatar_id TEXT NOT NULL,
      article_id TEXT,
      action TEXT NOT NULL CHECK(action IN ('hover', 'click', 'redirect')),
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (avatar_id) REFERENCES avatars(id),
      FOREIGN KEY (article_id) REFERENCES articles(id)
    );

    -- KI-Generierungen (Try-On, Animationen)
    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      avatar_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('tryon', 'walk_animation', 'img2img')),
      cache_key TEXT DEFAULT '',
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      output_path TEXT DEFAULT '',
      cost REAL DEFAULT 0,
      error_message TEXT DEFAULT '',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
    );

    -- Default Catwalk Config einfügen
    INSERT OR IGNORE INTO catwalk_config (id) VALUES ('main');

    -- Indizes für Performance
    CREATE INDEX IF NOT EXISTS idx_outfits_avatar_date ON avatar_outfits(avatar_id, outfit_date);
    CREATE INDEX IF NOT EXISTS idx_outfits_date ON avatar_outfits(outfit_date);
    CREATE INDEX IF NOT EXISTS idx_articles_provider ON articles(provider_id);
    CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
    CREATE INDEX IF NOT EXISTS idx_click_stats_avatar ON click_stats(avatar_id);
    CREATE INDEX IF NOT EXISTS idx_click_stats_timestamp ON click_stats(timestamp);
    CREATE INDEX IF NOT EXISTS idx_generations_avatar ON generations(avatar_id);
    CREATE INDEX IF NOT EXISTS idx_generations_cache ON generations(cache_key);
    CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
  `);

  console.log('✅ Datenbank erfolgreich initialisiert:', DB_PATH);
}

// Direkt ausführbar
if (require.main === module) {
  initTables()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Datenbankfehler:', err);
      process.exit(1);
    });
}

module.exports = { initTables };
