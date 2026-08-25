/**
 * Generation Pipeline
 *
 * Orchestriert den gesamten Prozess:
 * 1. Avatar-Basisbild generieren (Flux 1.1 Pro)
 * 2. Virtual Try-On per Artikel (IDM-VTON)
 * 3. Walking-Animation generieren (Minimax Video-01)
 * 4. Ergebnisse cachen und in DB speichern
 *
 * Kosten-Übersicht:
 *   Avatar-Bild:     Flux 1.1 Pro        ~$0.03–0.05/Bild
 *   Virtual Try-On:  IDM-VTON            ~$0.01–0.03/Bild
 *   Walk-Video:      Minimax Video-01    ~$0.10–0.20/Video
 *   ─────────────────────────────────────────────────────
 *   Komplett pro Avatar (Bild + Try-On + Video): ~$0.15–0.30
 *   6 Avatare/Tag:   ~$0.90–1.80/Tag ≈ $27–54/Monat
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createProvider, downloadImage, buildAvatarPrompt, buildWalkPrompt, CONFIG } = require('./ai-provider');
const { getDb } = require('../db');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'generated');
const CACHE_DIR = path.join(__dirname, '..', '..', 'data', 'cache');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

/**
 * Lokales Bild in Base64 Data-URI umwandeln.
 * Replicate braucht eine URL – lokale Dateien werden als data:image/... gesendet.
 */
