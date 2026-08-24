/**
 * Generation Pipeline
 *
 * Orchestriert den gesamten Prozess:
 * 1. Avatar-Basisbild + Kleidungsbilder einsammeln
 * 2. Virtual Try-On per Artikel durchführen (IDM-VTON)
 * 3. Optional: Walking-Animation generieren (SVD)
 * 4. Ergebnisse cachen und in DB speichern
 *
 * Kostengünstigstes Setup:
 *   IDM-VTON via Replicate: ~$0.01–0.03/Bild
 *   Gesamt 6 Avatare × 4 Artikel/Tag: ~$0.72–2.16/Tag ≈ $22–65/Monat
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createProvider, downloadImage, CONFIG } = require('./ai-provider');
const { getDb } = require('../db');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'generated');
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');

// Verzeichnisse sicherstellen
fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.mkdirSync(CACHE_DIR, { recursive: true });

// Aktive Generierungen tracken (Concurrency-Limit)
let activeGenerations = 0;
const generationQueue = [];

/**
 * Generierungs-Job in die Queue einreihen
 */
function enqueueGeneration(jobFn) {
  return new Promise((resolve, reject) => {
    generationQueue.push({ fn: jobFn, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (activeGenerations >= CONFIG.maxConcurrent || generationQueue.length === 0) return;

  activeGenerations++;
  const job = generationQueue.shift();

  try {
    const result = await job.fn();
    job.resolve(result);
  } catch (err) {
    job.reject(err);
  } finally {
    activeGenerations--;
    processQueue();
  }
}

/**
 * Cache-Key generieren für ein Outfit
 */
function getCacheKey(avatarId, articleIds, date) {
  const sorted = [...articleIds].sort().join('-');
  return `${avatarId}_${sorted}_${date}`;
}

/**
 * Prüfen ob ein generiertes Bild im Cache ist
 */
function checkCache(cacheKey) {
  const db = getDb();
  const cached = db.prepare(`
    SELECT * FROM generations
    WHERE cache_key = ? AND status = 'completed'
    AND datetime(created_at, '+' || ? || ' hours') > datetime('now')
  `).get(cacheKey, CONFIG.cacheHours);

  if (cached && cached.output_path) {
    const fullPath = path.join(__dirname, '..', '..', cached.output_path);
    if (fs.existsSync(fullPath)) {
      return cached;
    }
  }
  return null;
}

/**
 * Generierungs-Eintrag in DB erstellen
 */
function createGenerationRecord(avatarId, type, cacheKey) {
  const db = getDb();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO generations (id, avatar_id, type, cache_key, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `).run(id, avatarId, type, cacheKey);
  return id;
}

/**
 * Generierungs-Status aktualisieren
 */
function updateGeneration(id, updates) {
  const db = getDb();
  const fields = [];
  const values = [];

  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val);
  }
  values.push(id);

  db.prepare(`UPDATE generations SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

/**
 * ═══════════════════════════════════════════════════
 * HAUPTPIPELINE: Virtual Try-On für einen Avatar
 * ═══════════════════════════════════════════════════
 *
 * Nimmt Avatar-Basisbild + Kleidungs-Artikel und generiert
 * ein zusammengesetztes Outfit-Bild.
 *
 * Ablauf:
 * 1. Für jeden Artikel: Try-On API aufrufen
 * 2. Ergebnis als neues Basisbild für nächsten Layer verwenden
 * 3. Finales Bild speichern
 */
async function generateOutfitImage(avatarId, date) {
  const db = getDb();

  // Avatar und Outfit laden
  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) throw new Error('Avatar nicht gefunden');

  const outfit = db.prepare(`
    SELECT ao.*, a.name as article_name, a.category, a.image_url as article_image,
           a.product_url, p.brand_name
    FROM avatar_outfits ao
    JOIN articles a ON ao.article_id = a.id
    JOIN providers p ON a.provider_id = p.id
    WHERE ao.avatar_id = ? AND ao.outfit_date = ?
    ORDER BY ao.layer_order ASC
  `).all(avatarId, date);

  if (outfit.length === 0) {
    return { success: false, error: 'Kein Outfit für dieses Datum' };
  }

  // Cache prüfen
  const articleIds = outfit.map(o => o.article_id);
  const cacheKey = getCacheKey(avatarId, articleIds, date);
  const cached = checkCache(cacheKey);
  if (cached) {
    return {
      success: true,
      cached: true,
      outputUrl: '/' + cached.output_path,
      generationId: cached.id,
      cost: 0,
    };
  }

  // Provider erstellen
  const provider = createProvider();

  // Generierungs-Record
  const genId = createGenerationRecord(avatarId, 'tryon', cacheKey);
  updateGeneration(genId, { status: 'processing' });

  let totalCost = 0;

  try {
    // Startbild: Avatar-Basisbild
    let currentImageUrl = avatar.image_url;

    if (!currentImageUrl) {
      // Kein Basisbild → Generierung nicht möglich mit Try-On
      // Stattdessen: Ergebnis als "nur Daten" markieren
      updateGeneration(genId, {
        status: 'completed',
        output_path: '',
        cost: 0,
        metadata: JSON.stringify({
          note: 'Kein Avatar-Basisbild. Lade ein Bild hoch oder nutze die CSS-Darstellung.',
          articles: outfit.map(o => ({
            name: o.article_name,
            category: o.category,
            brand: o.brand_name,
          })),
        }),
      });

      return {
        success: true,
        noBaseImage: true,
        generationId: genId,
        message: 'Kein Avatar-Basisbild vorhanden. Lade ein Ganzkörper-Foto hoch, um Virtual Try-On zu nutzen.',
      };
    }

    // Artikel nach Kategorie sortieren (Kleidung layered auftragen)
    const layerOrder = ['kleid', 'hose', 'rock', 'oberteil', 'jacke'];
    const clothingItems = outfit.filter(o => layerOrder.includes(o.category));
    const otherItems = outfit.filter(o => !layerOrder.includes(o.category));

    // Sortierte Kleidung
    clothingItems.sort((a, b) =>
      layerOrder.indexOf(a.category) - layerOrder.indexOf(b.category)
    );

    // Try-On für jeden Kleidungsartikel durchführen
    for (const item of clothingItems) {
      if (!item.article_image) {
        console.log(`⏭ Überspringe ${item.article_name}: Kein Artikelbild`);
        continue;
      }

      console.log(`🎨 Try-On: ${item.article_name} (${item.category})`);

      const result = await enqueueGeneration(async () => {
        return provider.virtualTryOn({
          avatarImageUrl: currentImageUrl,
          garmentImageUrl: item.article_image,
          category: item.category,
        });
      });

      if (result.success) {
        // Ergebnis-Bild als neues Basisbild verwenden
        const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

        // Bild herunterladen und lokal speichern
        const filename = `tryon_${genId}_${item.category}_${Date.now()}.png`;
        const localPath = path.join(GENERATED_DIR, filename);
        await downloadImage(outputUrl, localPath);

        // Für nächsten Layer: lokales Bild als URL verwenden
        currentImageUrl = outputUrl; // Replicate-URL bleibt temporär gültig

        totalCost += result.cost || 0;
        console.log(`  ✅ Fertig (${result.cost ? '$' + result.cost.toFixed(4) : 'n/a'})`);
      } else {
        console.log(`  ❌ Fehler: ${result.error}`);
      }
    }

    // Finales Bild speichern
    const finalFilename = `outfit_${avatarId}_${date.replace(/-/g, '')}.png`;
    const finalPath = path.join(GENERATED_DIR, finalFilename);
    const relativePath = `public/generated/${finalFilename}`;

    if (currentImageUrl !== avatar.image_url) {
      // Wir haben mindestens ein Try-On-Bild
      await downloadImage(currentImageUrl, finalPath);
    }

    updateGeneration(genId, {
      status: 'completed',
      output_path: relativePath,
      cost: totalCost,
      metadata: JSON.stringify({
        articles_processed: clothingItems.length,
        articles_skipped: clothingItems.filter(i => !i.article_image).length,
        accessories: otherItems.map(o => o.article_name),
      }),
    });

    return {
      success: true,
      outputUrl: `/generated/${finalFilename}`,
      generationId: genId,
      cost: totalCost,
      articlesProcessed: clothingItems.length,
    };

  } catch (err) {
    updateGeneration(genId, {
      status: 'failed',
      error_message: err.message,
    });

    return {
      success: false,
      error: err.message,
      generationId: genId,
    };
  }
}

/**
 * Walking-Animation für einen Avatar generieren
 */
async function generateWalkAnimation(avatarId, date) {
  const db = getDb();

  // Zuerst: fertiges Outfit-Bild finden oder generieren
  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) throw new Error('Avatar nicht gefunden');

  // Prüfen ob ein Outfit-Bild existiert
  const existingGen = db.prepare(`
    SELECT * FROM generations
    WHERE avatar_id = ? AND type = 'tryon' AND status = 'completed'
    AND output_path != ''
    ORDER BY created_at DESC LIMIT 1
  `).get(avatarId);

  let sourceImageUrl;

  if (existingGen && existingGen.output_path) {
    const fullPath = path.join(__dirname, '..', '..', existingGen.output_path);
    if (fs.existsSync(fullPath)) {
      // Lokales Bild als URL für Video-Generierung verwenden
      sourceImageUrl = avatar.image_url; // Fallback: original
    }
  }

  if (!sourceImageUrl && avatar.image_url) {
    sourceImageUrl = avatar.image_url;
  }

  if (!sourceImageUrl) {
    return {
      success: false,
      error: 'Kein Bild für Animation vorhanden. Erstelle zuerst ein Outfit-Bild.',
    };
  }

  const cacheKey = `walk_${avatarId}_${date}`;
  const cached = checkCache(cacheKey);
  if (cached) {
    return {
      success: true,
      cached: true,
      outputUrl: '/' + cached.output_path,
      generationId: cached.id,
      cost: 0,
    };
  }

  const genId = createGenerationRecord(avatarId, 'walk_animation', cacheKey);
  updateGeneration(genId, { status: 'processing' });

  try {
    const provider = createProvider();
    const result = await enqueueGeneration(async () => {
      return provider.generateWalkAnimation({
        imageUrl: sourceImageUrl,
        motionStrength: 40,
      });
    });

    if (result.success) {
      const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;
      const filename = `walk_${avatarId}_${date.replace(/-/g, '')}.mp4`;
      const localPath = path.join(GENERATED_DIR, filename);
      const relativePath = `public/generated/${filename}`;

      await downloadImage(outputUrl, localPath);

      updateGeneration(genId, {
        status: 'completed',
        output_path: relativePath,
        cost: result.cost || 0,
      });

      return {
        success: true,
        outputUrl: `/generated/${filename}`,
        generationId: genId,
        cost: result.cost || 0,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    updateGeneration(genId, {
      status: 'failed',
      error_message: err.message,
    });
    return { success: false, error: err.message, generationId: genId };
  }
}

/**
 * Alle Avatare für ein Datum generieren (Batch)
 */
async function generateAllOutfits(date) {
  const db = getDb();
  const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();
  const results = [];

  for (const avatar of avatars) {
    try {
      const result = await generateOutfitImage(avatar.id, date);
      results.push({ avatarId: avatar.id, name: avatar.name, ...result });
    } catch (err) {
      results.push({ avatarId: avatar.id, name: avatar.name, success: false, error: err.message });
    }
  }

  const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
  return { results, totalCost, date };
}

/**
 * Generierungs-Historie abrufen
 */
function getGenerationHistory(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT g.*, a.name as avatar_name
    FROM generations g
    JOIN avatars a ON g.avatar_id = a.id
    ORDER BY g.created_at DESC
    LIMIT ?
  `).all(limit);
}

/**
 * Kosten-Zusammenfassung
 */
function getCostSummary(days = 30) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_generations,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(AVG(cost), 0) as avg_cost
    FROM generations
    WHERE created_at >= ?
  `).get(since.toISOString());

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count, COALESCE(SUM(cost), 0) as cost
    FROM generations
    WHERE created_at >= ?
    GROUP BY type
  `).all(since.toISOString());

  const byDay = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as count, COALESCE(SUM(cost), 0) as cost
    FROM generations
    WHERE created_at >= ?
    GROUP BY date(created_at)
    ORDER BY day DESC
  `).all(since.toISOString());

  return { ...summary, byType, byDay, periodDays: days };
}

module.exports = {
  generateOutfitImage,
  generateWalkAnimation,
  generateAllOutfits,
  getGenerationHistory,
  getCostSummary,
};
