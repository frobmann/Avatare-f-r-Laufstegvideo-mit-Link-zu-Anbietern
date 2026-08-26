/**
 * Verfügbarkeits-Check: Prüft ob Artikel bei Anbietern noch verfügbar sind
 *
 * Intelligenter Check mit Bot-Schutz-Erkennung:
 * - HTTP 200-399: ✅ Verfügbar
 * - HTTP 403/429: 🛡️ Bot-Schutz (Cloudflare etc.) – Produkt wahrscheinlich verfügbar
 * - HTTP 404/410: ❌ Produkt entfernt
 * - Timeout bei bekannten Shops: 🛡️ Wahrscheinlich Bot-Schutz
 * - Redirect zur Startseite: ❌ Produkt wahrscheinlich entfernt
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
    check_type TEXT DEFAULT 'ok',
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

// Bekannte Shops die Bot-Schutz nutzen (403/Timeout = normal)
const BOT_PROTECTED_DOMAINS = [
  'hm.com', 'www2.hm.com',
  'zara.com', 'www.zara.com',
  'mango.com', 'shop.mango.com',
  'cos.com', 'www.cos.com',
  'massimodutti.com', 'www.massimodutti.com',
  'stories.com', 'www.stories.com',
  'aboutyou.de', 'www.aboutyou.de',
  'zalando.de', 'www.zalando.de',
  'aboutyou.com', 'www.aboutyou.com',
  'zalando.com', 'www.zalando.com',
];

/**
 * Prüft ob eine Domain bekanntermaßen Bot-Schutz nutzt
 */
function isBotProtectedDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BOT_PROTECTED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * URL prüfen – gibt Statuscode und Bewertung zurück
 */
function checkUrl(url, timeout = 15000) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      const isProtected = isBotProtectedDomain(url);

      const req = client.get(url, {
        timeout,
        headers: {
          // Realistischer User-Agent (weniger Bot-Blockaden)
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
      }, (res) => {
        // Body verwerfen
        res.resume();

        // Redirect folgen (301, 302, 307, 308)
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          const location = res.headers.location;
          try {
            const redirectUrl = new URL(location, url);
            const isHomepage = redirectUrl.pathname === '/' || redirectUrl.pathname === '';
            if (isHomepage) {
              resolve({
                statusCode: res.statusCode,
                available: false,
                checkType: 'removed',
                error: 'Redirect zur Startseite – Produkt wahrscheinlich entfernt',
              });
              return;
            }
          } catch (e) { /* ignore parse errors */ }
          // Redirect zu einer anderen Produktseite = OK
          resolve({ statusCode: res.statusCode, available: true, checkType: 'redirect_ok', error: '' });

        } else if (res.statusCode >= 200 && res.statusCode < 400) {
          // ✅ Direkt verfügbar
          resolve({ statusCode: res.statusCode, available: true, checkType: 'ok', error: '' });

        } else if (res.statusCode === 403 || res.statusCode === 429) {
          // 🛡️ Bot-Schutz oder Rate-Limiting – NICHT als "nicht verfügbar" werten
          resolve({
            statusCode: res.statusCode,
            available: true,
            checkType: 'bot_protected',
            error: `HTTP ${res.statusCode} – Bot-Schutz (Produkt wahrscheinlich verfügbar)`,
          });

        } else if (res.statusCode === 404 || res.statusCode === 410) {
          // ❌ Wirklich nicht gefunden / entfernt
          resolve({
            statusCode: res.statusCode,
            available: false,
            checkType: 'not_found',
            error: `HTTP ${res.statusCode} – Produkt nicht gefunden`,
          });

        } else if (res.statusCode >= 500) {
          // Server-Fehler beim Anbieter – vorübergehend, nicht deaktivieren
          resolve({
            statusCode: res.statusCode,
            available: true,
            checkType: 'server_error',
            error: `HTTP ${res.statusCode} – Server-Fehler beim Anbieter (vorübergehend)`,
          });

        } else {
          // Sonstiger Fehler
          resolve({
            statusCode: res.statusCode,
            available: false,
            checkType: 'error',
            error: `HTTP ${res.statusCode}`,
          });
        }
      });

      req.on('timeout', () => {
        req.destroy();
        if (isProtected) {
          // Timeout bei bekanntem Shop = Bot-Schutz
          resolve({
            statusCode: 0,
            available: true,
            checkType: 'bot_protected',
            error: 'Timeout – Bot-Schutz (bekannter Shop, Produkt wahrscheinlich verfügbar)',
          });
        } else {
          resolve({
            statusCode: 0,
            available: false,
            checkType: 'timeout',
            error: 'Timeout nach ' + (timeout / 1000) + 's',
          });
        }
      });

      req.on('error', (err) => {
        if (isProtected && (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED')) {
          resolve({
            statusCode: 0,
            available: true,
            checkType: 'bot_protected',
            error: `${err.code} – Bot-Schutz (bekannter Shop)`,
          });
        } else {
          resolve({ statusCode: 0, available: false, checkType: 'error', error: err.message });
        }
      });
    } catch (err) {
      resolve({ statusCode: 0, available: false, checkType: 'invalid_url', error: 'Ungültige URL: ' + err.message });
    }
  });
}

