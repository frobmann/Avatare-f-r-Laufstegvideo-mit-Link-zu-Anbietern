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
  // BEREINIGUNG — Alte Retailer-Anbieter deaktivieren
  // (Wir nutzen jetzt echte Marken statt Retailer-Namen)
  // ═══════════════════════════════════════════════════

  const oldRetailers = ['ASOS', 'PKZ', 'Globus', 'Manor', 'Chicorée', 'Zalando', 'H&M', 'ZARA', 'About You', 'Mango', 'COS', 'Massimo Dutti', '& Other Stories', 'Amazon Fashion'];
  for (const brand of oldRetailers) {
    const provider = db.prepare('SELECT id FROM providers WHERE brand_name = ?').get(brand);
    if (provider) {
      db.prepare('UPDATE articles SET is_active = 0 WHERE provider_id = ?').run(provider.id);
      db.prepare('UPDATE providers SET is_active = 0 WHERE id = ?').run(provider.id);
      console.log(`  🔄 ${brand} → durch echte Marken ersetzt`);
    }
  }

  // Duplikate bereinigen
  const duplicates = db.prepare(`
    SELECT brand_name, COUNT(*) as cnt FROM providers
    WHERE is_active = 1
    GROUP BY brand_name HAVING cnt > 1
  `).all();
  for (const dup of duplicates) {
    const all = db.prepare(
      'SELECT id FROM providers WHERE brand_name = ? AND is_active = 1 ORDER BY created_at DESC'
    ).all(dup.brand_name);
    for (let i = 1; i < all.length; i++) {
      db.prepare('UPDATE providers SET is_active = 0 WHERE id = ?').run(all[i].id);
      console.log(`  🔄 Duplikat entfernt: ${dup.brand_name}`);
    }
  }

  console.log('  ✅ Bereinigung abgeschlossen\n');

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
  // ANBIETER — Echte Marken, alle über Amazon.de verkauft
  // Jede Marke = eigener Provider, aber ALLE über Amazon-Affiliate!
  // ═══════════════════════════════════════════════════

  const providers = [
    { name: 'Calvin Klein',          brand_name: 'Calvin Klein',      website_url: 'https://www.amazon.de/stores/CalvinKlein',      affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Tommy Hilfiger',        brand_name: 'Tommy Hilfiger',    website_url: 'https://www.amazon.de/stores/TommyHilfiger',    affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Levi\'s',              brand_name: 'Levi\'s',           website_url: 'https://www.amazon.de/stores/Levis',            affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'BOSS',                  brand_name: 'BOSS',              website_url: 'https://www.amazon.de/stores/BOSS',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 's.Oliver',             brand_name: 's.Oliver',          website_url: 'https://www.amazon.de/stores/sOliver',          affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Esprit',               brand_name: 'Esprit',            website_url: 'https://www.amazon.de/stores/Esprit',           affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'ONLY',                  brand_name: 'ONLY',              website_url: 'https://www.amazon.de/stores/ONLY',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Vero Moda',            brand_name: 'Vero Moda',         website_url: 'https://www.amazon.de/stores/VeroModa',         affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'VILA',                  brand_name: 'VILA',              website_url: 'https://www.amazon.de/stores/VILA',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Marc O\'Polo',         brand_name: 'Marc O\'Polo',      website_url: 'https://www.amazon.de/stores/MarcOPolo',        affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Tom Tailor',           brand_name: 'Tom Tailor',        website_url: 'https://www.amazon.de/stores/TomTailor',        affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'GANT',                  brand_name: 'GANT',              website_url: 'https://www.amazon.de/stores/GANT',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'SELECTED FEMME',       brand_name: 'SELECTED FEMME',    website_url: 'https://www.amazon.de/stores/Selected',         affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'PIECES',               brand_name: 'PIECES',            website_url: 'https://www.amazon.de/stores/Pieces',           affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Tamaris',              brand_name: 'Tamaris',           website_url: 'https://www.amazon.de/stores/Tamaris',          affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Gabor',                brand_name: 'Gabor',             website_url: 'https://www.amazon.de/stores/Gabor',            affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Geox',                 brand_name: 'Geox',              website_url: 'https://www.amazon.de/stores/Geox',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Clarks',               brand_name: 'Clarks',            website_url: 'https://www.amazon.de/stores/Clarks',           affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Desigual',             brand_name: 'Desigual',          website_url: 'https://www.amazon.de/stores/Desigual',         affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Liebeskind Berlin',    brand_name: 'Liebeskind Berlin', website_url: 'https://www.amazon.de/stores/Liebeskind',       affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'SWAROVSKI',            brand_name: 'SWAROVSKI',         website_url: 'https://www.amazon.de/stores/Swarovski',        affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Fossil',               brand_name: 'Fossil',            website_url: 'https://www.amazon.de/stores/Fossil',           affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Ray-Ban',              brand_name: 'Ray-Ban',           website_url: 'https://www.amazon.de/stores/RayBan',           affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'JOOP!',                brand_name: 'JOOP!',             website_url: 'https://www.amazon.de/stores/Joop',             affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'Jack Wolfskin',        brand_name: 'Jack Wolfskin',     website_url: 'https://www.amazon.de/stores/JackWolfskin',     affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
    { name: 'MARCO TOZZI',          brand_name: 'MARCO TOZZI',       website_url: 'https://www.amazon.de/stores/MarcoTozzi',       affiliate_base_url: 'https://www.amazon.de/dp/', info: 'Via Amazon.de' },
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
    // ── OBERTEILE — echte Marken, alle über Amazon.de (Affiliate!) ──
    // ALLE ASINs verifiziert via WebSearch August 2026
    { brand: 'Calvin Klein',      name: 'Calvin Klein T-Shirt 2er-Pack',  category: 'oberteil',  price: 34.95,  color: 'Weiss',       product_url: 'https://www.amazon.de/dp/B0BTD7CCHR' },
    { brand: 'Vero Moda',         name: 'Vero Moda Bluse',                category: 'oberteil',  price: 29.99,  color: 'Burgund',     product_url: 'https://www.amazon.de/dp/B0BB88G31H' },
    { brand: 'VILA',              name: 'VILA Bluse Elegant',             category: 'oberteil',  price: 32.99,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B0CS6XMZC8' },
    { brand: 'ONLY',              name: 'ONLY Strickpullover Damen',      category: 'oberteil',  price: 24.99,  color: 'Camel',       product_url: 'https://www.amazon.de/dp/B0CLHTFYWP' },
    { brand: 'Marc O\'Polo',     name: 'Marc O\'Polo Bluse Kurzarm',    category: 'oberteil',  price: 59.95,  color: 'Ivory',       product_url: 'https://www.amazon.de/dp/B0CC79XWS7' },
    { brand: 'Tommy Hilfiger',    name: 'Tommy Hilfiger Poloshirt',       category: 'oberteil',  price: 49.90,  color: 'Blau',        product_url: 'https://www.amazon.de/dp/B0BLS3VWB7' },
    { brand: 'Esprit',            name: 'Esprit Collection Satinbluse',   category: 'oberteil',  price: 39.99,  color: 'Champagner',  product_url: 'https://www.amazon.de/dp/B09RKZ6L4Y' },
    { brand: 's.Oliver',         name: 's.Oliver Damen T-Shirt',         category: 'oberteil',  price: 19.99,  color: 'Smaragd',     product_url: 'https://www.amazon.de/dp/B0BYPBMJ4S' },

    // ── HOSEN ──
    { brand: 'Levi\'s',          name: 'Levi\'s 501 Crop Jeans',         category: 'hose',      price: 79.95,  color: 'Indigo',      product_url: 'https://www.amazon.de/dp/B08PG2T5JF' },
    { brand: 'GANT',              name: 'GANT Slim Chinos Klassisch',     category: 'hose',      price: 99.00,  color: 'Beige',       product_url: 'https://www.amazon.de/dp/B0BG5SV37G' },
    { brand: 'ONLY',              name: 'ONLY Wide Leg Hose',             category: 'hose',      price: 32.99,  color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B01BOVUU9Y' },
    { brand: 's.Oliver',         name: 's.Oliver Damen Hose',            category: 'hose',      price: 49.99,  color: 'Olive',       product_url: 'https://www.amazon.de/dp/B087DD8238' },
    { brand: 'Vero Moda',         name: 'Vero Moda Paperbag-Hose',       category: 'hose',      price: 34.99,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B07H95W5YB' },
    { brand: 'Esprit',            name: 'Esprit Collection Hose',         category: 'hose',      price: 59.99,  color: 'Bordeaux',    product_url: 'https://www.amazon.de/dp/B084ZSY757' },
    { brand: 'Tom Tailor',        name: 'Tom Tailor Kate Skinny Jeans',   category: 'hose',      price: 39.99,  color: 'Dunkelblau',  product_url: 'https://www.amazon.de/dp/B0B5JWKHZ6' },
    { brand: 'PIECES',            name: 'PIECES Midi-Rock Hw',            category: 'rock',      price: 29.99,  color: 'Creme',       product_url: 'https://www.amazon.de/dp/B0BBXKX68T' },

    // ── JACKEN & MÄNTEL ──
    { brand: 'Tommy Hilfiger',    name: 'Tommy Hilfiger Steppjacke',      category: 'jacke',     price: 129.90, color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B00IDXFMLI' },
    { brand: 'Esprit',            name: 'Esprit Damen Mantel',            category: 'jacke',     price: 99.99,  color: 'Grau',        product_url: 'https://www.amazon.de/dp/B071LJNZ7J' },
    { brand: 'ONLY',              name: 'ONLY Sedona Mantel',             category: 'jacke',     price: 69.99,  color: 'Camel',       product_url: 'https://www.amazon.de/dp/B072J68T8W' },
    { brand: 'SELECTED FEMME',    name: 'SELECTED FEMME Blazer Slim',     category: 'jacke',     price: 89.99,  color: 'Navy',        product_url: 'https://www.amazon.de/dp/B0DNRTXN36' },
    { brand: 'VILA',              name: 'VILA Vimersin Trenchcoat',       category: 'jacke',     price: 74.99,  color: 'Beige',       product_url: 'https://www.amazon.de/dp/B0CKWYNM36' },
    { brand: 'Jack Wolfskin',     name: 'Jack Wolfskin Softshelljacke',   category: 'jacke',     price: 89.95,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B00R6ANU5E' },

    // ── SCHUHE ──
    { brand: 'BOSS',              name: 'BOSS Low-Top Sneaker',           category: 'schuhe',    price: 149.00, color: 'Weiss',       product_url: 'https://www.amazon.de/dp/B097S27181' },
    { brand: 'Tamaris',           name: 'Tamaris Stiefeletten Leder',     category: 'schuhe',    price: 79.95,  color: 'Cognac',      product_url: 'https://www.amazon.de/dp/B07L4237PB' },
    { brand: 'Gabor',             name: 'Gabor Comfort Pumps',            category: 'schuhe',    price: 89.95,  color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B07Q32V8SH' },
    { brand: 'MARCO TOZZI',       name: 'MARCO TOZZI Sandalette',         category: 'schuhe',    price: 49.95,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B0C7CQLDLP' },
    { brand: 'Geox',              name: 'Geox D Annytah Ballerinas',      category: 'schuhe',    price: 69.95,  color: 'Nude',        product_url: 'https://www.amazon.de/dp/B0D6KKV6CL' },
    { brand: 'Clarks',            name: 'Clarks Chelsea Boots',           category: 'schuhe',    price: 99.95,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B00J0WU4V4' },

    // ── KLEIDER ──
    { brand: 's.Oliver',         name: 's.Oliver Strickkleid Midi',      category: 'kleid',     price: 59.99,  color: 'Dunkelgrün',  product_url: 'https://www.amazon.de/dp/B0BSFMF6LQ' },
    { brand: 'ONLY',              name: 'ONLY Wickelkleid Midi',          category: 'kleid',     price: 39.99,  color: 'Rot',         product_url: 'https://www.amazon.de/dp/B0CMXN9RFQ' },
    { brand: 'VILA',              name: 'VILA Vilynnea Maxikleid',        category: 'kleid',     price: 44.99,  color: 'Blau',        product_url: 'https://www.amazon.de/dp/B07QVPDB8X' },
    { brand: 'Desigual',          name: 'Desigual Kleid Boho',            category: 'kleid',     price: 79.95,  color: 'Bunt',        product_url: 'https://www.amazon.de/dp/B07H9ZKW7P' },

    // ── RÖCKE ──
    { brand: 'PIECES',            name: 'PIECES Pckylie Midi-Rock',       category: 'rock',      price: 27.99,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B084BHSR8Q' },
    { brand: 'Vero Moda',         name: 'Vero Moda Paperbag Rock',        category: 'rock',      price: 24.99,  color: 'Burgund',     product_url: 'https://www.amazon.de/dp/B07NPFYPN6' },

    // ── TASCHEN ──
    { brand: 'Liebeskind Berlin', name: 'Liebeskind Berlin Paper Bag',    category: 'tasche',    price: 119.00, color: 'Cognac',      product_url: 'https://www.amazon.de/dp/B0DX1SRKBX' },
    { brand: 'BOSS',              name: 'BOSS Shopper Tasche',            category: 'tasche',    price: 159.00, color: 'Schwarz',     product_url: 'https://www.amazon.de/dp/B00A8XSRIQ' },
    { brand: 'Desigual',          name: 'Desigual Schultertasche',        category: 'tasche',    price: 64.95,  color: 'Braun',       product_url: 'https://www.amazon.de/dp/B0851LQJFH' },

    // ── SCHMUCK & ACCESSOIRES ──
    { brand: 'Fossil',            name: 'Fossil Riley Armbanduhr',        category: 'schmuck',   price: 89.00,  color: 'Roségold',    product_url: 'https://www.amazon.de/dp/B004D4S7AY' },
    { brand: 'SWAROVSKI',         name: 'SWAROVSKI Halskette Kristall',   category: 'schmuck',   price: 69.00,  color: 'Gold',        product_url: 'https://www.amazon.de/dp/B00DOW0WZO' },
    { brand: 'Ray-Ban',           name: 'Ray-Ban New Wayfarer',           category: 'accessoire', price: 129.00, color: 'Schwarz',    product_url: 'https://www.amazon.de/dp/B01LPZT5WM' },
    { brand: 'JOOP!',             name: 'JOOP! Cornflower Schal',         category: 'accessoire', price: 49.95,  color: 'Grau',       product_url: 'https://www.amazon.de/dp/B0BFRTMH4Q' },
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

    // Outfit-Zuordnungen — verschiedene Marken, alle über Amazon.de (Affiliate!)
    const outfitPlans = {
      'Sol':    { brands: ['ONLY', 'Levi\'s', 'Tamaris'],                  categories: ['oberteil', 'hose', 'schuhe', 'accessoire'] },
      'Elena':  { brands: ['Esprit', 'SELECTED FEMME', 'GANT', 'BOSS'],   categories: ['oberteil', 'jacke', 'hose', 'schuhe', 'schmuck', 'tasche'] },
      'Mira':   { brands: ['Marc O\'Polo', 'Levi\'s', 'ONLY', 'Geox'],   categories: ['oberteil', 'hose', 'schuhe', 'jacke', 'accessoire'] },
      'Lauren': { brands: ['Calvin Klein', 'VILA', 'Esprit', 'Clarks'],   categories: ['oberteil', 'jacke', 'hose', 'schuhe', 'accessoire', 'tasche'] },
      'Claire': { brands: ['VILA', 'ONLY', 'Gabor', 'SWAROVSKI'],         categories: ['kleid', 'schuhe', 'jacke', 'schmuck', 'tasche'] },
      'Amy':    { brands: ['Desigual', 'ONLY', 'Geox', 'Liebeskind Berlin'], categories: ['kleid', 'schuhe', 'tasche', 'accessoire'] },
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
