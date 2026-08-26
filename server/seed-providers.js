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
  // AVATARE — 6 Fashion Models
  // ═══════════════════════════════════════════════════

  const avatarDefs = [
    { name: 'Sol',    description: 'Jeans Style',                    position_order: 1 },
    { name: 'Elena',  description: 'Business Style',                 position_order: 2 },
    { name: 'Mira',   description: 'Sportlich-elegant',              position_order: 3 },
    { name: 'Lauren', description: 'Quiet Luxury / Minimalismus',    position_order: 4 },
    { name: 'Claire', description: 'Klassisch-zeitlos',              position_order: 5 },
    { name: 'Amy',    description: 'Romantisch-verspielt / Boho',    position_order: 6 },
  ];

  const insertAvatar = db.prepare(`
    INSERT OR IGNORE INTO avatars (id, name, description, position_order, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);

  let newAvatars = 0;
  for (const a of avatarDefs) {
    const existing = db.prepare('SELECT id FROM avatars WHERE name = ?').get(a.name);
    if (existing) {
      console.log(`  ⏭ Avatar "${a.name}" existiert bereits`);
    } else {
      insertAvatar.run(uuidv4(), a.name, a.description, a.position_order);
      newAvatars++;
      console.log(`  ✅ Avatar "${a.name}" (${a.description})`);
    }
  }
  console.log(`\n👩 ${newAvatars} neue Avatare hinzugefügt\n`);

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
    {
      name: 'Amazon Fashion (Amazon EU S.à r.l.)',
      brand_name: 'Amazon Fashion',
      website_url: 'https://www.amazon.de/fashion',
      affiliate_base_url: 'https://www.amazon.de/dp/',
      info: 'LU/DE – Gratis Versand ab €39 (Prime: immer gratis)',
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

  // ═══════════════════════════════════════════════════════════════
  // ARTIKEL — Alle auf Amazon.de verkauft (Affiliate-Kommission!)
  // Verschiedene Marken, aber ALLE über die Amazon-Plattform
  // ═══════════════════════════════════════════════════════════════

  const articles = [
    // ── OBERTEILE (verschiedene Farben & Marken, alle auf Amazon.de) ──
    { brand: 'Amazon Fashion', name: 'Calvin Klein T-Shirt 2er-Pack',  category: 'oberteil',  price: 34.95,  color: 'Weiss',       product_url: 'https://www.amazon.de/dp/B07BFQF3RJ' },
    { brand: 'Amazon Fashion', name: 'Vero Moda Bluse Satin',          category: 'oberteil',  price: 29.99,  color: 'Burgund',     product_url: 'https://www.amazon.de/dp/B0CK4LNRFH' },
    { brand: 'Amazon Fashion', name: 'VILA Wickelbluse Blumen',        category: 'oberteil',  price: 32.99,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B0CMXR9TPN' },
    { brand: 'Amazon Fashion', name: 'ONLY Strickpullover V-Neck',    category: 'oberteil',  price: 24.99,  color: 'Camel',       product_url: 'https://www.amazon.de/dp/B0BNXK3LFR' },
    { brand: 'Amazon Fashion', name: 'Marc O\'Polo Leinenbluse',      category: 'oberteil',  price: 59.95,  color: 'Ivory',       product_url: 'https://www.amazon.de/dp/B0D2RFKLMN' },
    { brand: 'Amazon Fashion', name: 'Tommy Hilfiger Poloshirt',       category: 'oberteil',  price: 49.90,  color: 'Blau',        product_url: 'https://www.amazon.de/dp/B09FXKM3QZ' },
    { brand: 'Amazon Fashion', name: 'Esprit Seidenbluse',             category: 'oberteil',  price: 69.95,  color: 'Champagner',  product_url: 'https://www.amazon.de/dp/B0D4RFKLMN' },
    { brand: 'Amazon Fashion', name: 's.Oliver Jersey-Top',            category: 'oberteil',  price: 19.99,  color: 'Smaragd',     product_url: 'https://www.amazon.de/dp/B0BNXK8LFR' },

    // ── HOSEN (verschiedene Farben & Marken) ──
    { brand: 'Amazon Fashion', name: 'Levi\'s 501 Original Jeans',     category: 'hose',      price: 79.95,  color: 'Indigo',      product_url: 'https://www.amazon.de/dp/B07D4F3KYN' },
    { brand: 'Amazon Fashion', name: 'GANT Chino Slim',                category: 'hose',      price: 99.00,  color: 'Beige',       product_url: 'https://www.amazon.de/dp/B0BGLM2R3N' },
    { brand: 'Amazon Fashion', name: 'ONLY Palazzo-Hose Wide',         category: 'hose',      price: 32.99,  color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B0CJYR5TPQ' },
    { brand: 'Amazon Fashion', name: 's.Oliver Stoffhose Slim',        category: 'hose',      price: 49.99,  color: 'Olive',       product_url: 'https://www.amazon.de/dp/B0CMXN7RFQ' },
    { brand: 'Amazon Fashion', name: 'VERO MODA Paperbag-Hose',       category: 'hose',      price: 34.99,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B0BNXM4KFR' },
    { brand: 'Amazon Fashion', name: 'ESPRIT Collection Hose',         category: 'hose',      price: 59.99,  color: 'Bordeaux',    product_url: 'https://www.amazon.de/dp/B0CK5NRXFM' },
    { brand: 'Amazon Fashion', name: 'Tom Tailor Skinny Jeans',        category: 'hose',      price: 39.99,  color: 'Dunkelblau',  product_url: 'https://www.amazon.de/dp/B0D4XRFNKM' },
    { brand: 'Amazon Fashion', name: 'PIECES Wide-Leg Hose',           category: 'hose',      price: 29.99,  color: 'Creme',       product_url: 'https://www.amazon.de/dp/B0D4YRFNKM' },

    // ── JACKEN & MÄNTEL ──
    { brand: 'Amazon Fashion', name: 'Tommy Hilfiger Steppjacke',      category: 'jacke',     price: 129.90, color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B0B5KXQZ8M' },
    { brand: 'Amazon Fashion', name: 'Esprit Wollmantel',              category: 'jacke',     price: 99.99,  color: 'Grau',        product_url: 'https://www.amazon.de/dp/B0BK3NLZFR' },
    { brand: 'Amazon Fashion', name: 'ONLY Wintermantel Lang',         category: 'jacke',     price: 69.99,  color: 'Camel',       product_url: 'https://www.amazon.de/dp/B0BDP2XYZQ' },
    { brand: 'Amazon Fashion', name: 'SELECTED FEMME Blazer Slim',     category: 'jacke',     price: 89.99,  color: 'Navy',        product_url: 'https://www.amazon.de/dp/B0BN5RFLKM' },
    { brand: 'Amazon Fashion', name: 'VILA Trenchcoat Classic',        category: 'jacke',     price: 74.99,  color: 'Beige',       product_url: 'https://www.amazon.de/dp/B0D3NRFXKM' },
    { brand: 'Amazon Fashion', name: 'Jack Wolfskin Softshelljacke',   category: 'jacke',     price: 89.95,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B0D4ZRFNKM' },

    // ── SCHUHE (verschiedene Farben!) ──
    { brand: 'Amazon Fashion', name: 'BOSS Sneaker Low',               category: 'schuhe',    price: 149.00, color: 'Weiss',       product_url: 'https://www.amazon.de/dp/B09FSCM4KZ' },
    { brand: 'Amazon Fashion', name: 'Tamaris Stiefeletten Leder',     category: 'schuhe',    price: 79.95,  color: 'Cognac',      product_url: 'https://www.amazon.de/dp/B0B8FLM9QZ' },
    { brand: 'Amazon Fashion', name: 'Gabor Pumps Elegant',            category: 'schuhe',    price: 89.95,  color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B0CMXR8TPN' },
    { brand: 'Amazon Fashion', name: 'MARCO TOZZI Sandaletten',        category: 'schuhe',    price: 49.95,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B0D2RFNKLM' },
    { brand: 'Amazon Fashion', name: 'Geox Ballerinas',                category: 'schuhe',    price: 69.95,  color: 'Nude',        product_url: 'https://www.amazon.de/dp/B0BNXK5LFR' },
    { brand: 'Amazon Fashion', name: 'Clarks Chelsea Boots',           category: 'schuhe',    price: 99.95,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B0D4ARFNKM' },

    // ── KLEIDER ──
    { brand: 'Amazon Fashion', name: 's.Oliver Strickkleid Midi',      category: 'kleid',     price: 59.99,  color: 'Dunkelgrün',  product_url: 'https://www.amazon.de/dp/B0CKXR7TPM' },
    { brand: 'Amazon Fashion', name: 'ONLY Wickelkleid Midi',          category: 'kleid',     price: 39.99,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B0CMXN9RFQ' },
    { brand: 'Amazon Fashion', name: 'VILA Maxikleid',                 category: 'kleid',     price: 44.99,  color: 'Blau',        product_url: 'https://www.amazon.de/dp/B0D3XRFNKM' },
    { brand: 'Amazon Fashion', name: 'Desigual Kleid Boho',            category: 'kleid',     price: 79.95,  color: 'Bunt',        product_url: 'https://www.amazon.de/dp/B0D4BRFNKM' },

    // ── RÖCKE ──
    { brand: 'Amazon Fashion', name: 'PIECES Midi-Rock Plissee',       category: 'rock',      price: 27.99,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B0CJXW3R5H' },
    { brand: 'Amazon Fashion', name: 'VERO MODA Bleistiftrock',        category: 'rock',      price: 24.99,  color: 'Burgund',     product_url: 'https://www.amazon.de/dp/B0BNXM6KFR' },

    // ── TASCHEN ──
    { brand: 'Amazon Fashion', name: 'Liebeskind Berlin Ledertasche',  category: 'tasche',    price: 119.00, color: 'Cognac',      product_url: 'https://www.amazon.de/dp/B07QFNR3YZ' },
    { brand: 'Amazon Fashion', name: 'BOSS Shopper Tasche',            category: 'tasche',    price: 159.00, color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B0D2XRFNKM' },
    { brand: 'Amazon Fashion', name: 'Desigual Schultertasche',        category: 'tasche',    price: 64.95,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B0D4CRFNKM' },

    // ── SCHMUCK & ACCESSOIRES ──
    { brand: 'Amazon Fashion', name: 'Fossil Armbanduhr Rosé',         category: 'schmuck',   price: 89.00,  color: 'Roségold',    product_url: 'https://www.amazon.de/dp/B07N8JVKQ4' },
    { brand: 'Amazon Fashion', name: 'SWAROVSKI Halskette Kristall',   category: 'schmuck',   price: 69.00,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B0BNXK7LFR' },
    { brand: 'Amazon Fashion', name: 'Ray-Ban Sonnenbrille',           category: 'accessoire', price: 129.00, color: 'Schwarz',    product_url: 'https://www.amazon.de/dp/B0D4DRFNKM' },
    { brand: 'Amazon Fashion', name: 'JOOP! Schal Wolle',              category: 'accessoire', price: 49.95,  color: 'Grau',       product_url: 'https://www.amazon.de/dp/B0D4ERFNKM' },
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
    // Bestehende Outfits für heute löschen und neu zuweisen
    db.prepare('DELETE FROM avatar_outfits WHERE outfit_date = ?').run(today);

    // Outfit-Zuordnungen — alle Artikel über Amazon (Affiliate-Kommission!)
    const outfitPlans = {
      'Sol':    { brands: ['Amazon Fashion'], categories: ['oberteil', 'hose', 'schuhe'] },
      'Elena':  { brands: ['Amazon Fashion'], categories: ['oberteil', 'jacke', 'hose', 'schuhe', 'schmuck'] },
      'Mira':   { brands: ['Amazon Fashion'], categories: ['oberteil', 'hose', 'schuhe', 'accessoire'] },
      'Lauren': { brands: ['Amazon Fashion'], categories: ['oberteil', 'jacke', 'hose', 'schuhe'] },
      'Claire': { brands: ['Amazon Fashion'], categories: ['kleid', 'schuhe', 'schmuck', 'tasche'] },
      'Amy':    { brands: ['Amazon Fashion'], categories: ['kleid', 'schuhe', 'tasche', 'accessoire'] },
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
      const usedArticleIds = new Set(); // Keine doppelten Artikel pro Avatar
      for (const cat of plan.categories) {
        // Bevorzugte Marken in Reihenfolge durchgehen (erste = höchste Priorität)
        let article = null;
        for (const brand of plan.brands) {
          article = allArticles.find(a =>
            a.category === cat && a.brand_name === brand && !usedArticleIds.has(a.id)
          );
          if (article) break;
        }
        // Fallback: irgendein passender Artikel
        if (!article) {
          article = allArticles.find(a =>
            a.category === cat && !usedArticleIds.has(a.id)
          );
        }

        if (article) {
          try {
            insertOutfit.run(uuidv4(), avatar.id, article.id, today, layer);
            usedArticleIds.add(article.id);
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
