const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../db');

const router = express.Router();

/**
 * Social-Media-Export API
 *
 * Generiert fertige Inhalte für Instagram Reels/Stories und TikTok:
 * - Video-Dateipfade (bereits 9:16, perfekt für Reels/TikTok)
 * - Captions mit Hashtags in der gewählten Sprache
 * - Amazon-Affiliate-Links für "Link in Bio"
 * - Batch-Export aller Models oder einzeln
 */

// ═══════════════════════════════════════════════════
// CAPTION-TEMPLATES PRO SPRACHE
// ═══════════════════════════════════════════════════

const CAPTION_TEMPLATES = {
  de: {
    single: (name, brands, price, hashtags) =>
      `✨ ${name} auf dem Laufsteg! ✨\n\n` +
      `Look by ${brands}\n` +
      `💰 Gesamter Look: ${price}\n\n` +
      `🛒 Link in Bio für alle Produkte!\n\n` +
      `${hashtags}`,
    collection: (count, hashtags) =>
      `🔥 Fashion Show — ${count} neue Looks! 🔥\n\n` +
      `Unsere Models präsentieren die heißesten Outfits.\n` +
      `Welcher Look gefällt dir am besten? 👇\n\n` +
      `🛒 Alle Produkte: Link in Bio!\n\n` +
      `${hashtags}`,
  },
  en: {
    single: (name, brands, price, hashtags) =>
      `✨ ${name} on the runway! ✨\n\n` +
      `Look by ${brands}\n` +
      `💰 Full look: ${price}\n\n` +
      `🛒 Link in bio for all products!\n\n` +
      `${hashtags}`,
    collection: (count, hashtags) =>
      `🔥 Fashion Show — ${count} new looks! 🔥\n\n` +
      `Our models present the hottest outfits.\n` +
      `Which look is your favorite? 👇\n\n` +
      `🛒 All products: Link in bio!\n\n` +
      `${hashtags}`,
  },
  fr: {
    single: (name, brands, price, hashtags) =>
      `✨ ${name} sur le podium ! ✨\n\n` +
      `Look par ${brands}\n` +
      `💰 Look complet : ${price}\n\n` +
      `🛒 Lien en bio pour tous les produits !\n\n` +
      `${hashtags}`,
    collection: (count, hashtags) =>
      `🔥 Défilé de mode — ${count} nouveaux looks ! 🔥\n\n` +
      `Nos mannequins présentent les tenues les plus tendance.\n` +
      `Quel look préférez-vous ? 👇\n\n` +
      `🛒 Tous les produits : lien en bio !\n\n` +
      `${hashtags}`,
  },
  es: {
    single: (name, brands, price, hashtags) =>
      `✨ ${name} en la pasarela! ✨\n\n` +
      `Look de ${brands}\n` +
      `💰 Look completo: ${price}\n\n` +
      `🛒 ¡Link en bio para todos los productos!\n\n` +
      `${hashtags}`,
    collection: (count, hashtags) =>
      `🔥 Desfile de moda — ${count} nuevos looks! 🔥\n\n` +
      `Nuestras modelos presentan los outfits más hot.\n` +
      `¿Cuál es tu favorito? 👇\n\n` +
      `🛒 Todos los productos: ¡link en bio!\n\n` +
      `${hashtags}`,
  },
  it: {
    single: (name, brands, price, hashtags) =>
      `✨ ${name} in passerella! ✨\n\n` +
      `Look di ${brands}\n` +
      `💰 Look completo: ${price}\n\n` +
      `🛒 Link in bio per tutti i prodotti!\n\n` +
      `${hashtags}`,
    collection: (count, hashtags) =>
      `🔥 Sfilata di moda — ${count} nuovi look! 🔥\n\n` +
      `Le nostre modelle presentano gli outfit più trendy.\n` +
      `Qual è il tuo preferito? 👇\n\n` +
      `🛒 Tutti i prodotti: link in bio!\n\n` +
      `${hashtags}`,
  },
};