/**
 * Alle aktiven Artikel prüfen
 *
 * @param {object} options
 * @param {boolean} options.deactivateUnavailable - Nur echte 404/410 deaktivieren (nie Bot-Schutz)
 * @param {number} options.delayMs - Wartezeit zwischen Requests (Rate-Limiting)
 */
async function checkAllArticles(options = {}) {
  const { deactivateUnavailable = false, delayMs = 1000 } = options;
  const db = getDb();

  // Tabellen anlegen falls nötig
  db.exec(CHECK_TABLE);
  db.exec(LAST_CHECK_TABLE);

  // check_type Spalte hinzufügen falls nicht vorhanden
  try {
    db.exec(`ALTER TABLE availability_checks ADD COLUMN check_type TEXT DEFAULT 'ok'`);
  } catch (e) { /* Spalte existiert bereits */ }

  const articles = db.prepare(`
    SELECT a.id, a.name, a.product_url, a.is_active, p.brand_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
    ORDER BY p.brand_name, a.name
  `).all();

  console.log(`\n🔍 Verfügbarkeits-Check: ${articles.length} Artikel werden geprüft...\n`);

  const insertCheck = db.prepare(`
    INSERT INTO availability_checks (article_id, article_name, brand_name, product_url, status_code, is_available, error_message, check_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const results = {
    total: articles.length,
    available: 0,
    botProtected: 0,
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
      result.available ? 1 : 0, result.error,
      result.checkType
    );

    if (result.checkType === 'bot_protected' || result.checkType === 'server_error') {
      results.botProtected++;
      results.available++;
      console.log(`  🛡️ ${article.brand_name}: "${article.name}" – ${result.error}`);
    } else if (result.available) {
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
        checkType: result.checkType,
      });
      console.log(`  ❌ ${article.brand_name}: "${article.name}" – ${result.error}`);

      // Nur echte 404/410 deaktivieren, NIE Bot-Schutz
      if (deactivateUnavailable && (result.checkType === 'not_found' || result.checkType === 'removed')) {
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
  if (results.botProtected > 0) {
    console.log(`   🛡️ ${results.botProtected} durch Bot-Schutz blockiert (wahrscheinlich verfügbar)`);
  }
  if (results.unavailable > 0) {
    console.log(`   ❌ ${results.unavailable} wirklich nicht verfügbar`);
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

    // check_type Spalte hinzufügen falls nicht vorhanden
    try {
      db.exec(`ALTER TABLE availability_checks ADD COLUMN check_type TEXT DEFAULT 'ok'`);
    } catch (e) { /* Spalte existiert bereits */ }

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
    const botProtected = checks.filter(c => c.check_type === 'bot_protected');
    const unavailable = checks.filter(c => !c.is_available);

    return {
      hasReport: true,
      checkedAt: lastCheck.value,
      total: checks.length,
      available: available.length,
      botProtected: botProtected.length,
      unavailable: unavailable.length,
      details: checks,
      errors: unavailable.map(c => ({
        name: c.article_name,
        brand: c.brand_name,
        url: c.product_url,
        statusCode: c.status_code,
        error: c.error_message,
        checkType: c.check_type,
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
