/**
 * Seed-Daten: Erstellt Beispiel-Avatare, Anbieter und Artikel
 * zum Testen des Systems.
 *
 * Ausführen: npm run seed
 */

const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Datenbank initialisieren falls nötig
const { DB_PATH } = require('./db');
if (!fs.existsSync(DB_PATH)) {
  require('./init-db');
}

const db = getDb();

// ===== AVATARE =====
const avatars = [
  { name: 'Sophia', description: 'Eleganter Business-Stil', position_order: 1 },
  { name: 'Liam', description: 'Casual Streetwear', position_order: 2 },
  { name: 'Mia', description: 'Boho & Vintage', position_order: 3 },
  { name: 'Noah', description: 'Smart Casual', position_order: 4 },
  { name: 'Emma', description: 'Sportlich & Modern', position_order: 5 },
  { name: 'Felix', description: 'High Fashion', position_order: 6 },
];

const avatarIds = [];

const insertAvatar = db.prepare(`
  INSERT OR IGNORE INTO avatars (id, name, description, position_order)
  VALUES (?, ?, ?, ?)
`);

avatars.forEach(a => {
  const id = uuidv4();
  avatarIds.push(id);
  insertAvatar.run(id, a.name, a.description, a.position_order);
});

console.log(`✅ ${avatars.length} Avatare erstellt`);

// ===== ANBIETER =====
const providers = [
  { name: 'Zalando SE', brand_name: 'Zalando', website_url: 'https://www.zalando.ch' },
  { name: 'H&M Hennes & Mauritz', brand_name: 'H&M', website_url: 'https://www.hm.com/ch' },
  { name: 'ZARA Inditex', brand_name: 'ZARA', website_url: 'https://www.zara.com/ch' },
  { name: 'About You GmbH', brand_name: 'About You', website_url: 'https://www.aboutyou.ch' },
  { name: 'ASOS plc', brand_name: 'ASOS', website_url: 'https://www.asos.com' },
];

const providerIds = [];

const insertProvider = db.prepare(`
  INSERT OR IGNORE INTO providers (id, name, brand_name, website_url)
  VALUES (?, ?, ?, ?)
`);

providers.forEach(p => {
  const id = uuidv4();
  providerIds.push(id);
  insertProvider.run(id, p.name, p.brand_name, p.website_url);
});

console.log(`✅ ${providers.length} Anbieter erstellt`);

// ===== ARTIKEL =====
const articles = [
  // Zalando
  { provider: 0, name: 'Seidenbluse Ivory', category: 'oberteil', price: 89.90, color: '#f5f0e8', product_url: 'https://www.zalando.ch/seidenbluse' },
  { provider: 0, name: 'High-Waist Jeans Dark', category: 'hose', price: 69.90, color: '#1a1a2e', product_url: 'https://www.zalando.ch/highwaist-jeans' },
  { provider: 0, name: 'Ankle Boots Cognac', category: 'schuhe', price: 129.90, color: '#8b4513', product_url: 'https://www.zalando.ch/ankle-boots' },
  { provider: 0, name: 'Goldkette Filigran', category: 'schmuck', price: 39.90, color: '#c9a96e', product_url: 'https://www.zalando.ch/goldkette' },
  // H&M
  { provider: 1, name: 'Oversized Hoodie Grey', category: 'oberteil', price: 34.90, color: '#6b6b7a', product_url: 'https://www.hm.com/hoodie-grey' },
  { provider: 1, name: 'Cargo Pants Olive', category: 'hose', price: 49.90, color: '#4a5d3a', product_url: 'https://www.hm.com/cargo-olive' },
  { provider: 1, name: 'Chunky Sneakers White', category: 'schuhe', price: 44.90, color: '#f0f0f0', product_url: 'https://www.hm.com/sneakers-white' },
  { provider: 1, name: 'Bucket Hat Black', category: 'kopfbedeckung', price: 14.90, color: '#0a0a14', product_url: 'https://www.hm.com/bucket-hat' },
  // ZARA
  { provider: 2, name: 'Blazer Oversized Schwarz', category: 'jacke', price: 119.00, color: '#1a1a1a', product_url: 'https://www.zara.com/blazer' },
  { provider: 2, name: 'Wickelkleid Burgund', category: 'kleid', price: 79.90, color: '#8b4557', product_url: 'https://www.zara.com/wickelkleid' },
  { provider: 2, name: 'Loafers Schwarz', category: 'schuhe', price: 59.90, color: '#1a1a1a', product_url: 'https://www.zara.com/loafers' },
  { provider: 2, name: 'Midi-Rock Plissee', category: 'rock', price: 49.90, color: '#c9a96e', product_url: 'https://www.zara.com/midi-rock' },
  // About You
  { provider: 3, name: 'Boho-Bluse Weiss', category: 'oberteil', price: 45.90, color: '#f5f0e8', product_url: 'https://www.aboutyou.ch/boho-bluse' },
  { provider: 3, name: 'Leder-Handtasche Braun', category: 'tasche', price: 89.90, color: '#6b4423', product_url: 'https://www.aboutyou.ch/handtasche' },
  { provider: 3, name: 'Sonnenbrille Vintage', category: 'accessoire', price: 29.90, color: '#2c1810', product_url: 'https://www.aboutyou.ch/sonnenbrille' },
  // ASOS
  { provider: 4, name: 'Crop Top Neon', category: 'oberteil', price: 22.90, color: '#e74c3c', product_url: 'https://www.asos.com/crop-top' },
  { provider: 4, name: 'Jogginghose Track', category: 'hose', price: 39.90, color: '#2c2c3a', product_url: 'https://www.asos.com/jogginghose' },
  { provider: 4, name: 'Platform Sneakers', category: 'schuhe', price: 59.90, color: '#f0f0f0', product_url: 'https://www.asos.com/platform' },
];