function localImageToDataUri(localPath) {
  // Relativen Pfad auflösen (z.B. "/generated/avatar_xxx.png")
  let fullPath = localPath;
  if (localPath.startsWith('/generated/') || localPath.startsWith('generated/')) {
    fullPath = path.join(PUBLIC_DIR, localPath.startsWith('/') ? localPath.slice(1) : localPath);
  } else if (localPath.startsWith('public/')) {
    fullPath = path.join(__dirname, '..', '..', localPath);
  }

  if (!fs.existsSync(fullPath)) return null;

  const buffer = fs.readFileSync(fullPath);
  const ext = path.extname(fullPath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

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
 * Cache-Key generieren
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

// ═══════════════════════════════════════════════════
// SCHRITT 1: Avatar-Basisbild generieren
// ═══════════════════════════════════════════════════

/**
 * Generiert ein fotorealistisches Ganzkörper-Model-Foto
 * für einen Avatar. Das Bild zeigt die Person in neutraler
 * Kleidung (weißes T-Shirt + dunkle Jeans), damit der
 * Virtual Try-On die eigentliche Mode auftragen kann.
 *
 * Kosten: ~$0.03–0.05 pro Bild (Flux 1.1 Pro)
 */
async function generateAvatarBaseImage(avatarId) {
  const db = getDb();

  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) throw new Error('Avatar nicht gefunden');

  // Cache prüfen: existiert bereits ein Basisbild?
  const cacheKey = `avatar_base_${avatarId}`;
  const cached = checkCache(cacheKey);
  if (cached) {
    return {
      success: true,
      cached: true,
      outputUrl: '/' + cached.output_path.replace(/^public\//, ''),
      generationId: cached.id,
      cost: 0,
    };
  }

  const provider = createProvider();
  const prompt = buildAvatarPrompt(avatar);

  console.log(`\n🎨 Generiere Avatar-Basisbild für "${avatar.name}"...`);
  console.log(`   Modell: ${CONFIG.replicate.avatarModel}`);
  console.log(`   Prompt (vollständig): ${prompt}`);
  console.log(`   ✅ Enthält "woman": ${prompt.includes('woman') ? 'JA' : '⚠️ NEIN!'}`);
  console.log(`   ✅ Enthält "man" (ohne woman): ${prompt.includes(' man,') || prompt.includes(' man ') ? '⚠️ JA!' : 'NEIN'}`);


  const genId = createGenerationRecord(avatarId, 'img2img', cacheKey);
  updateGeneration(genId, { status: 'processing' });

  try {
    const result = await enqueueGeneration(async () => {
      return provider.generateAvatarImage({ prompt });
    });

    if (result.success) {
      const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

      // Bild herunterladen und lokal speichern
      // Zeitstempel im Dateinamen verhindert Browser-Caching komplett
      const timestamp = Date.now();
      const filename = `avatar_${avatarId}_base_${timestamp}.png`;
      const localPath = path.join(GENERATED_DIR, filename);
      const relativePath = `public/generated/${filename}`;

      // Alte Bilder dieses Avatars löschen
      try {
        const oldFiles = fs.readdirSync(GENERATED_DIR)
          .filter(f => f.startsWith(`avatar_${avatarId}_base`) && f.endsWith('.png'));
        for (const oldFile of oldFiles) {
          if (oldFile !== filename) {
            fs.unlinkSync(path.join(GENERATED_DIR, oldFile));
          }
        }
      } catch (e) { /* ignore cleanup errors */ }

      await downloadImage(outputUrl, localPath);

      // Avatar-Tabelle mit dem neuen Bild aktualisieren
      const publicUrl = `/generated/${filename}`;
      db.prepare('UPDATE avatars SET image_url = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run(publicUrl, avatarId);

      updateGeneration(genId, {
        status: 'completed',
        output_path: relativePath,
        cost: result.cost || 0.04,
        metadata: JSON.stringify({
          model: CONFIG.replicate.avatarModel,
          prompt: prompt,
        }),
      });

      console.log(`   ✅ Avatar-Bild gespeichert: ${publicUrl}`);
      console.log(`   💰 Kosten: $${(result.cost || 0.04).toFixed(4)}`);

      return {
        success: true,
        outputUrl: publicUrl,
        generationId: genId,
        cost: result.cost || 0.04,
        avatarName: avatar.name,
      };
    } else {
      throw new Error(result.error || 'Avatar-Generierung fehlgeschlagen');
    }
  } catch (err) {
    updateGeneration(genId, {
      status: 'failed',
      error_message: err.message,
    });
    console.log(`   ❌ Fehler: ${err.message}`);
    return { success: false, error: err.message, generationId: genId };
  }
}

/**
 * Avatar-Basisbilder für ALLE Avatare generieren
 */
async function generateAllAvatarImages() {
  const db = getDb();
  const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();
  const results = [];

  console.log(`\n🎭 Generiere Basisbilder für ${avatars.length} Avatare...\n`);

  for (const avatar of avatars) {
    // Nur generieren wenn noch kein Bild vorhanden
    if (avatar.image_url && !avatar.image_url.includes('placeholder')) {
      console.log(`⏭ ${avatar.name}: Basisbild existiert bereits`);
      results.push({
        avatarId: avatar.id,
        name: avatar.name,
        success: true,
        skipped: true,
        outputUrl: avatar.image_url,
      });
      continue;
    }

    const result = await generateAvatarBaseImage(avatar.id);
    results.push({ avatarId: avatar.id, name: avatar.name, ...result });

    // 15 Sekunden warten um Rate-Limits zu vermeiden
    if (avatars.indexOf(avatar) < avatars.length - 1) {
      console.log('   ⏳ Warte 15 Sekunden (Rate-Limit)...');
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }

  const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
  console.log(`\n✅ Fertig! Gesamtkosten: $${totalCost.toFixed(4)}`);

  return { results, totalCost };
}

// ═══════════════════════════════════════════════════
// SCHRITT 2: Virtual Try-On (Outfit auftragen)
// ═══════════════════════════════════════════════════

/**
 * Nimmt Avatar-Basisbild + Kleidungs-Artikel und generiert
 * ein zusammengesetztes Outfit-Bild.
 */
async function generateOutfitImage(avatarId, date) {
  const db = getDb();

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
      outputUrl: '/' + cached.output_path.replace(/^public\//, ''),
      generationId: cached.id,
      cost: 0,
    };
  }

  const provider = createProvider();
  const genId = createGenerationRecord(avatarId, 'tryon', cacheKey);
  updateGeneration(genId, { status: 'processing' });

  let totalCost = 0;

  try {
    let currentImageUrl = avatar.image_url;

    if (!currentImageUrl) {
      // Kein Basisbild → Zuerst eines generieren
      console.log(`⚠️ ${avatar.name}: Kein Basisbild. Generiere zuerst...`);
      const avatarResult = await generateAvatarBaseImage(avatarId);

      if (avatarResult.success && avatarResult.outputUrl) {
        currentImageUrl = avatarResult.outputUrl;
        totalCost += avatarResult.cost || 0;

        // Frisch aus DB laden (hat jetzt image_url)
        const refreshed = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
        currentImageUrl = refreshed.image_url;
      } else {
        updateGeneration(genId, {
          status: 'completed',
          output_path: '',
          cost: 0,
          metadata: JSON.stringify({
            note: 'Kein Avatar-Basisbild. Generiere zuerst ein Basisbild.',
          }),
        });
        return {
          success: false,
          noBaseImage: true,
          generationId: genId,
          message: 'Kein Avatar-Basisbild vorhanden. Klicke "Avatar-Bild generieren" um eines zu erstellen.',
        };
      }
    }

    // Artikel nach Kategorie sortieren (Kleidung layered auftragen)
    const layerOrder = ['kleid', 'hose', 'rock', 'oberteil', 'jacke'];
    const clothingItems = outfit.filter(o => layerOrder.includes(o.category));
    const otherItems = outfit.filter(o => !layerOrder.includes(o.category));

    clothingItems.sort((a, b) =>
      layerOrder.indexOf(a.category) - layerOrder.indexOf(b.category)
    );

    console.log(`\n👗 Try-On für ${avatar.name}: ${clothingItems.length} Kleidungsstücke`);

    // Avatar-Bild als Data-URI für Replicate vorbereiten
    const avatarDataUri = localImageToDataUri(currentImageUrl);
    if (avatarDataUri) currentImageUrl = avatarDataUri;

    // Try-On für jeden Kleidungsartikel
    for (const item of clothingItems) {
      if (!item.article_image) {
        console.log(`  ⏭ Überspringe ${item.article_name}: Kein Artikelbild`);
        continue;
      }

      console.log(`  🎨 ${item.article_name} (${item.category})...`);

      const result = await enqueueGeneration(async () => {
        return provider.virtualTryOn({
          avatarImageUrl: currentImageUrl,
          garmentImageUrl: item.article_image,
          category: item.category,
        });
      });

      if (result.success) {
        const outputUrl = Array.isArray(result.output) ? result.output[0] : result.output;

        const filename = `tryon_${genId}_${item.category}_${Date.now()}.png`;
        const localPath = path.join(GENERATED_DIR, filename);
        await downloadImage(outputUrl, localPath);

        currentImageUrl = outputUrl;
        totalCost += result.cost || 0;
        console.log(`    ✅ Fertig ($${(result.cost || 0).toFixed(4)})`);
      } else {
        console.log(`    ❌ Fehler: ${result.error}`);
      }
    }

    // Finales Bild speichern
    const finalFilename = `outfit_${avatarId}_${date.replace(/-/g, '')}.png`;
    const finalPath = path.join(GENERATED_DIR, finalFilename);
    const relativePath = `public/generated/${finalFilename}`;

    if (currentImageUrl !== avatar.image_url) {
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
    return { success: false, error: err.message, generationId: genId };
  }
}

// ═══════════════════════════════════════════════════
// SCHRITT 3: Walking-Video generieren
// ═══════════════════════════════════════════════════

/**
 * Generiert eine Walking-Animation aus dem Outfit-Bild.
 * Verwendet Minimax Video-01 für hochwertige Videos.
 *
 * Kosten: ~$0.10–0.20 pro Video (Minimax)
 */
async function generateWalkAnimation(avatarId, date) {
  const db = getDb();

  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) throw new Error('Avatar nicht gefunden');

  // Bild suchen: Zuerst Try-On-Bild, dann Avatar-Basisbild
  let sourceImageUrl;
  let sourceLocalPath;

  // 1. Fertiges Outfit-Bild (Try-On)?
  const existingGen = db.prepare(`
    SELECT * FROM generations
    WHERE avatar_id = ? AND type = 'tryon' AND status = 'completed'
    AND output_path != ''
    ORDER BY created_at DESC LIMIT 1
  `).get(avatarId);

  if (existingGen && existingGen.output_path) {
    const fullPath = path.join(__dirname, '..', '..', existingGen.output_path);
    if (fs.existsSync(fullPath)) {
      sourceLocalPath = existingGen.output_path;
    }
  }

  // 2. Fallback: Avatar-Basisbild
  if (!sourceLocalPath && avatar.image_url) {
    sourceLocalPath = avatar.image_url;
  }

  if (!sourceLocalPath) {
    return {
      success: false,
      error: 'Kein Bild vorhanden. Erstelle zuerst ein Avatar-Basisbild und/oder Outfit-Bild.',
    };
  }

  // Lokales Bild zu Base64 Data-URI konvertieren (Replicate braucht eine URL)
  sourceImageUrl = localImageToDataUri(sourceLocalPath);
  if (!sourceImageUrl) {
    // Falls lokal nicht gefunden, als URL versuchen (externe Bilder)
    sourceImageUrl = sourceLocalPath.startsWith('http') ? sourceLocalPath : null;
  }

  if (!sourceImageUrl) {
    return {
      success: false,
      error: 'Bild-Datei nicht gefunden. Bitte Avatar-Basisbild neu generieren.',
    };
  }

  // Cache prüfen
  const cacheKey = `walk_${avatarId}_${date}`;
  const cached = checkCache(cacheKey);
  if (cached) {
    return {
      success: true,
      cached: true,
      outputUrl: '/' + cached.output_path.replace(/^public\//, ''),
      generationId: cached.id,
      cost: 0,
    };
  }

  console.log(`\n🎬 Generiere Walking-Video für "${avatar.name}"...`);
  console.log(`   Modell: ${CONFIG.replicate.videoModel}`);

  const genId = createGenerationRecord(avatarId, 'walk_animation', cacheKey);
  updateGeneration(genId, { status: 'processing' });

  try {
    const provider = createProvider();
    const walkPrompt = buildWalkPrompt(avatar);

    const result = await enqueueGeneration(async () => {
      return provider.generateWalkAnimation({
        imageUrl: sourceImageUrl,
        prompt: walkPrompt,
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
        cost: result.cost || 0.15,
      });

      console.log(`   ✅ Video gespeichert: /generated/${filename}`);
      console.log(`   💰 Kosten: $${(result.cost || 0.15).toFixed(4)}`);

      return {
        success: true,
        outputUrl: `/generated/${filename}`,
        generationId: genId,
        cost: result.cost || 0.15,
      };
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    updateGeneration(genId, {
      status: 'failed',
      error_message: err.message,
    });
    console.log(`   ❌ Fehler: ${err.message}`);
    return { success: false, error: err.message, generationId: genId };
  }
}

// ═══════════════════════════════════════════════════
// KOMPLETT-PIPELINE: Alles in einem Schritt
// ═══════════════════════════════════════════════════

/**
 * Führt die komplette Pipeline für einen Avatar aus:
 * 1. Avatar-Basisbild generieren (falls nötig)
 * 2. Outfit via Try-On anziehen
 * 3. Walking-Video generieren
 *
 * Geschätzte Kosten: ~$0.15–0.30 pro Avatar
 */
async function generateFullPipeline(avatarId, date) {
  const db = getDb();
  const avatar = db.prepare('SELECT * FROM avatars WHERE id = ?').get(avatarId);
  if (!avatar) throw new Error('Avatar nicht gefunden');

  const results = {
    avatar: avatar.name,
    steps: [],
    totalCost: 0,
    success: true,
  };

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`🎭 KOMPLETT-PIPELINE: ${avatar.name}`);
  console.log(`${'═'.repeat(50)}`);

  // Schritt 1: Avatar-Basisbild
  if (!avatar.image_url) {
    console.log('\n📸 Schritt 1/3: Avatar-Basisbild generieren...');
    const avatarResult = await generateAvatarBaseImage(avatarId);
    results.steps.push({ step: 'avatar_image', ...avatarResult });
    results.totalCost += avatarResult.cost || 0;
    if (!avatarResult.success) {
      results.success = false;
      return results;
    }
  } else {
    console.log('\n📸 Schritt 1/3: Avatar-Basisbild vorhanden ✅');
    results.steps.push({ step: 'avatar_image', success: true, skipped: true });
  }

  // Schritt 2: Outfit Try-On
  console.log('\n👗 Schritt 2/3: Outfit via Try-On anziehen...');
  const outfitResult = await generateOutfitImage(avatarId, date);
  results.steps.push({ step: 'outfit_tryon', ...outfitResult });
  results.totalCost += outfitResult.cost || 0;

  // Schritt 3: Walking-Video
  console.log('\n🎬 Schritt 3/3: Walking-Video generieren...');
  const videoResult = await generateWalkAnimation(avatarId, date);
  results.steps.push({ step: 'walk_video', ...videoResult });
  results.totalCost += videoResult.cost || 0;

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Pipeline fertig! Gesamtkosten: $${results.totalCost.toFixed(4)}`);
  console.log(`${'═'.repeat(50)}\n`);

  return results;
}

/**
 * Alle Avatare komplett generieren (Batch)
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

// ═══════════════════════════════════════════════════
// REPORTING
// ═══════════════════════════════════════════════════

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
  generateAvatarBaseImage,
  generateAllAvatarImages,
  generateOutfitImage,
  generateWalkAnimation,
  generateFullPipeline,
  generateAllOutfits,
  getGenerationHistory,
  getCostSummary,
};
