/**
 * ASIN-Checker: Automatische Verfügbarkeitsprüfung der Amazon.de Produkt-URLs
 *
 * Prüft alle aktiven Artikel auf gültige Amazon.de ASINs.
 * Läuft alle 60 Minuten automatisch.
 *
 * WICHTIG: Amazon blockiert oft automatisierte Zugriffe mit 403/503/CAPTCHA.
 * Nur echte 404-Antworten bedeuten "ASIN ungültig".
 * Andere Fehler (403, 503, Timeout) = Amazon hat den Check blockiert.
 */

const { getDb } = require('../db');
const https = require('https');

// Verschiedene realistische User-Agents (Amazon erkennt wiederholte gleiche)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
];

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Prüft ob eine Amazon.de ASIN erreichbar ist
 * Ergebnis-Status:
 *   - 'ok'      → ASIN existiert (HTTP 200-399)
 *   - 'broken'  → ASIN existiert NICHT (HTTP 404)
 *   - 'blocked' → Amazon hat den Check blockiert (403/503/CAPTCHA/Timeout)
 */
function checkAsin(asin) {
  return new Promise((resolve) => {
    const url = `https://www.amazon.de/dp/${asin}`;
    const req = https.get(url, {
      headers: {
        'User-Agent': randomUserAgent(),
        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
      timeout: 15000,
    }, (res) => {
      // Body lesen um zu prüfen ob es eine CAPTCHA/Dog-Seite ist
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk.slice(0, 2000); }); // Nur erste 2KB
      res.on('end', () => {
        const status = res.statusCode;

        // Echte 404 = ASIN existiert nicht
        if (status === 404) {
          resolve({ asin, status, result: 'broken' });
          return;
        }

        // 200-399 = OK (aber CAPTCHA-Seite prüfen)
        if (status >= 200 && status < 400) {
          // Amazon zeigt manchmal eine CAPTCHA/Robot-Seite mit Status 200
          const isCaptcha = body.includes('captcha') || body.includes('robot') ||
                            body.includes('api-services-support@amazon.com') ||
                            body.includes('automated access');
          if (isCaptcha) {
            resolve({ asin, status, result: 'blocked', reason: 'CAPTCHA/Bot-Erkennung' });
          } else {
            resolve({ asin, status, result: 'ok' });
          }
          return;
        }

        // 403, 429, 503 = Amazon blockiert automatisierte Zugriffe
        if (status === 403 || status === 429 || status === 503) {
          resolve({ asin, status, result: 'blocked', reason: `HTTP ${status} – Amazon blockiert automatisierte Zugriffe` });
          return;
        }

        // Alle anderen Status-Codes = unklar, als "blocked" behandeln
        resolve({ asin, status, result: 'blocked', reason: `Unerwarteter HTTP ${status}` });
      });
    });

    req.on('error', (err) => {
      resolve({ asin, status: 0, result: 'blocked', reason: `Netzwerkfehler: ${err.message}` });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ asin, status: 0, result: 'blocked', reason: 'Timeout (15s)' });
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
 * Sucht auf Amazon.de nach einem Ersatz-ASIN für ein Produkt
 * Gibt eine neue ASIN zurück oder null wenn nichts gefunden
 */
function findReplacementAsin(brandName, productName, category) {
  return new Promise((resolve) => {
    // Suchbegriffe: Marke + Kategorie (Produktname oft zu spezifisch)
    const categoryMap = {
      'oberteil': 'Damen Oberteil',
      'hose': 'Damen Hose',
      'jacke': 'Damen Jacke',
      'schuhe': 'Damen Schuhe',
      'kleid': 'Damen Kleid',
      'rock': 'Damen Rock',
      'tasche': 'Damen Tasche',
      'schmuck': 'Damen Schmuck',
      'accessoire': 'Damen Accessoire',
    };
    const catSearch = categoryMap[category] || 'Damen';
    const searchQuery = encodeURIComponent(`${brandName} ${catSearch}`);
    const searchUrl = `https://www.amazon.de/s?k=${searchQuery}&i=fashion`;

    const req = https.get(searchUrl, {
      headers: {
        'User-Agent': randomUserAgent(),
        'Accept-Language': 'de-DE,de;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
        'Connection': 'keep-alive',
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(null);
          return;
        }

        // ASINs aus Suchergebnissen extrahieren (data-asin Attribut oder /dp/ Links)
        const asinMatches = body.match(/data-asin="([A-Z0-9]{10})"/g) || [];
        const dpMatches = body.match(/\/dp\/([A-Z0-9]{10})/g) || [];

        const foundAsins = new Set();
        for (const m of asinMatches) {
          const a = m.match(/([A-Z0-9]{10})/);
          if (a) foundAsins.add(a[1]);
        }
        for (const m of dpMatches) {
          const a = m.match(/([A-Z0-9]{10})/);
          if (a) foundAsins.add(a[1]);
        }

        // Erste gültige ASIN zurückgeben (nicht leer)
        const candidates = [...foundAsins].filter(a => a !== '0000000000');
        resolve(candidates.length > 0 ? candidates[0] : null);
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Prüft alle aktiven Artikel und gibt einen Report zurück
 * Unterscheidet zwischen echten 404s (ASIN kaputt) und Amazon-Blocking (403/503/CAPTCHA)
 *
 * Wenn autoReplace=true: Kaputte ASINs werden automatisch durch neue ersetzt und verifiziert
 */
async function checkAllAsins(options = {}) {
  const { autoReplace = true } = options;
  const db = getDb();
  const articles = db.prepare(`
    SELECT a.id, a.name, a.product_url, a.category, a.is_active, p.brand_name
    FROM articles a
    JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `).all();

  const results = {
    checked: 0,
    ok: 0,
    broken: [],          // Echte 404 = ASIN existiert nicht
    blocked: [],         // Amazon hat den Check blockiert (403/503/CAPTCHA)
    replaced: [],        // Automatisch ersetzte ASINs
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

    if (result.result === 'ok') {
      results.ok++;
      console.log(`  ✅ ${article.brand_name}: ${article.name} (${asin})`);
    } else if (result.result === 'broken') {
      // Echte 404 — ASIN existiert nicht mehr
      console.log(`  ❌ ${article.brand_name}: ${article.name} (${asin}) → ASIN UNGÜLTIG (404)`);

      if (autoReplace) {
        // Automatisch Ersatz suchen
        console.log(`     🔄 Suche Ersatz-ASIN für ${article.brand_name} ${article.category}...`);
        await sleep(3000); // Extra Pause vor Suche

        const newAsin = await findReplacementAsin(article.brand_name, article.name, article.category);
        if (newAsin && newAsin !== asin) {
          // Neue ASIN verifizieren
          console.log(`     🔍 Verifiziere neue ASIN ${newAsin}...`);
          await sleep(2000);
          const verifyResult = await checkAsin(newAsin);

          if (verifyResult.result === 'ok') {
            // Neue ASIN ist gültig — in DB ersetzen!
            const newUrl = `https://www.amazon.de/dp/${newAsin}`;
            db.prepare('UPDATE articles SET product_url = ? WHERE id = ?').run(newUrl, article.id);
            console.log(`     ✅ ERSETZT: ${asin} → ${newAsin} (verifiziert!)`);
            results.replaced.push({
              id: article.id,
              name: article.name,
              brand: article.brand_name,
              old_asin: asin,
              new_asin: newAsin,
              new_url: newUrl,
            });
          } else {
            // Neue ASIN auch nicht erreichbar
            console.log(`     ⚠️ Ersatz ${newAsin} konnte nicht verifiziert werden (${verifyResult.reason || verifyResult.result})`);
            results.broken.push({
              id: article.id, name: article.name, brand: article.brand_name,
              asin, status: 404, reason: 'ASIN ungültig, Ersatz nicht verifizierbar',
            });
          }
        } else {
          console.log(`     ⚠️ Kein Ersatz gefunden für ${article.brand_name} ${article.category}`);
          results.broken.push({
            id: article.id, name: article.name, brand: article.brand_name,
            asin, status: 404, reason: 'ASIN ungültig, kein Ersatz gefunden',
          });
        }
      } else {
        results.broken.push({
          id: article.id, name: article.name, brand: article.brand_name,
          asin, status: 404, reason: 'ASIN ungültig (404)',
        });
      }
    } else {
      // blocked — Amazon hat den Check blockiert, ASIN ist wahrscheinlich OK
      results.blocked.push({
        id: article.id, name: article.name, brand: article.brand_name,
        asin, status: result.status, reason: result.reason,
      });
      console.log(`  🚫 ${article.brand_name}: ${article.name} (${asin}) → ${result.reason}`);
    }

    // 2-4 Sekunden zufällige Pause (menschlicher wirken)
    const delay = 2000 + Math.floor(Math.random() * 2000);
    await sleep(delay);
  }

  console.log(`\n📊 ASIN-Check Ergebnis:`);
  console.log(`   Geprüft:  ${results.checked}`);
  console.log(`   ✅ OK:     ${results.ok}`);
  console.log(`   ❌ Kaputt: ${results.broken.length}`);
  console.log(`   🚫 Blockiert (Amazon Bot-Schutz): ${results.blocked.length}`);
  if (results.replaced.length > 0) {
    console.log(`   🔄 Automatisch ersetzt: ${results.replaced.length}`);
    for (const r of results.replaced) {
      console.log(`      ${r.brand}: ${r.old_asin} → ${r.new_asin}`);
    }
  }
  if (results.errors.length > 0) {
    console.log(`   ⚠️ Ungültige URLs: ${results.errors.length}`);
  }
  if (results.blocked.length > 0) {
    console.log(`\n   ℹ️ "Blockiert" bedeutet NICHT kaputt! Amazon blockiert automatisierte`);
    console.log(`      Zugriffe manchmal. Diese ASINs sind höchstwahrscheinlich gültig.`);
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
        total_blocked INTEGER DEFAULT 0,
        total_replaced INTEGER DEFAULT 0,
        broken_details TEXT,
        replaced_details TEXT DEFAULT '[]'
      )
    `).run();

    db.prepare(`
      INSERT INTO asin_check_log (checked_at, total_checked, total_ok, total_broken, total_blocked, total_replaced, broken_details, replaced_details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      results.timestamp,
      results.checked,
      results.ok,
      results.broken.length,
      results.blocked.length,
      results.replaced.length,
      JSON.stringify(results.broken),
      JSON.stringify(results.replaced)
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