const articleIds = [];

const insertArticle = db.prepare(`
  INSERT OR IGNORE INTO articles (id, provider_id, name, category, price, product_url, color)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

articles.forEach(a => {
  const id = uuidv4();
  articleIds.push(id);
  insertArticle.run(id, providerIds[a.provider], a.name, a.category, a.price, a.product_url, a.color || '');
});

console.log(`✅ ${articles.length} Artikel erstellt`);

// ===== OUTFITS FÜR HEUTE =====
const today = new Date().toISOString().split('T')[0];

const insertOutfit = db.prepare(`
  INSERT OR IGNORE INTO avatar_outfits (id, avatar_id, article_id, outfit_date, layer_order)
  VALUES (?, ?, ?, ?, ?)
`);

// Sophia: Eleganter Business-Look (Zalando + ZARA)
insertOutfit.run(uuidv4(), avatarIds[0], articleIds[0], today, 1);  // Seidenbluse
insertOutfit.run(uuidv4(), avatarIds[0], articleIds[1], today, 2);  // High-Waist Jeans
insertOutfit.run(uuidv4(), avatarIds[0], articleIds[2], today, 3);  // Ankle Boots
insertOutfit.run(uuidv4(), avatarIds[0], articleIds[3], today, 4);  // Goldkette

// Liam: Casual Streetwear (H&M)
insertOutfit.run(uuidv4(), avatarIds[1], articleIds[4], today, 1);  // Hoodie
insertOutfit.run(uuidv4(), avatarIds[1], articleIds[5], today, 2);  // Cargo Pants
insertOutfit.run(uuidv4(), avatarIds[1], articleIds[6], today, 3);  // Sneakers
insertOutfit.run(uuidv4(), avatarIds[1], articleIds[7], today, 4);  // Bucket Hat

// Mia: Boho (ZARA + About You)
insertOutfit.run(uuidv4(), avatarIds[2], articleIds[12], today, 1); // Boho-Bluse
insertOutfit.run(uuidv4(), avatarIds[2], articleIds[11], today, 2); // Midi-Rock
insertOutfit.run(uuidv4(), avatarIds[2], articleIds[10], today, 3); // Loafers
insertOutfit.run(uuidv4(), avatarIds[2], articleIds[13], today, 4); // Handtasche
insertOutfit.run(uuidv4(), avatarIds[2], articleIds[14], today, 5); // Sonnenbrille

// Noah: Smart Casual (ZARA + Zalando)
insertOutfit.run(uuidv4(), avatarIds[3], articleIds[8], today, 1);  // Blazer
insertOutfit.run(uuidv4(), avatarIds[3], articleIds[0], today, 2);  // Seidenbluse
insertOutfit.run(uuidv4(), avatarIds[3], articleIds[1], today, 3);  // Jeans
insertOutfit.run(uuidv4(), avatarIds[3], articleIds[10], today, 4); // Loafers

// Emma: Sportlich (ASOS + H&M)
insertOutfit.run(uuidv4(), avatarIds[4], articleIds[15], today, 1); // Crop Top
insertOutfit.run(uuidv4(), avatarIds[4], articleIds[16], today, 2); // Jogginghose
insertOutfit.run(uuidv4(), avatarIds[4], articleIds[17], today, 3); // Platform Sneakers

// Felix: High Fashion (ZARA)
insertOutfit.run(uuidv4(), avatarIds[5], articleIds[8], today, 1);  // Blazer
insertOutfit.run(uuidv4(), avatarIds[5], articleIds[9], today, 2);  // Wickelkleid
insertOutfit.run(uuidv4(), avatarIds[5], articleIds[2], today, 3);  // Ankle Boots
insertOutfit.run(uuidv4(), avatarIds[5], articleIds[3], today, 4);  // Goldkette

console.log(`✅ Outfits für ${today} erstellt`);
console.log('\n🎭 Seed-Daten erfolgreich geladen!');
console.log('   Starte den Server mit: npm start');
console.log('   Öffne den Catwalk: http://localhost:3000/catwalk');
