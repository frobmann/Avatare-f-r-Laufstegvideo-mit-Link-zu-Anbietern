/**
 * Seed-Daten: EU Mode-Anbieter mit kostenlosem Versand und EUR-Preisen
 *
 * Ausführen: node server/seed-providers.js
 *
 * Fügt Anbieter und Artikel hinzu OHNE bestehende Daten zu löschen.
 * Doppelte Einträge werden übersprungen (INSERT OR IGNORE).
 */

const { initDatabase, getDb } = require('./db');
const { initTables } = require('./init-db');
const { v4: uuidv4 } = require('uuid');

async function seedProviders() {
  await initDatabase();
  await initTables();
  const db = getDb();

  // ═══════════════════════════════════════════════════
  // BEREINIGUNG — Nicht-EU-Anbieter und Duplikate entfernen
  // ═══════════════════════════════════════════════════

  const nonEuBrands = ['ASOS', 'PKZ', 'Globus', 'Manor', 'Chicorée'];
  for (const brand of nonEuBrands) {
    const provider = db.prepare('SELECT id FROM providers WHERE brand_name = ?').get(brand);
    if (provider) {
      // Artikel dieses Anbieters deaktivieren
      db.prepare('UPDATE articles SET is_active = 0 WHERE provider_id = ?').run(provider.id);
      // Anbieter deaktivieren
      db.prepare('UPDATE providers SET is_active = 0 WHERE id = ?').run(provider.id);
      console.log(`  🚫 ${brand} deaktiviert (nicht EU)`);
    }
  }

  // Duplikate bereinigen: Wenn gleicher brand_name mehrfach existiert, nur einen behalten
  const duplicates = db.prepare(`
    SELECT brand_name, COUNT(*) as cnt FROM providers
    WHERE is_active = 1
    GROUP BY brand_name HAVING cnt > 1
  `).all();
  for (const dup of duplicates) {
    const all = db.prepare(
      'SELECT id FROM providers WHERE brand_name = ? AND is_active = 1 ORDER BY created_at DESC'
    ).all(dup.brand_name);
    // Alle außer dem neuesten deaktivieren
    for (let i = 1; i < all.length; i++) {
      db.prepare('UPDATE providers SET is_active = 0 WHERE id = ?').run(all[i].id);
      console.log(`  🔄 Duplikat entfernt: ${dup.brand_name}`);
    }
  }

  // Alte .ch URLs auf .de aktualisieren
  db.prepare(`UPDATE providers SET website_url = 'https://www.zalando.de'    WHERE brand_name = 'Zalando'   AND website_url LIKE '%zalando.ch%'`).run();
  db.prepare(`UPDATE providers SET website_url = 'https://www2.hm.com/de_de' WHERE brand_name = 'H&M'       AND website_url LIKE '%hm.com/ch%'`).run();
  db.prepare(`UPDATE providers SET website_url = 'https://www.zara.com/de'   WHERE brand_name = 'ZARA'      AND website_url LIKE '%zara.com/ch%'`).run();
  db.prepare(`UPDATE providers SET website_url = 'https://www.aboutyou.de'   WHERE brand_name = 'About You' AND website_url LIKE '%aboutyou.ch%'`).run();

  console.log('  ✅ URLs auf .de aktualisiert\n');

  // ═══════════════════════════════════════════════════
  // ANBIETER — EU-Modehändler mit kostenlosem Versand
  // ═══════════════════════════════════════════════════

  const providers = [
    {
      name: 'Zalando SE',
      brand_name: 'Zalando',
      website_url: 'https://www.zalando.de',
      affiliate_base_url: 'https://www.zalando.de/redirect?ref=catwalk&product=',
      info: 'DE – Gratis Versand & Rücksendung',
    },
    {
      name: 'H&M Hennes & Mauritz AB',
      brand_name: 'H&M',
      website_url: 'https://www2.hm.com/de_de',
      affiliate_base_url: '',
      info: 'SE – Gratis Versand ab €20',
    },
    {
      name: 'Inditex SA (ZARA)',
      brand_name: 'ZARA',
      website_url: 'https://www.zara.com/de',
      affiliate_base_url: '',
      info: 'ES – Gratis Versand ab €30',
    },
    {
      name: 'About You GmbH',
      brand_name: 'About You',
      website_url: 'https://www.aboutyou.de',
      affiliate_base_url: '',
      info: 'DE – Gratis Versand',
    },
    {
      name: 'MANGO MNG Holding SA',
      brand_name: 'Mango',
      website_url: 'https://shop.mango.com/de',
      affiliate_base_url: '',
      info: 'ES – Gratis Versand ab €30',
    },
    {
      name: 'COS (H&M Group)',
      brand_name: 'COS',
      website_url: 'https://www.cos.com/de-de',
      affiliate_base_url: '',
      info: 'SE – Gratis Versand ab €50',
    },
    {
      name: 'Massimo Dutti (Inditex)',
      brand_name: 'Massimo Dutti',
      website_url: 'https://www.massimodutti.com/de',
      affiliate_base_url: '',
      info: 'ES – Gratis Versand ab €30',
    },
    {
      name: '& Other Stories (H&M Group)',
      brand_name: '& Other Stories',
      website_url: 'https://www.stories.com/de-de',
      affiliate_base_url: '',
      info: 'SE – Gratis Versand ab €45',
    },
  ];

  const providerMap = {}; // brand_name -> id

  const insertProvider = db.prepare(`
    INSERT OR IGNORE INTO providers (id, name, brand_name, website_url, affiliate_base_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  let newProviders = 0;
  for (const p of providers) {
    // Prüfe ob Anbieter schon existiert
    const existing = db.prepare('SELECT id FROM providers WHERE brand_name = ?').get(p.brand_name);
    if (existing) {
      providerMap[p.brand_name] = existing.id;
      console.log(`  ⏭ ${p.brand_name} existiert bereits`);
    } else {
      const id = uuidv4();
      providerMap[p.brand_name] = id;
      insertProvider.run(id, p.name, p.brand_name, p.website_url, p.affiliate_base_url);
      newProviders++;
      console.log(`  ✅ ${p.brand_name} hinzugefügt (${p.info})`);
    }
  }

  console.log(`\n📦 ${newProviders} neue Anbieter hinzugefügt (${providers.length - newProviders} existierten bereits)\n`);

  // ═══════════════════════════════════════════════════
  // ARTIKEL — Herbst/Winter Kollektion (EUR-Preise)
  // ═══════════════════════════════════════════════════

  const articles = [
    // ── Zalando (DE) – Gratis Versand & Retoure ──
    { brand: 'Zalando', name: 'Seidenbluse Ivory',        category: 'oberteil',  price: 79.90,  color: 'Ivory',    product_url: 'https://www.zalando.de/seidenbluse-ivory' },
    { brand: 'Zalando', name: 'High-Waist Jeans Dark',    category: 'hose',      price: 59.90,  color: 'Dunkelblau', product_url: 'https://www.zalando.de/high-waist-jeans-dark' },
    { brand: 'Zalando', name: 'Ankle Boots Cognac',       category: 'schuhe',    price: 109.90, color: 'Cognac',   product_url: 'https://www.zalando.de/ankle-boots-cognac' },
    { brand: 'Zalando', name: 'Goldkette Filigran',       category: 'schmuck',   price: 34.90,  color: 'Gold',     product_url: 'https://www.zalando.de/goldkette-filigran' },
    { brand: 'Zalando', name: 'Wollmantel Camel',         category: 'jacke',     price: 159.90, color: 'Camel',    product_url: 'https://www.zalando.de/wollmantel-camel' },

    // ── H&M (SE/EU) – Gratis Versand ab €20 ──
    { brand: 'H&M', name: 'Oversized Hoodie',            category: 'oberteil',  price: 29.99,  color: 'Grau',     product_url: 'https://www2.hm.com/de_de/oversized-hoodie' },
    { brand: 'H&M', name: 'Cargo Pants Olive',           category: 'hose',      price: 39.99,  color: 'Olive',    product_url: 'https://www2.hm.com/de_de/cargo-pants-olive' },
    { brand: 'H&M', name: 'Chunky Sneakers',             category: 'schuhe',    price: 39.99,  color: 'Weiss',    product_url: 'https://www2.hm.com/de_de/chunky-sneakers' },
    { brand: 'H&M', name: 'Bucket Hat',                  category: 'kopfbedeckung', price: 12.99, color: 'Schwarz', product_url: 'https://www2.hm.com/de_de/bucket-hat' },
    { brand: 'H&M', name: 'Strickpullover Beige',        category: 'oberteil',  price: 34.99,  color: 'Beige',    product_url: 'https://www2.hm.com/de_de/strickpullover-beige' },

    // ── ZARA (ES) – Gratis Versand ab €30 ──
    { brand: 'ZARA', name: 'Blazer Oversized Schwarz',   category: 'jacke',     price: 99.95,  color: 'Schwarz',  product_url: 'https://www.zara.com/de/blazer-oversized' },
    { brand: 'ZARA', name: 'Wickelkleid Burgund',        category: 'kleid',     price: 69.95,  color: 'Burgund',  product_url: 'https://www.zara.com/de/wickelkleid-burgund' },
    { brand: 'ZARA', name: 'Loafers Schwarz',            category: 'schuhe',    price: 49.95,  color: 'Schwarz',  product_url: 'https://www.zara.com/de/loafers-schwarz' },
    { brand: 'ZARA', name: 'Midi-Rock Plissee',          category: 'rock',      price: 45.95,  color: 'Gold',     product_url: 'https://www.zara.com/de/midi-rock-plissee' },

    // ── About You (DE) – Gratis Versand ──
    { brand: 'About You', name: 'Boho-Bluse Weiss',      category: 'oberteil',  price: 39.90,  color: 'Weiss',    product_url: 'https://www.aboutyou.de/boho-bluse-weiss' },
    { brand: 'About You', name: 'Leder-Handtasche',      category: 'tasche',    price: 79.90,  color: 'Braun',    product_url: 'https://www.aboutyou.de/leder-handtasche' },
    { brand: 'About You', name: 'Sonnenbrille Vintage',   category: 'accessoire', price: 24.90, color: 'Braun',   product_url: 'https://www.aboutyou.de/sonnenbrille-vintage' },
    { brand: 'About You', name: 'Maxikleid Blumen',       category: 'kleid',     price: 59.90,  color: 'Bunt',     product_url: 'https://www.aboutyou.de/maxikleid-blumen' },

    // ── Mango (ES) – Gratis Versand ab €30 ──
    { brand: 'Mango', name: 'Leinen-Blazer Sand',        category: 'jacke',     price: 89.99,  color: 'Sand',     product_url: 'https://shop.mango.com/de/leinen-blazer-sand' },
    { brand: 'Mango', name: 'Paperbag-Hose Beige',       category: 'hose',      price: 49.99,  color: 'Beige',    product_url: 'https://shop.mango.com/de/paperbag-hose-beige' },
    { brand: 'Mango', name: 'Espadrilles Gold',          category: 'schuhe',    price: 35.99,  color: 'Gold',     product_url: 'https://shop.mango.com/de/espadrilles-gold' },
    { brand: 'Mango', name: 'Strohkorb-Tasche',          category: 'tasche',    price: 39.99,  color: 'Natur',    product_url: 'https://shop.mango.com/de/strohkorb-tasche' },

    // ── COS (SE/EU) – Gratis Versand ab €50 ──
    { brand: 'COS', name: 'Minimalist Trenchcoat',       category: 'jacke',     price: 175.00, color: 'Beige',    product_url: 'https://www.cos.com/de-de/minimalist-trenchcoat' },
    { brand: 'COS', name: 'Wide-Leg Hose Creme',         category: 'hose',      price: 89.00,  color: 'Creme',    product_url: 'https://www.cos.com/de-de/wide-leg-hose-creme' },
    { brand: 'COS', name: 'Clean-Cut Stiefeletten',      category: 'schuhe',    price: 135.00, color: 'Schwarz',  product_url: 'https://www.cos.com/de-de/clean-cut-stiefeletten' },

    // ── Massimo Dutti (ES) – Gratis Versand ab €30 ──
    { brand: 'Massimo Dutti', name: 'Seiden-Top Champagner', category: 'oberteil', price: 69.95, color: 'Champagner', product_url: 'https://www.massimodutti.com/de/seiden-top' },
    { brand: 'Massimo Dutti', name: 'Palazzo-Hose Navy',    category: 'hose',     price: 79.95,  color: 'Navy',      product_url: 'https://www.massimodutti.com/de/palazzo-hose' },
    { brand: 'Massimo Dutti', name: 'Leder-Pumps Nude',     category: 'schuhe',   price: 119.00, color: 'Nude',      product_url: 'https://www.massimodutti.com/de/leder-pumps' },

    // ── & Other Stories (SE/EU) – Gratis Versand ab €45 ──
    { brand: '& Other Stories', name: 'Satin-Wickelbluse',   category: 'oberteil', price: 79.00,  color: 'Smaragd',   product_url: 'https://www.stories.com/de-de/satin-wickelbluse' },
    { brand: '& Other Stories', name: 'Perlen-Armband',      category: 'schmuck',  price: 29.00,  color: 'Gold/Perle', product_url: 'https://www.stories.com/de-de/perlen-armband' },
    { brand: '& Other Stories', name: 'Seidenschal Muster',  category: 'accessoire', price: 49.00, color: 'Bunt',     product_url: 'https://www.stories.com/de-de/seidenschal' },
  ];

  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (id, provider_id, name, category, price, currency, product_url, color)
    VALUES (?, ?, ?, ?, ?, 'EUR', ?, ?)
  `);

  let newArticles = 0;
  for (const a of articles) {
    const providerId = providerMap[a.brand];
    if (!providerId) {
      console.log(`  ⚠️ Anbieter "${a.brand}" nicht gefunden, überspringe ${a.name}`);
      continue;
    }

    // Prüfe ob Artikel schon existiert (gleicher Name + Anbieter)
    const existing = db.prepare(
      'SELECT id FROM articles WHERE name = ? AND provider_id = ?'
    ).get(a.name, providerId);

    if (existing) {
      console.log(`  ⏭ ${a.brand}: "${a.name}" existiert bereits`);
    } else {
      insertArticle.run(uuidv4(), providerId, a.name, a.category, a.price, a.product_url, a.color);
      newArticles++;
      console.log(`  ✅ ${a.brand}: "${a.name}" (${a.category}, € ${a.price})`);
    }
  }

  console.log(`\n👗 ${newArticles} neue Artikel hinzugefügt (${articles.length - newArticles} existierten bereits)`);

  // ═══════════════════════════════════════════════════
  // BEISPIEL-OUTFITS für heute
  // ═══════════════════════════════════════════════════

  const today = new Date().toISOString().split('T')[0];
  const avatars = db.prepare('SELECT id, name FROM avatars WHERE is_active = 1 ORDER BY position_order').all();
  const allArticles = db.prepare(`
    SELECT a.id, a.name, a.category, p.brand_name
    FROM articles a JOIN providers p ON a.provider_id = p.id
    WHERE a.is_active = 1
  `).all();

  if (avatars.length > 0 && allArticles.length > 0) {
    // Outfit-Zuordnungen nach Avatar-Stil
    const outfitPlans = {
      'Sol':    { brands: ['H&M', 'About You'],             categories: ['oberteil', 'hose', 'schuhe'] },
      'Elena':  { brands: ['ZARA', 'Massimo Dutti'],        categories: ['oberteil', 'jacke', 'hose', 'schuhe'] },
      'Mira':   { brands: ['H&M', 'Mango'],                 categories: ['oberteil', 'hose', 'schuhe'] },
      'Lauren': { brands: ['COS', 'Massimo Dutti'],          categories: ['oberteil', 'jacke', 'schuhe', 'accessoire'] },
      'Claire': { brands: ['Zalando', 'ZARA'],               categories: ['kleid', 'jacke', 'schuhe', 'schmuck'] },
      'Amy':    { brands: ['About You', '& Other Stories'],   categories: ['oberteil', 'rock', 'schuhe', 'tasche'] },
    };

    const insertOutfit = db.prepare(`
      INSERT OR IGNORE INTO avatar_outfits (id, avatar_id, article_id, outfit_date, layer_order)
      VALUES (?, ?, ?, ?, ?)
    `);

    let outfitCount = 0;
    for (const avatar of avatars) {
      const plan = outfitPlans[avatar.name];
      if (!plan) continue;

      let layer = 1;
      for (const cat of plan.categories) {
        // Finde einen passenden Artikel (bevorzugt von gewünschten Brands)
        const article = allArticles.find(a =>
          a.category === cat && plan.brands.includes(a.brand_name)
        ) || allArticles.find(a => a.category === cat);

        if (article) {
          try {
            insertOutfit.run(uuidv4(), avatar.id, article.id, today, layer);
            outfitCount++;
          } catch (e) { /* UNIQUE constraint = already assigned */ }
          layer++;
        }
      }
    }

    console.log(`\n👔 ${outfitCount} Outfit-Zuordnungen für ${today} erstellt`);
  }

  console.log('\n🎭 Seed-Daten erfolgreich geladen!');
  console.log('   Alle Anbieter versenden kostenlos innerhalb der EU.');
  console.log('   Starte den Server mit: node server/index.js');
  console.log('   Admin:   http://localhost:3000/admin');
  console.log('   Catwalk: http://localhost:3000/catwalk');
}

// Direkt ausführbar
if (require.main === module) {
  seedProviders()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Seed-Fehler:', err);
      process.exit(1);
    });
}

module.exports = { seedProviders };
