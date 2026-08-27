/**
 * ASIN-Checker: Automatische Verfügbarkeitsprüfung der Amazon.de Produkt-URLs
 *
 * Prüft alle aktiven Artikel auf gültige Amazon.de ASINs.
 * Läuft 4x täglich automatisch (alle 6 Stunden).
 */

const { getDb } = require('../db');
const https = require('https');

// Prüft ob eine Amazon.de ASIN erreichbar ist (kein 404)
function checkAsin(asin) {
  return new Promise((resolve) => {
    const url = `https://www.amazon.de/dp/${asin}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'text/html',
      },
      timeout: 10000,
    }, (res) => {
      // Amazon gibt 200 für existierende und 404 für nicht-existierende Produkte
      // Manchmal auch 301/302 Redirect
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      // Body verwerfen
      res.resume();
      resolve({ asin, status: res.statusCode, ok });
    });

    req.on('error', (err) => {
      resolve({ asin, status: 0, ok: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ asin, status: 0, ok: false, error: 'Timeout' });
    });
  });
}

// Extrahiert ASIN aus einer Amazon-URL
function extractAsin(url) {
  if (!url) return null;
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1] : null;
}

// Wartefunktion (Amazon Throttling vermeiden)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Prüft alle aktiven Artikel und gibt einen Report zurück
 */
async function checkAllAsins() {
  const db = getDb();
  const articles = db.prepare(`
    SELECT a.id, a.name, a.product_url, a.is_active, p.brand_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `).all();

  const results = {
    checked: 0,
    ok: 0,
    broken: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  console.log(`🔍 ASIN-Check: ${articles.length} Artikel werden geprüft...`);

  for (const article of articles) {
    const asin = extractAsin(article.product_url);
    if (!asin) {
      results.errors.push({
        name: article.name,
        brand: article.brand_name,
        url: article.product_url,
        reason: 'Keine gültige ASIN in URL',
      });
      continue;
    }

    const result = await checkAsin(asin);
    results.checked++;

    if (result.ok) {
      results.ok++;
      console.log(`  ✅ ${article.brand_name}: ${article.name} (${asin})`);
    } else {
      results.broken.push({
        id: article.id,
        name: article.name,
        brand: article.brand_name,
        asin,
        status: result.status,
        error: result.error,
      });
      console.log(`  ❌ ${article.brand_name}: ${article.name} (${asin}) → Status ${result.status}`);
    }

    // 1.5 Sekunden Pause zwischen Requests (Amazon Throttling)
    await sleep(1500);
  }

  console.log(`\n📊 ASIN-Check Ergebnis:`);
  console.log(`   Geprüft: ${results.checked}`);
  console.log(`   OK: ${results.ok}`);
  console.log(`   Fehler: ${results.broken.length}`);
  if (results.errors.length > 0) {
    console.log(`   Ungültige URLs: ${results.errors.length}`);
  }

  // Ergebnis in DB speichern
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS asin_check_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        checked_at TEXT NOT NULL,
        total_checked INTEGER,
        total_ok INTEGER,
        total_broken INTEGER,
        broken_details TEXT
      )
    `).run();

    db.prepare(`
      INSERT INTO asin_check_log (checked_at, total_checked, total_ok, total_broken, broken_details)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      results.timestamp,
      results.checked,
      results.ok,
      results.broken.length,
      JSON.stringify(results.broken)
    );
  } catch (e) {
    console.log('  ⚠️ Konnte Log nicht speichern:', e.message);
  }

  return results;
}

/**
 * Letztes Prüfergebnis abrufen
 */
function getLastCheckResult() {
  try {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM asin_check_log ORDER BY checked_at DESC LIMIT 1
    `).get();
  } catch {
    return null;
  }
}

/**
 * Alle Prüfergebnisse abrufen
 */
function getCheckHistory(limit = 10) {
  try {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM asin_check_log ORDER BY checked_at DESC LIMIT ?
    `).all(limit);
  } catch {
    return [];
  }
}

module.exports = {
  checkAllAsins,
  checkAsin,
  extractAsin,
  getLastCheckResult,
  getCheckHistory,
};
