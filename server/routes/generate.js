const express = require('express');
const {
  generateAvatarBaseImage,
  generateAllAvatarImages,
  generateOutfitImage,
  generateWalkAnimation,
  generateFullPipeline,
  generateAllOutfits,
  getGenerationHistory,
  getCostSummary,
} = require('../services/generation-pipeline');
const { CONFIG, buildAvatarPrompt } = require('../services/ai-provider');
const { autoAssignOutfits, rotateOutfits, previewOutfits } = require('../services/outfit-rotation');
const { getDb } = require('../db');
const { execSync } = require('child_process');

const router = express.Router();

// Debug: Zeigt die aktuellen Prompts (ohne Generierung)
router.get('/debug-prompts', (req, res) => {
  try {
    const db = getDb();
    const avatars = db.prepare('SELECT * FROM avatars WHERE is_active = 1').all();

    let gitBranch = 'unknown';
    try { gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim(); } catch(e) {}

    const prompts = avatars.map(a => ({
      name: a.name,
      prompt: buildAvatarPrompt(a),
      containsWoman: buildAvatarPrompt(a).includes('woman'),
      imageUrl: a.image_url,
    }));

    res.json({
      gitBranch,
      avatarCount: avatars.length,
      prompts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Provider-Status prüfen
router.get('/status', (req, res) => {
  const provider = process.env.AI_PROVIDER || 'replicate';
  const hasToken = provider === 'replicate'
    ? !!process.env.REPLICATE_API_TOKEN
    : provider === 'huggingface'
      ? !!process.env.HUGGINGFACE_API_TOKEN
      : true;

  res.json({
    provider,
    configured: hasToken,
    avatarModel: CONFIG.replicate.avatarModel,
    tryonModel: CONFIG.replicate.tryonModel,
    videoModel: CONFIG.replicate.videoModel,
    quality: process.env.IMAGE_QUALITY || 'medium',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_GENERATIONS) || 2,
    costEstimate: {
      perAvatar: '$0.03–0.05',
      perTryOn: '$0.01–0.03',
      perVideo: '$0.10–0.20',
      perFullPipeline: '$0.15–0.30',
      daily6Avatars: '$0.90–1.80',
      monthly6Avatars: '$27–54',
    },
  });
});

// ── Avatar-Basisbild generieren ──

router.post('/avatar/:avatarId', async (req, res) => {
  try {
    const result = await generateAvatarBaseImage(req.params.avatarId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alle Avatar-Basisbilder generieren (Batch)
router.post('/avatars/batch', async (req, res) => {
  try {
    const result = await generateAllAvatarImages();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Outfit-Bild generieren (Try-On) ──

router.post('/outfit/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateOutfitImage(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Walking-Video generieren ──

router.post('/video/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateWalkAnimation(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Komplett-Pipeline (Bild → Try-On → Video) ──

router.post('/pipeline/:avatarId', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateFullPipeline(req.params.avatarId, date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Batch: Alle Outfits generieren ──

router.post('/batch', async (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = await generateAllOutfits(date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Generierungs-Historie ──

router.get('/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const history = getGenerationHistory(limit);
  res.json(history);
});

// ── Kosten-Übersicht ──

router.get('/costs', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const costs = getCostSummary(days);
  res.json(costs);
});

// ═══════════════════════════════════════════════════
// OUTFIT-ROTATION (Automatische Outfit-Zuordnung)
// ═══════════════════════════════════════════════════

// Vorschau: Was würde zugeordnet werden?
router.get('/outfits/preview', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const preview = previewOutfits(date);
  res.json(preview);
});

// Auto-Zuordnung: Outfits für heute (oder gewähltes Datum) automatisch zuweisen
router.post('/outfits/auto-assign', (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = autoAssignOutfits(date, {
      clearExisting: req.body.clearExisting !== false,
      respectStyles: req.body.respectStyles !== false,
    });
    if (!result.success) {
      return res.status(400).json(result);
    }
    console.log(`👗 Auto-Outfits zugewiesen für ${date}:`, result.summary);
    res.json(result);
  } catch (err) {
    console.error('❌ Auto-Outfit Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Rotation: Alte Outfits löschen und neue zuweisen
router.post('/outfits/rotate', (req, res) => {
  try {
    const date = req.body.date || new Date().toISOString().split('T')[0];
    const result = rotateOutfits(date);
    if (!result.success) {
      return res.status(400).json(result);
    }
    console.log(`🔄 Outfits rotiert für ${date}:`, result.summary);
    res.json(result);
  } catch (err) {
    console.error('❌ Rotation Fehler:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