// Hashtag-Sets
const HASHTAGS = {
  general: '#FashionShow #Catwalk #OOTD #FashionWeek #Runway #Style #FashionModel #OutfitOfTheDay #FashionInspo #ShopTheLook',
  instagram: '#InstaFashion #Reels #FashionReels #StyleInspo #WhatIWore #FashionBlogger #StreetStyle #LookOfTheDay',
  tiktok: '#FashionTok #StyleTok #OutfitInspo #GRWM #FashionHaul #TrendAlert #ViralFashion #FYP',
};

// ═══════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════

/**
 * GET /api/social/export
 *
 * Exportiert alle Models mit Videos, Captions und Links.
 * Query-Parameter:
 *   ?lang=de        Sprache (de, en, fr, es, it)  — Standard: de
 *   ?platform=all   Plattform (instagram, tiktok, all) — Standard: all
 *   ?avatar=NAME    Einzelnes Model exportieren (optional)
 */
router.get('/export', (req, res) => {
  const db = getDb();
  const lang = req.query.lang || 'de';
  const platform = req.query.platform || 'all';
  const avatarFilter = req.query.avatar;
  const date = req.query.date || new Date().toISOString().split('T')[0];

  const templates = CAPTION_TEMPLATES[lang] || CAPTION_TEMPLATES.en;

  // Avatare mit Outfits laden
  let avatars = db.prepare(`
    SELECT * FROM avatars WHERE is_active = 1 ORDER BY position_order ASC
  `).all();

  if (avatarFilter) {
    avatars = avatars.filter(a => a.name.toLowerCase() === avatarFilter.toLowerCase());
  }

  const exports = avatars.map(avatar => {
    // Outfit laden
    const outfit = db.prepare(`
      SELECT ao.layer_order,
             a.name as article_name, a.category, a.price, a.currency,
             a.product_url, a.color,
             p.brand_name
      FROM avatar_outfits ao
      JOIN articles a ON ao.article_id = a.id
      JOIN providers p ON a.provider_id = p.id
      WHERE ao.avatar_id = ? AND ao.outfit_date = ?
      ORDER BY ao.layer_order ASC
    `).all(avatar.id, date);

    const totalPrice = outfit.reduce((sum, i) => sum + i.price, 0);
    const brands = [...new Set(outfit.map(i => i.brand_name))].join(' × ');
    const priceStr = `€${totalPrice.toFixed(2)}`;

    // Video-Pfad
    let videoPath = null;
    try {
      const gen = db.prepare(`
        SELECT output_path FROM generations
        WHERE avatar_id = ? AND type = 'walk_animation' AND status = 'completed'
        AND output_path != ''
        ORDER BY created_at DESC LIMIT 1
      `).get(avatar.id);
      if (gen) videoPath = gen.output_path;
    } catch (e) { /* ignore */ }

    // Bild-Pfad
    let imagePath = null;
    try {
      const gen = db.prepare(`
        SELECT output_path FROM generations
        WHERE avatar_id = ? AND type IN ('tryon', 'img2img') AND status = 'completed'
        AND output_path != ''
        ORDER BY created_at DESC LIMIT 1
      `).get(avatar.id);
      if (gen) imagePath = gen.output_path;
      if (!imagePath && avatar.image_url) imagePath = avatar.image_url;
    } catch (e) { /* ignore */ }

    // Hashtags zusammenstellen
    let hashtags = HASHTAGS.general;
    if (platform === 'instagram' || platform === 'all') {
      hashtags += '\n' + HASHTAGS.instagram;
    }
    if (platform === 'tiktok' || platform === 'all') {
      hashtags += '\n' + HASHTAGS.tiktok;
    }
    // Marken-Hashtags
    outfit.forEach(i => {
      const tag = '#' + i.brand_name.replace(/[^a-zA-Z0-9äöüÄÖÜ]/g, '');
      if (!hashtags.includes(tag)) hashtags += ' ' + tag;
    });

    // Caption generieren
    const caption = templates.single(avatar.name, brands, priceStr, hashtags);

    // Produkt-Links
    const productLinks = outfit.map(i => ({
      name: i.article_name,
      brand: i.brand_name,
      price: `€${i.price.toFixed(2)}`,
      url: i.product_url,
      category: i.category,
    }));

    return {
      model: avatar.name,
      style: avatar.description,
      video: videoPath,
      image: imagePath,
      hasVideo: !!videoPath,
      caption,
      products: productLinks,
      totalPrice: priceStr,
      brands,
      // Plattform-spezifische Tipps
      tips: {
        instagram: {
          format: 'Reel (9:16 vertikal)',
          maxLength: '90 Sekunden',
          note: 'Video direkt als Reel hochladen. Audio/Musik in Instagram hinzufügen.',
        },
        tiktok: {
          format: '9:16 vertikal',
          maxLength: '60 Sekunden',
          note: 'Video direkt hochladen. Trending Sound in TikTok hinzufügen.',
        },
      },
    };
  });

  // Collection-Caption (für Carousel/Slideshow)
  const collectionCaption = templates.collection(
    exports.length,
    HASHTAGS.general + '\n' + HASHTAGS.instagram + '\n' + HASHTAGS.tiktok
  );

  res.json({
    date,
    language: lang,
    platform,
    totalModels: exports.length,
    modelsWithVideo: exports.filter(e => e.hasVideo).length,
    collectionCaption,
    models: exports,
    linkInBio: `/linkinbio`,
    instructions: {
      instagram: [
        '1. Video aus dem Ordner public/generated/ auf dein Handy übertragen',
        '2. Instagram öffnen → Reel erstellen → Video auswählen',
        '3. Musik/Audio hinzufügen (Trending Sound empfohlen)',
        '4. Caption aus dem Export einfügen',
        '5. Link in Bio auf deine Catwalk-Seite setzen',
      ],
      tiktok: [
        '1. Video aus dem Ordner public/generated/ auf dein Handy übertragen',
        '2. TikTok öffnen → + → Video hochladen',
        '3. Trending Sound hinzufügen',
        '4. Caption aus dem Export einfügen',
        '5. Link in Bio auf deine Catwalk-Seite setzen',
      ],
    },
  });
});

