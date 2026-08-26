/**
 * Verfügbarkeits-Check: Prüft ob Artikel bei Anbietern noch verfügbar sind
 *
 * Überprüft die product_url jedes aktiven Artikels per HTTP-Request.
 * Artikel die nicht erreichbar sind (404, Timeout, Fehler) werden
 * markiert und optional deaktiviert.
 */

const { getDb } = require('../db');
const https = require('https');
const http = require('http');

// Letzter Check-Zeitpunkt (wird in DB gespeichert)
const CHECK_TABLE = `
  CREATE TABLE IF NOT EXISTS availability_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id TEXT NOT NULL,
    article_name TEXT,
    brand_name TEXT,
    product_url TEXT,
    status_code INTEGER,
    is_available INTEGER DEFAULT 1,
    error_message TEXT DEFAULT '',
    checked_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (article_id) REFERENCES articles(id)
  )
`;

const LAST_CHECK_TABLE = `
  CREATE TABLE IF NOT EXISTS system_state (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`;

/**
 * URL prüfen – gibt Statuscode zurück
 */
function checkUrl(url, timeout = 10000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const req = client.get(url, {
        timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CatwalkBot/1.0; availability-check)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      }, (res) => {
        // Redirect folgen (301, 302, 307, 308)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          // Prüfe ob Redirect auf Homepage geht (= Produkt gelöscht)
          const location = res.headers.location;
          try {
            const redirectUrl = new URL(location, url);
            const isHomepage = redirectUrl.pathname === '/' || redirectUrl.pathname === '';
            if (isHomepage) {
              resolve({ statusCode: res.statusCode, available: false, error: 'Redirect zur Startseite – Produkt wahrscheinlich entfernt' });
              return;
            }
          } catch (e) { /* ignore parse errors */ }
          resolve({ statusCode: res.statusCode, available: true, error: '' });
        } else if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve({ statusCode: res.statusCode, available: true, error: '' });
        } else {
          resolve({ statusCode: res.statusCode, available: false, error: `HTTP ${res.statusCode}` });
        }
        // Body verwerfen
        res.resume();
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ statusCode: 0, available: false, error: 'Timeout nach ' + (timeout / 1000) + 's' });
      });

      req.on('error', (err) => {
        resolve({ statusCode: 0, available: false, error: err.message });
      });
    } catch (err) {
      resolve({ statusCode: 0, available: false, error: 'Ungültige URL: ' + err.message });
    }
  });
}

/**
 * Alle aktiven Artikel prüfen
 *
 * @param {object} options
 * @param {boolean} options.deactivateUnavailable - Nicht verfügbare Artikel deaktivieren?
 * @param {number} options.delayMs - Wartezeit zwischen Requests (Rate-Limiting)
 */
async function checkAllArticles(options = {}) {
  const { deactivateUnavailable = false, delayMs = 1000 } = options;
  const db = getDb();

  // Tabellen anlegen falls nötig
  db.exec(CHECK_TABLE);
  db.exec(LAST_CHECK_TABLE);

  const articles = db.prepare(`
    SELECT a.id, a.name, a.product_url, a.is_active, p.brand_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
    ORDER BY p.brand_name, a.name
  `).all();

  console.log(`\n🔍 Verfügbarkeits-Check: ${articles.length} Artikel werden geprüft...\n`);

  const insertCheck = db.prepare(`
    INSERT INTO availability_checks (article_id, article_name, brand_name, product_url, status_code, is_available, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const results = {
    total: articles.length,
    available: 0,
    unavailable: 0,
    errors: [],
    deactivated: 0,
  };

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const result = await checkUrl(article.product_url);

    // Ergebnis loggen
    insertCheck.run(
      article.id, article.name, article.brand_name,
      article.product_url, result.statusCode,
      result.available ? 1 : 0, result.error
    );

    if (result.available) {
      results.available++;
      console.log(`  ✅ ${article.brand_name}: "${article.name}" (HTTP ${result.statusCode})`);
    } else {
      results.unavailable++;
      results.errors.push({
        name: article.name,
        brand: article.brand_name,
        url: article.product_url,
        statusCode: result.statusCode,
        error: result.error,
      });
      console.log(`  ❌ ${article.brand_name}: "${article.name}" – ${result.error}`);

      if (deactivateUnavailable) {
        db.prepare('UPDATE articles SET is_active = 0 WHERE id = ?').run(article.id);
        results.deactivated++;
        console.log(`     🚫 Artikel deaktiviert`);
      }
    }

    // Rate-Limiting: Warten zwischen Requests
    if (i < articles.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Letzten Check-Zeitpunkt speichern
  db.prepare(`
    INSERT OR REPLACE INTO system_state (key, value)
    VALUES ('last_availability_check', datetime('now'))
  `).run();

  console.log(`\n📊 Ergebnis: ${results.available}/${results.total} verfügbar`);
  if (results.unavailable > 0) {
    console.log(`   ⚠️ ${results.unavailable} nicht erreichbar`);
  }
  if (results.deactivated > 0) {
    console.log(`   🚫 ${results.deactivated} Artikel deaktiviert`);
  }

  return {
    success: true,
    checkedAt: new Date().toISOString(),
    ...results,
  };
}

/**
 * Prüft ob heute schon ein Check gemacht wurde
 */
function wasCheckedToday() {
  const db = getDb();
  try {
    db.exec(LAST_CHECK_TABLE);
    const row = db.prepare(
      "SELECT value FROM system_state WHERE key = 'last_availability_check'"
    ).get();
    if (!row) return false;

    const lastCheck = new Date(row.value + 'Z');
    const today = new Date();
    return lastCheck.toISOString().split('T')[0] === today.toISOString().split('T')[0];
  } catch (e) {
    return false;
  }
}

/**
 * Letzten Check-Bericht abrufen
 */
function getLastCheckReport() {
  const db = getDb();
  try {
    db.exec(CHECK_TABLE);
    db.exec(LAST_CHECK_TABLE);

    const lastCheck = db.prepare(
      "SELECT value FROM system_state WHERE key = 'last_availability_check'"
    ).get();

    if (!lastCheck) {
      return { hasReport: false, message: 'Noch kein Check durchgeführt' };
    }

    const checks = db.prepare(`
      SELECT * FROM availability_checks
      WHERE date(checked_at) = date(?)
      ORDER BY brand_name, article_name
    `).all(lastCheck.value);

    const available = checks.filter(c => c.is_available);
    const unavailable = checks.filter(c => !c.is_available);

    return {
      hasReport: true,
      checkedAt: lastCheck.value,
      total: checks.length,
      available: available.length,
      unavailable: unavailable.length,
      details: checks,
      errors: unavailable.map(c => ({
        name: c.article_name,
        brand: c.brand_name,
        url: c.product_url,
        statusCode: c.status_code,
        error: c.error_message,
      })),
    };
  } catch (e) {
    return { hasReport: false, message: e.message };
  }
}

module.exports = {
  checkAllArticles,
  wasCheckedToday,
  getLastCheckReport,
  checkUrl,
};
