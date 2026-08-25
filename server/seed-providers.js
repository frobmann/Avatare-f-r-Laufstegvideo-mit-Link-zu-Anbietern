/**
 * Seed-Daten: Echte Schweizer Mode-Anbieter und Beispiel-Artikel
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
  // ANBIETER — Echte Schweizer & europäische Modehändler
  // ═══════════════════════════════════════════════════

  const providers = [
    {
      name: 'Zalando SE',
      brand_name: 'Zalando',
      website_url: 'https://www.zalando.ch',
      affiliate_base_url: 'https://www.zalando.ch/redirect?ref=catwalk&product=',
    },
    {
      name: 'H&M Hennes & Mauritz AB',
      brand_name: 'H&M',
      website_url: 'https://www2.hm.com/de_ch',
      affiliate_base_url: '',
    },
    {
      name: 'Inditex SA (ZARA)',
      brand_name: 'ZARA',
      website_url: 'https://www.zara.com/ch',
      affiliate_base_url: '',
    },
    {
      name: 'About You GmbH',
      brand_name: 'About You',
      website_url: 'https://www.aboutyou.ch',
      affiliate_base_url: '',
    },
    {
      name: 'PKZ Burger-Kehl & Co. AG',
      brand_name: 'PKZ',
      website_url: 'https://www.pkz.ch',
      affiliate_base_url: '',
    },
    {
      name: 'Globus Gruppe',
      brand_name: 'Globus',
      website_url: 'https://www.globus.ch',
      affiliate_base_url: '',
    },
    {
      name: 'Manor AG',
      brand_name: 'Manor',
      website_url: 'https://www.manor.ch',
      affiliate_base_url: '',
    },
    {
      name: 'Chicorée Fashion AG',
      brand_name: 'Chicorée',
      website_url: 'https://www.chicorée.ch',
      affiliate_base_url: '',
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
      console.log(`  ✅ ${p.brand_name} hinzugefügt`);
    }
  }

  console.log(`\n📦 ${newProviders} neue Anbieter hinzugefügt (${providers.length - newProviders} existierten bereits)\n`);

  // ═══════════════════════════════════════════════════
  // ARTIKEL — Beispiel-Kollektion Herbst/Winter
  // ═══════════════════════════════════════════════════

  const articles = [
    // ── Zalando ──
    { brand: 'Zalando', name: 'Seidenbluse Ivory',        category: 'oberteil',  price: 89.90,  color: 'Ivory',    product_url: 'https://www.zalando.ch/seidenbluse-ivory' },
    { brand: 'Zalando', name: 'High-Waist Jeans Dark',    category: 'hose',      price: 69.90,  color: 'Dunkelblau', product_url: 'https://www.zalando.ch/high-waist-jeans-dark' },
    { brand: 'Zalando', name: 'Ankle Boots Cognac',       category: 'schuhe',    price: 129.90, color: 'Cognac',   product_url: 'https://www.zalando.ch/ankle-boots-cognac' },
    { brand: 'Zalando', name: 'Goldkette Filigran',       category: 'schmuck',   price: 39.90,  color: 'Gold',     product_url: 'https://www.zalando.ch/goldkette-filigran' },
    { brand: 'Zalando', name: 'Wollmantel Camel',         category: 'jacke',     price: 189.90, color: 'Camel',    product_url: 'https://www.zalando.ch/wollmantel-camel' },

    // ── H&M ──
    { brand: 'H&M', name: 'Oversized Hoodie',            category: 'oberteil',  price: 34.90,  color: 'Grau',     product_url: 'https://www2.hm.com/de_ch/oversized-hoodie' },
    { brand: 'H&M', name: 'Cargo Pants Olive',           category: 'hose',      price: 49.90,  color: 'Olive',    product_url: 'https://www2.hm.com/de_ch/cargo-pants-olive' },
    { brand: 'H&M', name: 'Chunky Sneakers',             category: 'schuhe',    price: 44.90,  color: 'Weiss',    product_url: 'https://www2.hm.com/de_ch/chunky-sneakers' },
    { brand: 'H&M', name: 'Bucket Hat',                  category: 'kopfbedeckung', price: 14.90, color: 'Schwarz', product_url: 'https://www2.hm.com/de_ch/bucket-hat' },
    { brand: 'H&M', name: 'Strickpullover Beige',        category: 'oberteil',  price: 39.90,  color: 'Beige',    product_url: 'https://www2.hm.com/de_ch/strickpullover-beige' },

    // ── ZARA ──
    { brand: 'ZARA', name: 'Blazer Oversized Schwarz',   category: 'jacke',     price: 119.00, color: 'Schwarz',  product_url: 'https://www.zara.com/ch/blazer-oversized' },
    { brand: 'ZARA', name: 'Wickelkleid Burgund',        category: 'kleid',     price: 79.90,  color: 'Burgund',  product_url: 'https://www.zara.com/ch/wickelkleid-burgund' },
    { brand: 'ZARA', name: 'Loafers Schwarz',            category: 'schuhe',    price: 59.90,  color: 'Schwarz',  product_url: 'https://www.zara.com/ch/loafers-schwarz' },
    { brand: 'ZARA', name: 'Midi-Rock Plissee',          category: 'rock',      price: 49.90,  color: 'Gold',     product_url: 'https://www.zara.com/ch/midi-rock-plissee' },
    { brand: 'ZARA', name: 'Satin-Top Smaragd',          category: 'oberteil',  price: 35.90,  color: 'Smaragd',  product_url: 'https://www.zara.com/ch/satin-top-smaragd' },

    // ── About You ──
    { brand: 'About You', name: 'Boho-Bluse Weiss',      category: 'oberteil',  price: 45.90,  color: 'Weiss',    product_url: 'https://www.aboutyou.ch/boho-bluse-weiss' },
    { brand: 'About You', name: 'Leder-Handtasche',      category: 'tasche',    price: 89.90,  color: 'Braun',    product_url: 'https://www.aboutyou.ch/leder-handtasche' },
    { brand: 'About You', name: 'Sonnenbrille Vintage',   category: 'accessoire', price: 29.90, color: 'Braun',   product_url: 'https://www.aboutyou.ch/sonnenbrille-vintage' },
    { brand: 'About You', name: 'Maxikleid Blumen',       category: 'kleid',     price: 69.90,  color: 'Bunt',     product_url: 'https://www.aboutyou.ch/maxikleid-blumen' },

    // ── PKZ ──
    { brand: 'PKZ', name: 'Cashmere-Pullover',           category: 'oberteil',  price: 249.00, color: 'Grau',     product_url: 'https://www.pkz.ch/cashmere-pullover' },
    { brand: 'PKZ', name: 'Seidenrock Navy',             category: 'rock',      price: 189.00, color: 'Navy',     product_url: 'https://www.pkz.ch/seidenrock-navy' },
    { brand: 'PKZ', name: 'Lederstiefel Schwarz',        category: 'schuhe',    price: 349.00, color: 'Schwarz',  product_url: 'https://www.pkz.ch/lederstiefel-schwarz' },

    // ── Globus ──
    { brand: 'Globus', name: 'Designer Trenchcoat',      category: 'jacke',     price: 399.00, color: 'Beige',    product_url: 'https://www.globus.ch/designer-trenchcoat' },
    { brand: 'Globus', name: 'Seidenschal Muster',       category: 'accessoire', price: 129.00, color: 'Bunt',    product_url: 'https://www.globus.ch/seidenschal-muster' },
    { brand: 'Globus', name: 'Pumps Rot',                category: 'schuhe',    price: 219.00, color: 'Rot',      product_url: 'https://www.globus.ch/pumps-rot' },

    // ── Manor ──
    { brand: 'Manor', name: 'Basic T-Shirt Pack',        category: 'oberteil',  price: 29.90,  color: 'Weiss',    product_url: 'https://www.manor.ch/basic-tshirt-pack' },
    { brand: 'Manor', name: 'Stretch-Jeans Slim',        category: 'hose',      price: 59.90,  color: 'Blau',     product_url: 'https://www.manor.ch/stretch-jeans-slim' },
    { brand: 'Manor', name: 'Sneakers Retro',            category: 'schuhe',    price: 79.90,  color: 'Weiss/Blau', product_url: 'https://www.manor.ch/sneakers-retro' },

    // ── Chicorée ──
    { brand: 'Chicorée', name: 'Crop Cardigan',          category: 'oberteil',  price: 19.90,  color: 'Rosa',     product_url: 'https://www.chicorée.ch/crop-cardigan' },
    { brand: 'Chicorée', name: 'Leggings Sport',         category: 'hose',      price: 24.90,  color: 'Schwarz',  product_url: 'https://www.chicorée.ch/leggings-sport' },
    { brand: 'Chicorée', name: 'Rucksack Mini',          category: 'tasche',    price: 34.90,  color: 'Schwarz',  product_url: 'https://www.chicorée.ch/rucksack-mini' },
  ];

  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (id, provider_id, name, category, price, currency, product_url, color)
    VALUES (?, ?, ?, ?, ?, 'CHF', ?, ?)
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
      console.log(`  ✅ ${a.brand}: "${a.name}" (${a.category}, CHF ${a.price})`);
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
      'Sol':    { styles: ['Jeans Style'],        brands: ['H&M', 'Chicorée'], categories: ['oberteil', 'hose', 'schuhe'] },
      'Elena':  { styles: ['Business Style'],     brands: ['ZARA', 'PKZ'],     categories: ['oberteil', 'jacke', 'hose', 'schuhe'] },
      'Mira':   { styles: ['Sportlich-elegant'],  brands: ['H&M', 'Manor'],    categories: ['oberteil', 'hose', 'schuhe'] },
      'Lauren': { styles: ['Quiet Luxury'],       brands: ['Globus', 'PKZ'],   categories: ['oberteil', 'jacke', 'schuhe', 'accessoire'] },
      'Claire': { styles: ['Klassisch-zeitlos'],   brands: ['Zalando', 'ZARA'], categories: ['kleid', 'jacke', 'schuhe', 'schmuck'] },
      'Amy':    { styles: ['Romantisch-verspielt'], brands: ['About You', 'Chicorée'], categories: ['oberteil', 'rock', 'schuhe', 'tasche'] },
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
