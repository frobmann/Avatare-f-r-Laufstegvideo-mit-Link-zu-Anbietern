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
const { CONFIG } = require('../services/ai-provider');

const router = express.Router();

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

module.exports = router;