/**
 * GET /api/social/copy-caption/:name
 * Gibt nur die Caption für ein bestimmtes Model zurück (zum Kopieren).
 */
router.get('/copy-caption/:name', (req, res) => {
  const db = getDb();
  const lang = req.query.lang || 'de';
  const platform = req.query.platform || 'all';
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const templates = CAPTION_TEMPLATES[lang] || CAPTION_TEMPLATES.en;

  const avatar = db.prepare(`
    SELECT * FROM avatars WHERE LOWER(name) = LOWER(?) AND is_active = 1
  `).get(req.params.name);

  if (!avatar) return res.status(404).json({ error: 'Model nicht gefunden' });

  const outfit = db.prepare(`
    SELECT a.name as article_name, a.price, a.product_url, p.brand_name
    FROM avatar_outfits ao
    JOIN articles a ON ao.article_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ao.avatar_id = ? AND ao.outfit_date = ?
    ORDER BY ao.layer_order ASC
  `).all(avatar.id, date);

  const totalPrice = outfit.reduce((s, i) => s + i.price, 0);
  const brands = [...new Set(outfit.map(i => i.brand_name))].join(' × ');

  let hashtags = HASHTAGS.general;
  if (platform !== 'tiktok') hashtags += '\n' + HASHTAGS.instagram;
  if (platform !== 'instagram') hashtags += '\n' + HASHTAGS.tiktok;

  const caption = templates.single(avatar.name, brands, `€${totalPrice.toFixed(2)}`, hashtags);

  res.type('text/plain').send(caption);
});

module.exports = router;
